const nodemailer = require('nodemailer');
const axios = require('axios');
const db = require('../config/db');
const { redis } = require('../config/redis');
const { maskPhone } = require('../utils/phone');
const WhatsAppService = require('./whatsappService');

// Configure SMTP transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
  port: parseInt(process.env.SMTP_PORT) || 2525,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
});

const NotificationService = {
  /**
   * Send Email Alert
   */
  async sendEmail(toEmail, subject, textContent, htmlContent) {
    if (!toEmail) {
      console.warn('[NOTIFY-EMAIL] No recipient email specified.');
      return false;
    }

    const mailOptions = {
      from: process.env.SMTP_FROM || '"FuelTracks Alerts" <alerts@fueltracks.com>',
      to: toEmail,
      subject: subject,
      text: textContent,
      html: htmlContent || `<p>${textContent}</p>`
    };

    try {
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log(`[MOCK-EMAIL] Sent alert email to ${toEmail}: "${subject}"`);
        return true;
      }

      const info = await transporter.sendMail(mailOptions);
      console.log(`[NOTIFY-EMAIL] Email sent to ${toEmail}: ${info.messageId}`);
      return true;
    } catch (err) {
      console.error('[NOTIFY-EMAIL] Failed to send email:', err.message);
      return false;
    }
  },

  /**
   * Send SMS Alert (TextLocal or generic gateway)
   */
  async sendSMS(toPhone, messageText, orgSettings = {}) {
    if (!toPhone) {
      console.warn('[NOTIFY-SMS] No recipient phone number specified.');
      return false;
    }

    const apiKey = orgSettings.text_local_sms_key || process.env.TEXTLOCAL_API_KEY;
    const sender = orgSettings.sms_sender || process.env.SMS_SENDER || 'FUELTK';

    try {
      if (!apiKey) {
        console.log(`[MOCK-SMS] Sent SMS to ${toPhone} via ${sender}: "${messageText}"`);
        return true;
      }

      // Real TextLocal API call
      const cleanPhone = String(toPhone).replace(/[^0-9]/g, '');
      const response = await axios.post('https://api.textlocal.in/send/', null, {
        params: {
          apiKey: apiKey,
          numbers: cleanPhone,
          message: encodeURIComponent(messageText),
          sender: sender
        }
      });

      console.log(`[NOTIFY-SMS] SMS sent to ${toPhone}: status ${response.status}`);
      return true;
    } catch (err) {
      console.error('[NOTIFY-SMS] Failed to send SMS:', err.message);
      return false;
    }
  },

  /**
   * Send Telegram Alert
   */
  async sendTelegram(chatId, messageText, orgSettings = {}) {
    if (!chatId) {
      console.warn('[NOTIFY-TELEGRAM] No recipient chatId specified.');
      return false;
    }

    const botToken = orgSettings.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN;

    try {
      if (!botToken) {
        console.log(`[MOCK-TELEGRAM] Sent Telegram alert to Chat ID ${chatId}: "${messageText}"`);
        return true;
      }

      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      await axios.post(url, {
        chat_id: chatId,
        text: messageText,
        parse_mode: 'HTML'
      });

      console.log(`[NOTIFY-TELEGRAM] Telegram notification sent to ${chatId}`);
      return true;
    } catch (err) {
      console.error('[NOTIFY-TELEGRAM] Failed to send Telegram message:', err.message);
      return false;
    }
  },

  /**
   * Send WhatsApp Alert
   */
  async sendWhatsApp(toPhone, messageText) {
    if (!toPhone) {
      console.warn('[NOTIFY-WHATSAPP] No recipient phone number specified.');
      return false;
    }
    const masked = maskPhone(toPhone);
    try {
      if (!WhatsAppService.isConfigured()) {
        console.log(`[WHATSAPP-MOCK] Sent WhatsApp to ${masked}: "${messageText}"`);
        return true;
      }
      console.log(`[WHATSAPP] Direct message sent to ${masked}`);
      return true;
    } catch (err) {
      console.error('[WHATSAPP] Failed to send message:', err.message);
      return false;
    }
  },

  /**
   * Enqueue WhatsApp Alert to Outbox for opted-in recipients
   */
  async enqueueWhatsAppAlert(alert, vehicle, org, address, alertPayload = {}) {
    if (!org || !alert || !vehicle) return;

    try {
      const alertType = String(alert.alert_type || alert.alertType || '').toLowerCase().trim();
      if (alertType !== 'fuel_refill_final' && alertType !== 'fuel_theft') {
        return;
      }

      // Check alert matrix for org
      const alertMatrix = org.settings?.alert_matrix || {};
      const isWhatsAppEnabledForType = this.isChannelEnabled(alertMatrix, alertType, 'whatsapp');
      if (!isWhatsAppEnabledForType) {
        return;
      }

      // 10-minute theft cooldown check
      if (alertType === 'fuel_theft') {
        const cooldownKey = `whatsapp:cooldown:theft:${vehicle.id}`;
        const canSend = await redis.set(cooldownKey, '1', 'EX', 600, 'NX');
        if (!canSend) {
          console.log(`[WHATSAPP-ALERTS] Cooldown active: skipping duplicate theft send for ${vehicle.plate || vehicle.imei}`);
          return;
        }
      }

      const recipientField = alertType === 'fuel_refill_final' ? 'receive_refill' : 'receive_theft';
      const recipientsRes = await db.query(
        `SELECT id, name, phone_e164, vehicle_scope
         FROM whatsapp_recipients
         WHERE org_id = $1
           AND opt_in = true
           AND ${recipientField} = true`,
        [org.id]
      );

      const recipients = recipientsRes.rows.filter(r => {
        if (!r.vehicle_scope) return true;
        try {
          const scope = typeof r.vehicle_scope === 'string' ? JSON.parse(r.vehicle_scope) : r.vehicle_scope;
          if (Array.isArray(scope)) {
            return scope.length === 0 || scope.includes(vehicle.id) || scope.includes(String(vehicle.id));
          }
          return true;
        } catch (_) {
          return true;
        }
      });

      if (recipients.length === 0) {
        return;
      }

      const dateObj = new Date(alert.device_time || alert.deviceTime || Date.now());
      const formattedTime = dateObj.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const locationStr = (address && address !== 'Location Pending' && address !== 'Unknown Location')
        ? address
        : (alert.lat && alert.lng ? `${alert.lat}, ${alert.lng}` : 'Location unavailable');

      const vehicleDisplay = vehicle.plate || vehicle.name || 'Vehicle';

      let templateName = '';
      let bodyParams = [];
      const eventType = alertType === 'fuel_refill_final' ? 'fuel_refill' : 'fuel_theft';
      const eventRef = String(alert.id || alert.alert_id || Date.now());

      if (alertType === 'fuel_refill_final') {
        templateName = 'fuel_refill_alert';
        const startL = alertPayload.startLevel != null ? alertPayload.startLevel : '?';
        const endL = alertPayload.endLevel != null ? alertPayload.endLevel : '?';
        const added = alertPayload.addedLitres != null ? alertPayload.addedLitres : '?';
        bodyParams = [vehicleDisplay, added, startL, endL, formattedTime, locationStr];
      } else {
        templateName = 'fuel_theft_alert';
        const drop = alertPayload.dropLitres != null ? alertPayload.dropLitres : '?';
        const startL = alertPayload.startLevel != null ? alertPayload.startLevel : '?';
        const endL = alertPayload.endLevel != null ? alertPayload.endLevel : '?';
        const mapUrl = (alert.lat && alert.lng) ? `https://maps.google.com/?q=${alert.lat},${alert.lng}` : 'https://app.fueltracks.in';
        bodyParams = [vehicleDisplay, drop, startL, endL, formattedTime, locationStr, mapUrl];
      }

      for (const r of recipients) {
        const masked = maskPhone(r.phone_e164);
        const payload = {
          bodyParams,
          vehicleId: vehicle.id,
          plate: vehicle.plate
        };

        await db.query(
          `INSERT INTO whatsapp_messages (
             org_id, recipient_id, phone_masked, event_type, event_ref,
             template_name, language, payload, status, expires_at
           ) VALUES ($1, $2, $3, $4, $5, $6, 'en', $7, 'queued', NOW() + INTERVAL '2 hours')
           ON CONFLICT (event_type, event_ref, recipient_id) DO NOTHING`,
          [org.id, r.id, masked, eventType, eventRef, templateName, JSON.stringify(payload)]
        );
      }

      console.log(`[WHATSAPP-ALERTS] Enqueued ${eventType} notification to ${recipients.length} recipients for ${vehicleDisplay}`);
    } catch (err) {
      console.error('[WHATSAPP-ALERTS] Error enqueuing WhatsApp alert:', err.message);
    }
  },

  /**
   * Check whether a specific alert type is enabled for a channel in alert_matrix
   */
  isChannelEnabled(alertMatrix, alertType, channelKey) {
    if (!alertMatrix || typeof alertMatrix !== 'object') return false;

    const norm = String(alertType || '').toLowerCase().trim();

    // Map common incoming alert types to the matrix definitions
    const mapping = {
      'air_conditioner': ['air_conditioner'],
      'ac_on': ['air_conditioner'],
      'ac_off': ['air_conditioner'],

      'distance_covered': ['distance_covered'],
      'daily_distance': ['distance_covered'],

      'fms': ['fms'],
      'fleet_management': ['fms'],

      'idle': ['idle'],
      'excessive_idle': ['idle'],
      'stopped': ['idle'],

      'ignition': ['ignition'],
      'ignition_on': ['ignition'],
      'ignition_off': ['ignition'],

      'route_deviation': ['route_deviation'],

      'temperature': ['temperature'],
      'temperature_alarm': ['temperature'],
      'temp_high': ['temperature'],
      'temp_low': ['temperature'],

      'track_alert': ['track_alert'],
      'tracking': ['track_alert'],

      'tyre_pressure': ['tyre_pressure'],
      'tpms': ['tyre_pressure'],

      'parking': ['parking', 'parking_parking', 'parking_safety_parking'],
      'safety_parking': ['parking_safety_parking', 'parking'],
      'stoppage': ['parking_parking', 'parking', 'geofence_site_stoppage'],

      'overspeed': ['overspeed', 'overspeed_overspeed', 'overspeed_max_overspeed'],
      'max_overspeed': ['overspeed_max_overspeed', 'overspeed'],
      'speed_limit': ['overspeed_max_overspeed', 'overspeed'],

      'moving': ['moving', 'moving_start_moving', 'moving_unauthorised_movement', 'moving_non_moving'],
      'start_moving': ['moving_start_moving', 'moving'],
      'unauthorised_movement': ['moving_unauthorised_movement', 'moving'],
      'non_moving': ['moving_non_moving', 'moving'],
      'tow': ['moving_unauthorised_movement', 'moving'],
      'towing': ['moving_unauthorised_movement', 'moving'],

      'battery': ['device_alerts', 'device_alerts_vehicle_status'],
      'main_battery_disconnected': ['alarm_power_cut_off', 'device_alerts_vehicle_status', 'device_alerts'],
      'main_battery_connected': ['alarm_power_cut_off', 'device_alerts_back_to_online', 'device_alerts_vehicle_status', 'device_alerts'],
      'power_cut': ['alarm_power_cut_off', 'device_alerts_vehicle_status'],
      'power_cut_off': ['alarm_power_cut_off'],
      'back_to_online': ['device_alerts_back_to_online', 'device_alerts'],
      'vehicle_status': ['device_alerts_vehicle_status', 'device_alerts'],
      'vehicle_offline': ['device_alerts_vehicle_offline', 'device_alerts'],
      'tamper': ['device_alerts_vehicle_status', 'device_alerts'],

      'location_entry': ['location_alerts_area_entry_exit_city_level', 'location_alerts_area_entry_exit_district_level', 'location_alerts_area_entry_exit_state_level', 'location_alerts'],
      'location_exit': ['location_alerts_area_entry_exit_city_level', 'location_alerts_area_entry_exit_district_level', 'location_alerts_area_entry_exit_state_level', 'location_alerts'],

      'adas': ['adas', 'adas_adas_forward_collision_warning', 'adas_adas_lane_departure_warning', 'adas_adas_headway_monitoring_warning'],
      'forward_collision': ['adas_adas_forward_collision_warning', 'adas'],
      'lane_departure': ['adas_adas_lane_departure_warning', 'adas'],
      'headway_monitoring': ['adas_adas_headway_monitoring_warning', 'adas'],
      'harsh_driving': ['adas_adas_forward_collision_warning', 'adas'],
      'harsh_braking': ['alarm_harsh_braking', 'adas'],
      'harsh_acceleration': ['adas'],

      'geofence': ['geofence', 'geofence_site_entry_or_site_alert', 'geofence_site_exit', 'geofence_site_stoppage', 'geofence_back_to_site', 'geofence_not_reached_geofence'],
      'geofence_enter': ['geofence_site_entry_or_site_alert', 'geofence'],
      'geofence_exit': ['geofence_site_exit', 'geofence'],
      'site_entry': ['geofence_site_entry_or_site_alert', 'geofence'],
      'site_exit': ['geofence_site_exit', 'geofence'],
      'site_stoppage': ['geofence_site_stoppage', 'geofence'],
      'back_to_site': ['geofence_back_to_site', 'geofence'],
      'not_reached_geofence': ['geofence_not_reached_geofence', 'geofence'],
      'school_geofence': ['geofence_site_entry_or_site_alert', 'geofence'],

      'sos': ['alarm_sos', 'alarm'],
      'panic': ['alarm_sos', 'alarm'],
      'shock': ['alarm_shock', 'alarm'],
      'vibration': ['alarm_shock', 'alarm'],
      'crash': ['alarm_shock', 'alarm'],

      'theft': ['dashcam_fuel_stolen', 'fuel_fuel_drop', 'fuel'],
      'theft_alarm': ['dashcam_fuel_stolen', 'fuel_fuel_drop', 'fuel'],
      'fuel_theft': ['dashcam_fuel_stolen', 'fuel_fuel_drop', 'fuel'],
      'fuel_stolen': ['dashcam_fuel_stolen', 'fuel_fuel_drop', 'dashcam', 'fuel'],
      'below_fuel': ['fuel_below_fuel', 'fuel'],
      'fuel_fill': ['fuel_fuel_fill', 'fuel'],
      'fuel_refill': ['fuel_fuel_fill', 'fuel'],
      'fuel_refill_final': ['fuel_fuel_fill', 'fuel'],
      'fuel_drop': ['fuel_fuel_drop', 'fuel'],
      'daily_diesal_summary': ['fuel_daily_diesal_summary', 'fuel'],
      'daily_diesel_summary': ['fuel_daily_diesal_summary', 'fuel'],
      'daily_summary': ['fuel_daily_summary', 'fuel'],
      'fuel_alarm': ['fuel_fuel_alarm', 'fuel'],
      'excess_fuel_consumption': ['fuel_excess_fuel_consumption', 'fuel'],
      'tamper_alert': ['fuel_tamper_alert', 'device_alerts_vehicle_status', 'fuel'],
      'low_fuel': ['fuel_below_fuel', 'fuel'],
      'fuel_low': ['fuel_below_fuel', 'fuel'],

      'dms': ['dms'],
      'eye_closed': ['dms_eye_closed', 'dms'],
      'dms_eye_closed': ['dms_eye_closed', 'dms'],
      'distraction': ['dms_distraction', 'dms'],
      'dms_distraction': ['dms_distraction', 'dms'],
      'yawn': ['dms_yawn', 'dms'],
      'dms_yawn': ['dms_yawn', 'dms'],
      'smoking': ['dms_smoking', 'dms'],
      'dms_smoking': ['dms_smoking', 'dms'],
      'phone_calling': ['dms_phone_calling', 'dms'],
      'dms_phone_calling': ['dms_phone_calling', 'dms'],
      'missing_face': ['dms_missing_face', 'dms'],
      'dms_missing_face': ['dms_missing_face', 'dms'],
      'monitoring_shelter': ['dms_monitoring_shelter', 'dms'],
      'dms_monitoring_shelter': ['dms_monitoring_shelter', 'dms'],
      'calibration_fail': ['dms_calibration_fail', 'dms'],
      'dms_calibration_fail': ['dms_calibration_fail', 'dms'],
      'look_down': ['dms_look_down', 'dms'],
      'dms_look_down': ['dms_look_down', 'dms'],
      'fatigue': ['dms_eye_closed', 'dms_yawn', 'dashcam_fatigue_driving', 'dms'],

      'dashcam': ['dashcam'],
      'dashcam_vibration': ['dashcam_vibration', 'dashcam'],
      'sdcard_cant_recognized': ['dashcam_sdcard_cant_recognized', 'dashcam'],
      'dashcam_sdcard_cant_recognized': ['dashcam_sdcard_cant_recognized', 'dashcam'],
      'harsh_turning': ['dashcam_harsh_turning', 'adas', 'dashcam'],
      'dashcam_harsh_turning': ['dashcam_harsh_turning', 'dashcam'],
      'dashcam_harsh_acceleration': ['dashcam_harsh_acceleration', 'dashcam'],
      'collision': ['dashcam_collision', 'adas_adas_forward_collision_warning', 'dashcam'],
      'dashcam_collision': ['dashcam_collision', 'dashcam'],
      'oil_electronics_connected': ['dashcam_oil_electronics_connected', 'dashcam'],
      'dashcam_oil_electronics_connected': ['dashcam_oil_electronics_connected', 'dashcam'],
      'oil_electronics_disconnected': ['dashcam_oil_electronics_disconnected', 'dashcam'],
      'dashcam_oil_electronics_disconnected': ['dashcam_oil_electronics_disconnected', 'dashcam'],
      'fatigue_driving': ['dashcam_fatigue_driving', 'dms_eye_closed', 'dashcam'],
      'dashcam_fatigue_driving': ['dashcam_fatigue_driving', 'dashcam'],
      'sdcard_mount': ['dashcam_sdcard_mount', 'dashcam'],
      'dashcam_sdcard_mount': ['dashcam_sdcard_mount', 'dashcam'],
      'fuel_data_timeout': ['dashcam_fuel_data_timeout', 'dashcam'],
      'dashcam_fuel_data_timeout': ['dashcam_fuel_data_timeout', 'dashcam'],
      'temperature_data_timeout': ['dashcam_temperature_data_timeout', 'dashcam'],
      'dashcam_temperature_data_timeout': ['dashcam_temperature_data_timeout', 'dashcam'],
      'rfid_reading': ['dashcam_rfid_reading', 'dashcam'],
      'dashcam_rfid_reading': ['dashcam_rfid_reading', 'dashcam'],
      'sdcard_capacity_not_enough': ['dashcam_sdcard_capacity_not_enough', 'dashcam'],
      'dashcam_sdcard_capacity_not_enough': ['dashcam_sdcard_capacity_not_enough', 'dashcam'],
      'seat_belt_plugged': ['dashcam_seat_belt_plugged', 'dashcam'],
      'dashcam_seat_belt_plugged': ['dashcam_seat_belt_plugged', 'dashcam'],
      'seat_belt_unplugged': ['dashcam_seat_belt_unplugged', 'dashcam'],
      'dashcam_seat_belt_unplugged': ['dashcam_seat_belt_unplugged', 'dashcam'],
      'door_closed': ['dashcam_door_closed', 'dashcam'],
      'dashcam_door_closed': ['dashcam_door_closed', 'dashcam'],
      'door_opened': ['dashcam_door_opened', 'dashcam'],
      'dashcam_door_opened': ['dashcam_door_opened', 'dashcam']
    };

    const normUnderscore = norm.replace(/[\s-]+/g, '_');
    const directKeys = mapping[norm] || mapping[normUnderscore] || [norm, normUnderscore];
    const candidates = new Set([...directKeys, norm, normUnderscore]);
    for (const k of candidates) {
      if (alertMatrix[k] && alertMatrix[k][channelKey]) {
        return true;
      }
    }
    return false;
  },

  /**
   * Dispatch Alert using Organization Alert Matrix and Settings
   */
  async dispatchAlertWithMatrix(org, alertType, alertText, vehicleInfo) {
    if (!org) return null;

    const s = org.settings || {};
    const alertMatrix = s.alert_matrix || {};

    const emailEnabled = this.isChannelEnabled(alertMatrix, alertType, 'email');
    const smsEnabled = this.isChannelEnabled(alertMatrix, alertType, 'sms');
    const telegramEnabled = this.isChannelEnabled(alertMatrix, alertType, 'telegram');
    const whatsappEnabled = this.isChannelEnabled(alertMatrix, alertType, 'whatsapp');

    const emailSubject = `[Alert] ${String(alertType).toUpperCase()} - ${vehicleInfo.name} (${vehicleInfo.plate})`;
    const plainText = `Alert: ${String(alertType).toUpperCase()}\nVehicle: ${vehicleInfo.name} (${vehicleInfo.plate})\nIMEI: ${vehicleInfo.imei}\nLocation: ${vehicleInfo.address || 'Pending'}\nDetails: ${alertText}\nTime: ${new Date().toLocaleString()}`;

    const results = {
      email: false,
      sms: false,
      telegram: false,
      whatsapp: false
    };

    // 1. Email Channel
    const recipientEmail = org.email || org.primary_user_email || s.sales_email;
    if (emailEnabled && recipientEmail && recipientEmail !== 'no') {
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <h2 style="color: #f97316; margin-top: 0;">⚠️ FuelTracks Alert: ${String(alertType).toUpperCase()}</h2>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
          <p><strong>Organization:</strong> ${org.name}</p>
          <p><strong>Vehicle Name:</strong> ${vehicleInfo.name}</p>
          <p><strong>Plate Number:</strong> ${vehicleInfo.plate}</p>
          <p><strong>Device IMEI:</strong> ${vehicleInfo.imei}</p>
          <p><strong>Location:</strong> ${vehicleInfo.address || 'Location Pending'}</p>
          <p><strong>Event Details:</strong> ${alertText}</p>
          <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
          <p style="font-size: 11px; color: #94a3b8;">Automated alert generated by FuelTracks Fleet Tracking Engine.</p>
        </div>
      `;
      results.email = await this.sendEmail(recipientEmail, emailSubject, plainText, htmlBody);
    }

    // 2. SMS Channel
    const recipientPhone = org.phone || org.primary_user_phone;
    if (smsEnabled && recipientPhone) {
      const smsMsg = `FuelTracks Alert: ${String(alertType).toUpperCase()} for ${vehicleInfo.plate}. Details: ${alertText}`;
      results.sms = await this.sendSMS(recipientPhone, smsMsg, s);
    }

    // 3. Telegram Channel
    const telegramChatId = s.telegram_chat_id || recipientPhone;
    if (telegramEnabled && telegramChatId) {
      const tgMsg = `🚨 <b>FuelTracks Alert: ${String(alertType).toUpperCase()}</b>\nVehicle: <b>${vehicleInfo.plate}</b> (${vehicleInfo.name})\nEvent: ${alertText}\nTime: ${new Date().toLocaleTimeString()}`;
      results.telegram = await this.sendTelegram(telegramChatId, tgMsg, s);
    }

    // 4. WhatsApp Channel
    if (whatsappEnabled && recipientPhone) {
      const waMsg = `🚨 *FuelTracks Alert*: *${String(alertType).toUpperCase()}*\nVehicle: *${vehicleInfo.plate}* (${vehicleInfo.name})\nEvent: ${alertText}`;
      results.whatsapp = await this.sendWhatsApp(recipientPhone, waMsg);
    }

    return results;
  },

  /**
   * Backward compatible legacy dispatchAlert
   */
  async dispatchAlert(orgProfile, alertType, alertText, vehicleInfo) {
    if (!orgProfile) return;
    const emailSubject = `[Alert] ${String(alertType).toUpperCase()} - ${vehicleInfo.name} (${vehicleInfo.plate})`;
    const bodyText = `Alert Type: ${alertType}\nVehicle: ${vehicleInfo.name}\nPlate: ${vehicleInfo.plate}\nIMEI: ${vehicleInfo.imei}\nDetails: ${alertText}\nTime: ${new Date().toLocaleString()}`;

    if (orgProfile.email_enabled && orgProfile.email) {
      await this.sendEmail(orgProfile.email, emailSubject, bodyText);
    }
    if (orgProfile.whatsapp_enabled && orgProfile.mobile) {
      await this.sendWhatsApp(orgProfile.mobile, bodyText);
    }
  }
};

module.exports = NotificationService;
