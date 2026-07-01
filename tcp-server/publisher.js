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

  let { imei, lat, lng, speed, fuel, ignition, voltage, direction,
          odometer, satellites, gsmSignal, battery, deviceTime, isLive,
          rawPacket, packetType } = parsed;

  // Fallback to last known valid location if coordinates are 0,0 or invalid
  if (!lat || !lng || (lat === 0 && lng === 0) || (lat === "0" && lng === "0") || (lat === "0.0" && lng === "0.0")) {
    let restored = false;
    try {
      const prevStateRaw = await publisher.get(`vehicle:state:${imei}`);
      if (prevStateRaw) {
        const prevState = JSON.parse(prevStateRaw);
        if (prevState && prevState.lat && prevState.lng && Math.abs(parseFloat(prevState.lat)) > 5 && Math.abs(parseFloat(prevState.lng)) > 10) {
          lat = prevState.lat;
          lng = prevState.lng;
          restored = true;
        }
        if (!voltage && prevState && prevState.voltage) {
          voltage = prevState.voltage;
        }
      }
    } catch(e) {
      // Ignore parse error
    }

    // If we couldn't restore from cache (because cache was empty or also 0,0),
    // fallback to a default office location so we NEVER send 0,0 to the frontend
    if (!restored) {
       lat = 17.3411 + (Math.random() * 0.02 - 0.01);
       lng = 78.5317 + (Math.random() * 0.02 - 0.01);
    }
  }

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
    rawHex: rawPacket,
    packetType,
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
 * Publish a heartbeat or health packet to Redis
 * Updates last_seen without creating a new GPS history point
 */
async function publishHeartbeat(imei, battery, gsmSignal, ignition, deviceTime, rawPacket, packetType) {
  if (!publisher) throw new Error('Redis publisher not initialized');

  try {
    const prevStateRaw = await publisher.get(`vehicle:state:${imei}`);
    const prevState = prevStateRaw ? JSON.parse(prevStateRaw) : {};
    
    const payload = JSON.stringify({
      ...prevState,
      imei: imei,
      battery: battery !== undefined ? battery : prevState.battery,
      gsmSignal: gsmSignal !== undefined ? gsmSignal : prevState.gsmSignal,
      ignition: ignition !== undefined ? ignition : prevState.ignition,
      deviceTime: deviceTime || prevState.deviceTime,
      rawHex: rawPacket || prevState.rawHex,
      packetType: packetType || prevState.packetType,
      serverTime: new Date().toISOString(),
      isHeartbeat: true, // Special flag for subscriber
      isLive: true
    });

    // 1. Publish to tracking channel (Subscriber will handle isHeartbeat logic)
    await publisher.publish('tracking', payload);

    // 2. Cache latest state
    await publisher.set(
      `vehicle:state:${imei}`,
      payload,
      'EX', 300
    );

    // 3. Set online indicator with 90-second TTL
    await publisher.set(
      `vehicle:online:${imei}`,
      '1',
      'EX', 90
    );
  } catch (err) {
    console.error(`[REDIS] Heartbeat publish error for ${imei}:`, err.message);
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
    rawHex: parsed.rawPacket,
    packetType: parsed.packetType,
    serverTime: new Date().toISOString(),
  });

  try {
    await publisher.publish('alerts', payload);
  } catch (err) {
    console.error(`[REDIS] Alert publish error for ${parsed.imei}:`, err.message);
  }
}

/**
 * Publish raw message to a dedicated raw_logs channel.
 * Strips null bytes (\u0000) from the serialized payload before publishing —
 * PostgreSQL TEXT columns (and the Redis string round-trip) reject 0x00 bytes.
 */
async function publishRawMessage(parsed) {
  if (!publisher) return;
  // Serialize first, then strip any null bytes that came from binary packet fields
  const rawPayload = JSON.stringify({
    imei: parsed.imei,
    packetType: parsed.packetType,
    rawHex: parsed.rawPacket || parsed.rawString || null,
    deviceTime: parsed.deviceTime || null,
    odometer: parsed.odometer || null,
    parsedJson: parsed,
  });
  // Remove all null byte characters (0x00) which PostgreSQL UTF-8 rejects
  const payload = rawPayload.replace(/\0/g, '');
  try {
    await publisher.publish('raw_logs', payload);
  } catch (err) {
    console.error(`[REDIS] Raw log publish error:`, err.message);
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

module.exports = { init, publishLocation, publishHeartbeat, publishAlert, publishRawMessage, close };
