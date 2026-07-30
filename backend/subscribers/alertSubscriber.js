// ============================================================
// ALERT SUBSCRIBER
// Subscribes to Redis 'alerts' channel
// Writes alerts to database and broadcasts notifications over Socket.io
// ============================================================

const { createSubscriber } = require('../config/redis');
const VehicleModel = require('../models/vehicleModel');
const GpsModel = require('../models/gpsModel');
const profileRepository = require('../modules/profile/repositories/profileRepository');
const NotificationService = require('../services/notificationService');
const fcmService = require('../services/fcmService');


let subscriber = null;

/**
 * Start listening to Redis alert updates
 * @param {object} io - Socket.io server instance
 */
async function start(io) {
  subscriber = createSubscriber();

  subscriber.on('connect', () => {
    console.log('[SUBSCRIBER] Alert subscriber connected to Redis');
  });

  // Subscribe to 'alerts' channel
  await subscriber.subscribe('alerts');

  subscriber.on('message', async (channel, message) => {
    if (channel !== 'alerts') return;

    try {
      const data = JSON.parse(message);
      const { imei, alertType, alertText, lat, lng, deviceTime } = data;

      // 1. Resolve IMEI to Vehicle ID and Org ID
      const vehicle = await VehicleModel.findByImei(imei);
      if (!vehicle) {
        console.warn(`[SUBSCRIBER] Alert received for unregistered IMEI: ${imei}`);
        return;
      }

      // Filter to only allow requested alerts (Overspeed, Geofence, Ignition, Parking)
      const allowedAlerts = ['overspeed', 'geofence', 'ignition_on', 'ignition_off', 'safety_park'];
      if (!allowedAlerts.includes(alertType.toLowerCase())) {
        return; // Drop unwanted alerts silently
      }

      const vehicleId = vehicle.id;
      const orgId = vehicle.org_id;

      // 2. Save alert to database
      const alert = await GpsModel.saveAlert({
        vehicleId,
        alertType,
        alertText,
        lat,
        lng,
        deviceTime
      });

      // Dispatch external notification (Email/WhatsApp) based on org preferences
      try {
        const profile = await profileRepository.getProfile(orgId);
        if (profile) {
          await NotificationService.dispatchAlert(profile, alertType, alertText, {
            name: vehicle.name,
            plate: vehicle.plate,
            imei: vehicle.imei
          });
        }
      } catch (notifyErr) {
        console.error('[SUBSCRIBER] Error sending alert notifications:', notifyErr.message);
      }

      // 3. Emit real-time alert over Socket.io
      const payload = {
        id: alert.id,
        vehicleId,
        imei,
        vehicleName: vehicle.name,
        plate: vehicle.plate,
        alertType,
        alertText,
        lat,
        lng,
        deviceTime,
        serverTime: alert.server_time
      };

      // Emit to single vehicle room
      io.to(`vehicle:${vehicleId}`).emit('alert:new', payload);

      // Emit to organization room
      io.to(`org:${orgId}`).emit('alert:new', payload);

      // 4. Dispatch FCM push to users who have this alert type enabled
      try {
        const fcmTokens = await GpsModel.getFcmTokensForAlert(orgId, alertType.toLowerCase());
        if (fcmTokens.length > 0) {
          await fcmService.sendMulticast(fcmTokens, {
            title: `${alertType.replace(/_/g, ' ').toUpperCase()} — ${vehicle.name}`,
            body: alertText || `${vehicle.plate} triggered a ${alertType} alert.`,
            data: {
              vehicleId: String(vehicleId),
              alertType,
              alertId: String(alert.id),
            },
          });
        }
      } catch (fcmErr) {
        console.error('[SUBSCRIBER] FCM dispatch error:', fcmErr.message);
      }

    } catch (err) {
      console.error('[SUBSCRIBER] Error processing alert packet:', err.message);
    }
  });
}

/**
 * Stop subscriber connection
 */
async function stop() {
  if (subscriber) {
    await subscriber.quit();
    subscriber = null;
  }
}

module.exports = { start, stop };
