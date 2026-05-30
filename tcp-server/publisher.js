// ============================================================
// REDIS PUBLISHER
// Publishes parsed packets to Redis channels
// Updates live vehicle state cache
// ============================================================

const Redis = require('ioredis');

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;

let publisher = null;

/**
 * Initialize Redis publisher connection
 */
function init() {
  publisher = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    retryStrategy: (times) => {
      const delay = Math.min(times * 100, 3000);
      console.log(`[REDIS] Reconnecting in ${delay}ms... (attempt ${times})`);
      return delay;
    },
    maxRetriesPerRequest: null,
  });

  publisher.on('connect', () => {
    console.log(`[REDIS] Publisher connected to ${REDIS_HOST}:${REDIS_PORT}`);
  });

  publisher.on('error', (err) => {
    console.error('[REDIS] Publisher error:', err.message);
  });

  return publisher;
}

/**
 * Publish a parsed normal packet ($10) to Redis
 * 1. Publish to 'tracking' channel (for DB writer + Socket.io)
 * 2. Cache latest state in vehicle:state:{imei}
 * 3. Set online indicator with 90s TTL
 */
async function publishLocation(parsed) {
  if (!publisher) throw new Error('Redis publisher not initialized');

  const { imei, lat, lng, speed, fuel, ignition, voltage, direction,
          odometer, satellites, gsmSignal, battery, deviceTime, isLive } = parsed;

  const payload = JSON.stringify({
    imei,
    lat,
    lng,
    speed,
    fuel,
    ignition,
    voltage,
    direction,
    odometer,
    satellites,
    gsmSignal,
    battery,
    deviceTime,
    isLive,
    serverTime: new Date().toISOString(),
  });

  try {
    // 1. Publish to tracking channel
    await publisher.publish('tracking', payload);

    // 2. Cache latest state
    await publisher.set(
      `vehicle:state:${imei}`,
      payload,
      'EX', 300  // Expire after 5 minutes
    );

    // 3. Set online indicator with 90-second TTL
    await publisher.set(
      `vehicle:online:${imei}`,
      '1',
      'EX', 90
    );

  } catch (err) {
    console.error(`[REDIS] Publish error for ${imei}:`, err.message);
  }
}

/**
 * Publish a parsed alert packet ($11) to Redis
 */
async function publishAlert(parsed) {
  if (!publisher) throw new Error('Redis publisher not initialized');

  const payload = JSON.stringify({
    imei: parsed.imei,
    alertType: parsed.alertType,
    alertText: parsed.alertText,
    lat: parsed.lat,
    lng: parsed.lng,
    deviceTime: parsed.deviceTime,
    serverTime: new Date().toISOString(),
  });

  try {
    await publisher.publish('alerts', payload);
  } catch (err) {
    console.error(`[REDIS] Alert publish error for ${parsed.imei}:`, err.message);
  }
}

/**
 * Close Redis connection
 */
async function close() {
  if (publisher) {
    await publisher.quit();
    publisher = null;
  }
}

module.exports = { init, publishLocation, publishAlert, close };
