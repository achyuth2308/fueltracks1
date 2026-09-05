// ============================================================
// GOVERNMENT MINING SURVEILLANCE BRIDGE (TGMSS)
// Posts live GPS data to Telangana Government Mine Surveillance
// API: https://minesurveillance.aptonline.in:9443/TGMSS/
// ============================================================

const https = require('https');

const TGMSS_BASE_URL = 'https://minesurveillance.aptonline.in:9443/TGMSS';
const TGMSS_USERNAME = process.env.TGMSS_USERNAME || 'GPSTRACK';
const TGMSS_PASSWORD = process.env.TGMSS_PASSWORD || '';

// Token management
let accessToken = null;
let refreshToken = null;
let tokenFetchedAt = 0;
const TOKEN_LIFETIME_MS = 55 * 60 * 1000; // Refresh every 55 minutes (conservative)

// Event queue — batch GPS events before posting
const eventQueue = [];
const MAX_QUEUE_SIZE = 500;
const BATCH_INTERVAL_MS = parseInt(process.env.TGMSS_BATCH_INTERVAL_MS) || 15000; // 15 seconds
let batchTimer = null;

// In-memory cache of vehicle metadata (plate, name) keyed by IMEI
// Populated from Redis hash `sand:vehicle:{imei}` on first encounter
const vehicleMetaCache = new Map();

// Redis client reference — set during init()
let redisClient = null;

/**
 * Make an HTTPS request and return a promise
 */
function httpsRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: data, headers: res.headers });
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy(new Error('TGMSS request timed out after 30s'));
    });
    if (body) req.write(body);
    req.end();
  });
}

/**
 * Authenticate with TGMSS and obtain access_token
 */
async function authenticate() {
  if (!TGMSS_PASSWORD) {
    console.warn('[TGMSS] Skipping authentication — TGMSS_PASSWORD not configured');
    return false;
  }

  const url = `${TGMSS_BASE_URL}/authentication`;
  const payload = JSON.stringify({
    username: TGMSS_USERNAME,
    password: TGMSS_PASSWORD
  });

  try {
    console.log(`[TGMSS] Authenticating as ${TGMSS_USERNAME}...`);
    const res = await httpsRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, payload);

    if (res.statusCode === 200) {
      const data = JSON.parse(res.body);
      if (data.access_token) {
        accessToken = data.access_token;
        refreshToken = data.refresh_token || null;
        tokenFetchedAt = Date.now();
        console.log('[TGMSS] Authentication successful — token acquired');
        return true;
      } else {
        console.error('[TGMSS] Authentication response missing access_token:', res.body);
        return false;
      }
    } else {
      console.error(`[TGMSS] Authentication failed (HTTP ${res.statusCode}):`, res.body);
      return false;
    }
  } catch (err) {
    console.error('[TGMSS] Authentication network error:', err.message);
    return false;
  }
}

/**
 * Check if the token is still valid, refresh if needed
 */
async function ensureToken() {
  if (!accessToken || (Date.now() - tokenFetchedAt) > TOKEN_LIFETIME_MS) {
    return await authenticate();
  }
  return true;
}

/**
 * Post a batch of GPS events to TGMSS
 */
async function postEvents(events) {
  if (events.length === 0) return;

  const hasToken = await ensureToken();
  if (!hasToken) {
    console.warn(`[TGMSS] Cannot post ${events.length} events — no valid token`);
    return;
  }

  const url = `${TGMSS_BASE_URL}/saveGPSEvents`;
  const payload = JSON.stringify(events);

  try {
    const res = await httpsRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${accessToken}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    }, payload);

    if (res.statusCode === 200) {
      const data = JSON.parse(res.body);
      console.log(`[TGMSS] Posted ${events.length} events — Response: ${data.message || res.body}`);
    } else if (res.statusCode === 400 || res.statusCode === 401) {
      console.warn(`[TGMSS] Token expired/invalid (HTTP ${res.statusCode}), re-authenticating...`);
      accessToken = null;
      const reAuth = await authenticate();
      if (reAuth) {
        // Retry once with new token
        const retryRes = await httpsRequest(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Token ${accessToken}`,
            'Content-Length': Buffer.byteLength(payload)
          }
        }, payload);
        if (retryRes.statusCode === 200) {
          const retryData = JSON.parse(retryRes.body);
          console.log(`[TGMSS] Retry posted ${events.length} events — Response: ${retryData.message || retryRes.body}`);
        } else {
          console.error(`[TGMSS] Retry failed (HTTP ${retryRes.statusCode}):`, retryRes.body);
        }
      }
    } else {
      console.error(`[TGMSS] POST failed (HTTP ${res.statusCode}):`, res.body);
    }
  } catch (err) {
    console.error('[TGMSS] POST network error:', err.message);
  }
}

/**
 * Get vehicle metadata (plate number) from Redis cache or in-memory cache
 */
async function getVehicleMeta(imei) {
  // Check in-memory cache first
  if (vehicleMetaCache.has(imei)) {
    return vehicleMetaCache.get(imei);
  }

  // Try Redis hash
  if (redisClient) {
    try {
      const meta = await redisClient.hgetall(`sand:vehicle:${imei}`);
      if (meta && meta.vehicleNo) {
        vehicleMetaCache.set(imei, meta);
        return meta;
      }
    } catch (err) {
      console.error(`[TGMSS] Failed to fetch vehicle meta for ${imei}:`, err.message);
    }
  }

  // Fallback — return minimal metadata
  const fallback = { vehicleNo: '', vehicleId: imei };
  vehicleMetaCache.set(imei, fallback);
  return fallback;
}

/**
 * Determine signal strength label from GSM signal value
 */
function getSignalStrength(gsmSignal) {
  const val = parseInt(gsmSignal);
  if (isNaN(val)) return 'Medium';
  if (val >= 20) return 'Strong';
  if (val >= 10) return 'Medium';
  return 'Weak';
}

/**
 * Format a Date or ISO string into "YYYY-MM-DD HH:mm:ss"
 */
function formatDateTime(dt) {
  if (!dt) return new Date().toISOString().replace('T', ' ').substring(0, 19);
  const d = typeof dt === 'string' ? new Date(dt) : dt;
  if (isNaN(d.getTime())) return new Date().toISOString().replace('T', ' ').substring(0, 19);
  return d.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Queue a GPS event for batched posting to TGMSS
 * Called from server.js when a sand-mining-enabled vehicle sends a packet
 *
 * @param {object} parsed - The parsed GPS packet from the TCP server
 */
async function queueEvent(parsed) {
  if (!parsed || !parsed.imei) return;

  // Skip if password not configured yet
  if (!TGMSS_PASSWORD) return;

  // Get vehicle metadata (plate number)
  const meta = await getVehicleMeta(parsed.imei);

  const speed = parseFloat(parsed.speed) || 0;

  const event = {
    deviceType: parsed.protocolName || 'TrackNow',
    signalStrength: getSignalStrength(parsed.gsmSignal),
    latitude: parseFloat(parsed.lat) || 0,
    externalBattery: false,
    deviceId: parsed.imei,
    speed: speed,
    vehicleNo: meta.vehicleNo || '',
    createdDate: formatDateTime(parsed.deviceTime),
    vendor: 'TrackNow',
    imei: parsed.imei,
    location: '-',
    tripStartTime: formatDateTime(parsed.deviceTime),
    vehicleId: meta.vehicleId || parsed.imei,
    ignition: parsed.ignition ? 'ON' : 'OFF',
    status: speed > 0 ? 'Running' : 'Stopped',
    longitude: parseFloat(parsed.lng) || 0
  };

  // Prevent unbounded memory growth
  if (eventQueue.length >= MAX_QUEUE_SIZE) {
    eventQueue.shift(); // Drop oldest event
  }

  eventQueue.push(event);
}

/**
 * Process the queue — called on a timer
 */
async function processBatch() {
  if (eventQueue.length === 0) return;

  // Drain the queue
  const batch = eventQueue.splice(0, eventQueue.length);
  await postEvents(batch);
}

/**
 * Initialize the bridge — call once from server.js startup
 */
function init(redis) {
  redisClient = redis;

  if (!TGMSS_PASSWORD) {
    console.warn('[TGMSS] Government bridge NOT active — TGMSS_PASSWORD env var is empty. Set it and restart to enable.');
    return;
  }

  console.log(`[TGMSS] Government Mining Surveillance bridge initialized`);
  console.log(`[TGMSS] Target: ${TGMSS_BASE_URL}`);
  console.log(`[TGMSS] Username: ${TGMSS_USERNAME}`);
  console.log(`[TGMSS] Batch interval: ${BATCH_INTERVAL_MS}ms`);

  // Authenticate immediately on startup
  authenticate().then(ok => {
    if (ok) {
      console.log('[TGMSS] Ready to post GPS events to government server');
    } else {
      console.warn('[TGMSS] Initial authentication failed — will retry on next batch');
    }
  });

  // Start the batch processor timer
  batchTimer = setInterval(() => {
    processBatch().catch(err => {
      console.error('[TGMSS] Batch processing error:', err.message);
    });
  }, BATCH_INTERVAL_MS);

  // Don't let the timer prevent process exit
  if (batchTimer.unref) batchTimer.unref();
}

/**
 * Flush remaining events and shut down cleanly
 */
async function shutdown() {
  if (batchTimer) {
    clearInterval(batchTimer);
    batchTimer = null;
  }
  // Flush remaining events
  if (eventQueue.length > 0) {
    console.log(`[TGMSS] Flushing ${eventQueue.length} remaining events before shutdown...`);
    await processBatch();
  }
}

/**
 * Clear cached vehicle metadata for a specific IMEI
 * Called when admin updates vehicle details
 */
function invalidateVehicleCache(imei) {
  vehicleMetaCache.delete(imei);
}

module.exports = {
  init,
  queueEvent,
  shutdown,
  invalidateVehicleCache
};
