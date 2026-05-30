// ============================================================
// LOCATION SUBSCRIBER
// Subscribes to Redis 'tracking' channel
// Writes GPS points to database and emits live updates over Socket.io
// ============================================================

const { createSubscriber } = require('../config/redis');
const VehicleModel = require('../models/vehicleModel');
const GpsModel = require('../models/gpsModel');

let subscriber = null;

/**
 * Start listening to Redis tracking updates
 * @param {object} io - Socket.io server instance
 */
async function start(io) {
  subscriber = createSubscriber();

  subscriber.on('connect', () => {
    console.log('[SUBSCRIBER] Location subscriber connected to Redis');
  });

  // Subscribe to 'tracking' channel
  await subscriber.subscribe('tracking');

  subscriber.on('message', async (channel, message) => {
    if (channel !== 'tracking') return;

    try {
      const data = JSON.parse(message);
      const { imei, lat, lng, speed, fuel, ignition, voltage, direction,
              odometer, satellites, gsmSignal, battery, deviceTime, isLive } = data;

      // 1. Resolve IMEI to Vehicle ID and Org ID
      const vehicle = await VehicleModel.findByImei(imei);
      if (!vehicle) {
        // Log raw packets if unregistered device tries to connect
        await GpsModel.saveRawPacket(imei, message, false, 'Unregistered IMEI');
        return;
      }

      const vehicleId = vehicle.id;
      const orgId = vehicle.org_id;

      // 2. Save packet to GPS history (always check validity flag)
      // Note: validation of GPS fix 'A' was done by TCP server before Redis publish
      await GpsModel.savePoint({
        vehicleId,
        lat,
        lng,
        speed,
        direction,
        odometer,
        fuel,
        ignition,
        satellites,
        gsmSignal,
        battery,
        voltage,
        isLive,
        deviceTime
      });

      // 3. Update denormalized latest state table
      await GpsModel.updateLatestState({
        vehicleId,
        lat,
        lng,
        speed,
        direction,
        fuel,
        ignition,
        voltage,
        odometer,
        satellites,
        gsmSignal
      });

      // 4. Emit real-time events over socket.io (only for live packets)
      if (isLive) {
        const payload = {
          vehicleId,
          imei,
          name: vehicle.name,
          plate: vehicle.plate,
          lat,
          lng,
          speed,
          direction,
          fuel,
          ignition,
          voltage,
          odometer,
          satellites,
          gsmSignal,
          battery,
          deviceTime,
          isOnline: true
        };

        // Emit to single vehicle room
        io.to(`vehicle:${vehicleId}`).emit('location:update', payload);

        // Emit to entire organization fleet room
        io.to(`org:${orgId}`).emit('fleet:update', payload);
      }

      // Save raw packet as parsed for debugging (optional)
      await GpsModel.saveRawPacket(imei, message, true, null);

    } catch (err) {
      console.error('[SUBSCRIBER] Error processing location packet:', err.message);
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
