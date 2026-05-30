// ============================================================
// ALERT SUBSCRIBER
// Subscribes to Redis 'alerts' channel
// Writes alerts to database and broadcasts notifications over Socket.io
// ============================================================

const { createSubscriber } = require('../config/redis');
const VehicleModel = require('../models/vehicleModel');
const GpsModel = require('../models/gpsModel');

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
