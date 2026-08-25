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
const { getAddress } = require('../utils/geocodeUtils');


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

      // Filter to only allow requested alerts (Overspeed, Geofence, Ignition, Parking, etc.)
      const allowedAlerts = ['overspeed', 'geofence', 'geofence_enter', 'geofence_exit', 'ignition_on', 'ignition_off', 'stoppage', 'parking', 'safety_park', 'trip_started', 'trip_ended', 'route_deviation', 'excessive_idle', 'sos', 'battery', 'harsh_driving', 'harsh_braking', 'harsh_acceleration', 'box_open', 'general', 'power_cut', 'crash', 'tow', 'panic', 'theft', 'theft_alarm', 'tamper', 'moving', 'start_moving', 'stopped', 'idle'];
      if (!allowedAlerts.includes(alertType.toLowerCase())) {
        return; // Drop unwanted alerts silently
      }

      const vehicleId = vehicle.id;
      const orgId = vehicle.org_id;

      let address = 'Unknown Location';
      if (lat && lng) {
        address = await getAddress(lat, lng);
      }

      const dateObj = new Date(deviceTime || Date.now());
      const dateStr = dateObj.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
      const timeStr = dateObj.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });

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
        address,
        deviceTime,
        serverTime: alert.server_time
      };

      // Emit to single vehicle room
      io.to(`vehicle:${vehicleId}`).emit('alert:new', payload);

      // Emit to organization room
      io.to(`org:${orgId}`).emit('alert:new', payload);

      // 3.5 Cache in Redis for instant Topbar retrieval
      try {
        const { redis } = require('../config/redis');
        const redisKey = `org:alerts:${orgId}`;
        const cachePayload = { ...payload, isRead: false };
        await redis.lpush(redisKey, JSON.stringify(cachePayload));
        await redis.ltrim(redisKey, 0, 49); // Keep strictly latest 50
        await redis.expire(redisKey, 86400); // 24 hours expiry
      } catch (redisErr) {
        console.warn('[SUBSCRIBER] Error caching alert to Redis:', redisErr.message);
      }

      // 4. Dispatch FCM push to users who have this alert type enabled
      try {
        const fcmTokens = await GpsModel.getFcmTokensForAlert(orgId, vehicleId, alertType.toLowerCase());
        if (fcmTokens.length > 0) {
          const bodyText = alertText || `${vehicle.plate} triggered a ${alertType} alert.`;
          const enhancedBody = `${bodyText}\n\nTime: ${timeStr}, ${dateStr}\nLoc: ${address}\nMaps: https://maps.google.com/?q=${lat},${lng}`;
          
          await fcmService.sendMulticast(fcmTokens, {
            title: `${alertType.replace(/_/g, ' ').toUpperCase()} — ${vehicle.name}`,
            body: enhancedBody,
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
