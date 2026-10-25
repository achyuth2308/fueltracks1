// ============================================================
// ALERT SUBSCRIBER
// Subscribes to Redis 'alerts' channel
// Writes alerts to database and broadcasts notifications over Socket.io
// ============================================================

const { redis, createSubscriber } = require('../config/redis');
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

      const rawType = (alertType || '').toLowerCase().trim();
      const rawText = (alertText || '').toLowerCase().trim();

      // 1. Filter routine ping noise and spurious battery alerts
      const droppedNoise = [
        'general', 'location_update', 'location', 'heartbeat', 'ping', 'periodic_report',
        // Drop noisy/routine internal battery chatter
        'internal_battery_low', 'low_battery', 'low_battery_removed', 'battery_low', 'battery_charged',
        // Drop non-alert emergency state clear / stop messages
        'emergency_off', 'sos_cleared'
      ];
      if (droppedNoise.includes(rawType)) {
        return; // Drop routine location pings and battery noise silently
      }

      // Filter spurious battery text patterns (fluctuating internal battery, charge restore pings)
      if (
        rawText.includes('low battery') ||
        rawText.includes('internal battery charged') ||
        rawText.includes('internal battery low') ||
        rawText.includes('battery low') ||
        rawText.includes('low battery removed')
      ) {
        return; // Drop spurious battery alerts
      }

      // 1b. Filter raw momentary ignition bounces (< 3 min glitches)
      // If an instant raw alert arrives from TCP (e.g. BSTPL$2 or AIS-140) but the vehicle's
      // stable debounced state in Redis disagrees, drop the momentary glitch (< 3 mins).
      if (rawType === 'ignition_off' || rawType === 'ignition_on') {
        const stableIgnKey = `vehicle:stable_ignition:${vehicle.id}`;
        let stableIgnStr = null;
        try {
          stableIgnStr = await redis.get(stableIgnKey);
        } catch (e) {}

        // If vehicle is stably ON and an isolated OFF alert packet arrives, drop the dip
        if (rawType === 'ignition_off' && stableIgnStr === '1') {
          return;
        }
        // If vehicle is stably OFF and an isolated ON alert packet arrives, drop the surge
        if (rawType === 'ignition_on' && stableIgnStr === '0') {
          return;
        }
      }

      // 2. Identify Main Battery Disconnected and Connected events
      const isMainBatteryDisconnect = (
        rawType === 'main_battery_disconnected' ||
        rawType === 'power_cut' ||
        rawType === 'power_disconnected' ||
        rawText.includes('disconnected from main battery') ||
        rawText.includes('disconnect from main battery') ||
        rawText.includes('main battery disconnected') ||
        rawText.includes('mains off') ||
        rawText.includes('power cut') ||
        (rawType === 'battery' && (rawText.includes('disconnect') || rawText.includes('off')))
      );

      const isMainBatteryConnect = (
        rawType === 'main_battery_connected' ||
        rawText.includes('connected to main battery') ||
        rawText.includes('connect back to main battery') ||
        rawText.includes('main battery connected') ||
        rawText.includes('mains on') ||
        (rawType === 'battery' && (rawText.includes('connect') || rawText.includes('on')))
      );

      // If it's another generic 'battery' type alert that isn't a main battery event, drop it
      if (rawType === 'battery' && !isMainBatteryDisconnect && !isMainBatteryConnect) {
        return;
      }

      let finalAlertType = alertType;
      let finalAlertText = alertText;

      // 3. State-latch Main Battery Disconnected / Connected alerts:
      // - Disconnected alert triggers ONCE upon disconnection, and remains silent until reconnected.
      // - Connected alert triggers ONCE upon reconnection, only if previously disconnected.
      // - Drops all continuous/repeated alerts while remaining in the same state.
      if (isMainBatteryDisconnect || isMainBatteryConnect) {
        const batteryStateKey = `vehicle:main_battery_state:${vehicle.id}`;
        let lastState = null;
        try {
          lastState = await redis.get(batteryStateKey);
        } catch (rErr) {
          console.warn('[SUBSCRIBER] Redis battery state lookup warning:', rErr.message);
        }

        if (isMainBatteryDisconnect) {
          if (lastState === 'disconnected') {
            // Already disconnected; drop continuous duplicate alert packets
            return;
          }
          // State transition: connected/unknown -> disconnected
          try {
            await redis.set(batteryStateKey, 'disconnected');
          } catch (rErr) {
            console.warn('[SUBSCRIBER] Redis battery state set warning:', rErr.message);
          }
          finalAlertType = 'main_battery_disconnected';
          finalAlertText = 'Main Battery Disconnected';
        } else if (isMainBatteryConnect) {
          if (lastState === 'connected') {
            // Already connected; drop continuous duplicate alert packets
            return;
          }
          if (!lastState) {
            // Initial state: device startup with battery already connected.
            // Latch state without firing an alert since it was never disconnected.
            try {
              await redis.set(batteryStateKey, 'connected');
            } catch (rErr) {
              console.warn('[SUBSCRIBER] Redis battery state set warning:', rErr.message);
            }
            return;
          }
          // State transition: disconnected -> connected
          try {
            await redis.set(batteryStateKey, 'connected');
          } catch (rErr) {
            console.warn('[SUBSCRIBER] Redis battery state set warning:', rErr.message);
          }
          finalAlertType = 'main_battery_connected';
          finalAlertText = 'Main Battery Connected';
        }
      }

      const vehicleId = vehicle.id;
      const orgId = vehicle.org_id;

      let address = 'Location Pending'; // UI/FCM work with this placeholder

      const dateObj = new Date(deviceTime || Date.now());
      const dateStr = dateObj.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
      const timeStr = dateObj.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });

      // 4. Save alert to database
      const alert = await GpsModel.saveAlert({
        vehicleId,
        alertType: finalAlertType,
        alertText: finalAlertText,
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
          await NotificationService.dispatchAlertWithMatrix(org, finalAlertType, finalAlertText, {
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

      // 5. Emit real-time alert over Socket.io
      const payload = {
        id: alert.id,
        vehicleId,
        imei,
        vehicleName: vehicle.name,
        plate: vehicle.plate,
        alertType: finalAlertType,
        alertText: finalAlertText,
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

      // 5.5 Cache in Redis for instant Topbar retrieval
      try {
        const redisKey = `org:alerts:${orgId}`;
        const cachePayload = { ...payload, isRead: false };
        await redis.lpush(redisKey, JSON.stringify(cachePayload));
        await redis.ltrim(redisKey, 0, 49); // Keep strictly latest 50
        await redis.expire(redisKey, 86400); // 24 hours expiry
      } catch (redisErr) {
        console.warn('[SUBSCRIBER] Error caching alert to Redis:', redisErr.message);
      }

      // 6. Dispatch FCM push to users who have this alert type enabled
      try {
        const fcmTokens = await GpsModel.getFcmTokensForAlert(orgId, vehicleId, finalAlertType.toLowerCase());
        if (fcmTokens.length > 0) {
          let typeUpper = finalAlertType.toUpperCase().replace(/_/g, ' ');
          if (typeUpper === 'IGNITION ON') typeUpper = 'ENGINE ON';
          if (typeUpper === 'IGNITION OFF') typeUpper = 'ENGINE OFF';
          
          const shortAddress = address.split(',')[0].substring(0, 15) + '...';
          
          const vehicleDisplay = vehicle.name || vehicle.plate || 'Unknown Vehicle';
          let fcmTitle = `${typeUpper}-${vehicleDisplay}`;
          let fcmBody = '';
          
          if (finalAlertType.toLowerCase() === 'overspeed') {
             const pld = data.alertPayload || {};
             const spd = pld.speed ? Math.round(pld.speed) : 0;
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
              alertType: finalAlertType,
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
