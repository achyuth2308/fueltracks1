// ============================================================
// ALERT SUBSCRIBER
// Subscribes to Redis 'alerts' channel
// Writes alerts to database and broadcasts notifications over Socket.io
// ============================================================

const { createSubscriber } = require('../config/redis');
const OrgModel = require('../models/orgModel');
const VehicleModel = require('../models/vehicleModel');
const GpsModel = require('../models/gpsModel');
const profileRepository = require('../modules/profile/repositories/profileRepository');
const NotificationService = require('../services/notificationService');
const fcmService = require('../services/fcmService');
const { getAddress } = require('../utils/geocodeUtils');

// Concurrency limit for geocodes (BN-1 fix)
const IN_FLIGHT_LIMIT = 5;
let inFlightGeocodes = 0;
const geocodeQueue = [];

function processGeocodeQueue() {
  if (inFlightGeocodes >= IN_FLIGHT_LIMIT || geocodeQueue.length === 0) return;
  inFlightGeocodes++;
  const { lat, lng, alertId, resolve } = geocodeQueue.shift();
  
  getAddress(lat, lng).then(async (addr) => {
    if (alertId && addr && addr !== 'Unknown Location') {
      await GpsModel.updateAlertAddress(alertId, addr);
    }
    resolve(addr);
  }).catch(() => {
    resolve('Unknown Location');
  }).finally(() => {
    inFlightGeocodes--;
    processGeocodeQueue();
  });
}

function queueGeocode(lat, lng, alertId) {
  if (!lat || !lng) return Promise.resolve('Unknown Location');
  return new Promise((resolve) => {
    geocodeQueue.push({ lat, lng, alertId, resolve });
    processGeocodeQueue();
  });
}

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

      // Filter to only drop routine GPS ping noise ('general', 'location_update', 'heartbeat')
      const droppedNoise = ['general', 'location_update', 'location', 'heartbeat', 'ping', 'periodic_report'];
      if (droppedNoise.includes(alertType.toLowerCase())) {
        return; // Drop routine location pings silently
      }

      const vehicleId = vehicle.id;
      const orgId = vehicle.org_id;

      let address = 'Location Pending'; // UI/FCM work with this placeholder

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

      // Fire-and-forget geocode in background
      queueGeocode(lat, lng, alert.id).catch(() => {});

      // Dispatch external notifications (Email, SMS, Telegram, WhatsApp) based on org alert matrix & settings
      try {
        const org = await OrgModel.findById(orgId);
        if (org) {
          await NotificationService.dispatchAlertWithMatrix(org, alertType, alertText, {
            name: vehicle.name,
            plate: vehicle.plate,
            imei: vehicle.imei,
            address,
            deviceTime
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
          let typeUpper = alertType.toUpperCase().replace(/_/g, ' ');
          if (typeUpper === 'IGNITION ON') typeUpper = 'ENGINE ON';
          if (typeUpper === 'IGNITION OFF') typeUpper = 'ENGINE OFF';
          
          const shortAddress = address.split(',')[0].substring(0, 15) + '...';
          
          const vehicleDisplay = vehicle.name || vehicle.plate || 'Unknown Vehicle';
          let fcmTitle = `${typeUpper}-${vehicleDisplay}`;
          let fcmBody = '';
          
          if (alertType.toLowerCase() === 'overspeed') {
             // alertText usually contains the speed info e.g. "Overspeeding at 75 km/h"
             // Or we can parse data.alertPayload if it exists in the message
             const payload = data.alertPayload || {};
             const spd = payload.speed ? Math.round(payload.speed) : 0;
             const spdStr = spd > 0 ? ` - ${spd} Km/h` : '';
             fcmBody = `${typeUpper}${spdStr} - ${vehicleDisplay} ${dateStr} (${timeStr}) ${shortAddress}`;
          } else {
             fcmBody = `${typeUpper} - ${vehicleDisplay} ${dateStr} (${timeStr}) ${shortAddress}`;
          }
          
          await fcmService.sendMulticast(fcmTokens, {
            title: fcmTitle,
            body: fcmBody,
            data: {
              vehicleId: String(vehicleId),
              alertType,
              alertId: String(alert.id),
              lat: String(lat),
              lng: String(lng)
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
