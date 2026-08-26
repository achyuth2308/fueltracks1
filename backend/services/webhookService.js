// ============================================================
// WEBHOOK SERVICE — FuelTracks Civil Supply Integration
// Dispatches GPS updates to registered third-party webhook URLs.
//
// DESIGN PRINCIPLES (production-safe):
//  • This module NEVER throws — all errors are caught and logged.
//  • It runs fully async (fire-and-forget) so it CANNOT block
//    the live GPS pipeline under any circumstance.
//  • DB lookups are cached in Redis with a 60-second TTL to avoid
//    hammering the database on every GPS packet.
//  • HTTP calls have a strict 5-second timeout and a 3-attempt
//    retry with exponential backoff (1 s → 3 s → 9 s).
//  • HMAC-SHA256 signature added to every call so recipients can
//    verify the payload is authentic.
// ============================================================

'use strict';

const https = require('https');
const http  = require('http');
const crypto = require('crypto');
const db     = require('../config/db');
const { redis } = require('../config/redis');

// ─── Config ────────────────────────────────────────────────
const MAX_RETRIES    = 3;
const RETRY_DELAYS   = [1000, 3000, 9000]; // ms — exponential backoff
const TIMEOUT_MS     = 5000;               // 5 s per HTTP attempt
const CACHE_TTL_SEC  = 60;                 // Re-fetch webhook config every 60 s

// ─── Helpers ───────────────────────────────────────────────

/**
 * Convert UTC date to IST string formatted as YYYY-MM-DD H:i:s
 */
function toIST(utcDate) {
  if (!utcDate) return null;
  const d = new Date(utcDate);
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(d.getTime() + istOffset);
  const pad = (n) => String(n).padStart(2, '0');
  return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())} ${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}:${pad(ist.getUTCSeconds())}`;
}

/**
 * Map satellite count → descriptive GPS signal quality
 */
function gpsSignalQuality(sats) {
  const s = parseInt(sats) || 0;
  if (s >= 7) return 'excellent';
  if (s >= 5) return 'good';
  if (s >= 3) return 'fair';
  if (s >= 1) return 'poor';
  return 'none';
}

/**
 * Map satellite count → accuracy estimate in metres
 */
function gpsAccuracy(sats) {
  const s = parseInt(sats) || 0;
  if (s >= 7) return 5;
  if (s >= 5) return 10;
  if (s >= 3) return 25;
  return null;
}

/**
 * Sign a JSON payload with HMAC-SHA256.
 * Returns the hex digest or null if no secret configured.
 */
function signPayload(body, secret) {
  if (!secret) return null;
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

/**
 * Perform a single HTTP POST to a URL with a JSON body.
 * Returns { ok: true } on 2xx or { ok: false, status, error }.
 */
function httpPost(url, body, signature) {
  return new Promise((resolve) => {
    try {
      const parsed   = new URL(url);
      const isHttps  = parsed.protocol === 'https:';
      const lib      = isHttps ? https : http;
      const bodyBuf  = Buffer.from(body, 'utf8');

      const headers = {
        'Content-Type':   'application/json',
        'Content-Length': bodyBuf.length,
        'User-Agent':     'FuelTracks-Webhook/1.0',
      };
      if (signature) headers['X-FuelTracks-Signature'] = `sha256=${signature}`;

      const req = lib.request(
        {
          hostname: parsed.hostname,
          port:     parsed.port || (isHttps ? 443 : 80),
          path:     parsed.pathname + parsed.search,
          method:   'POST',
          headers,
          timeout:  TIMEOUT_MS,
        },
        (res) => {
          // Drain the response body so the socket is freed
          res.resume();
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ ok: true, status: res.statusCode });
            } else {
              resolve({ ok: false, status: res.statusCode, error: `HTTP ${res.statusCode}` });
            }
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        resolve({ ok: false, error: 'Request timed out' });
      });

      req.on('error', (err) => {
        resolve({ ok: false, error: err.message });
      });

      req.write(bodyBuf);
      req.end();
    } catch (err) {
      resolve({ ok: false, error: err.message });
    }
  });
}

/**
 * POST to a webhook URL with retry logic.
 * Silently absorbs all errors — never throws.
 */
async function dispatchWithRetry(sub, payload) {
  const body      = JSON.stringify(payload);
  const signature = signPayload(body, sub.secret);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt - 1]));
    }

    const result = await httpPost(sub.url, body, signature);

    if (result.ok) {
      // Log success to DB (non-blocking)
      db.query(
        `INSERT INTO webhook_delivery_log (subscription_id, attempt, status_code, delivered_at)
         VALUES ($1, $2, $3, NOW()) ON CONFLICT DO NOTHING`,
        [sub.id, attempt + 1, result.status]
      ).catch(() => {});
      return;
    }

    console.warn(`[WEBHOOK] Attempt ${attempt + 1}/${MAX_RETRIES} failed for sub ${sub.id}: ${result.error}`);
  }

  // All retries exhausted — log failure
  db.query(
    `INSERT INTO webhook_delivery_log (subscription_id, attempt, status_code, error, delivered_at)
     VALUES ($1, $2, NULL, $3, NOW()) ON CONFLICT DO NOTHING`,
    [sub.id, MAX_RETRIES, 'Max retries exceeded']
  ).catch(() => {});
}

/**
 * Fetch active webhook subscriptions for an org + optional group.
 * Results are cached in Redis for CACHE_TTL_SEC seconds.
 */
async function getSubscriptions(orgId, vehicleGroupIds) {
  const cacheKey = `webhooks:org:${orgId}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (_) { /* cache miss — fall through */ }

  // Build group filter: include subscriptions scoped to this vehicle's group OR org-wide (group_id IS NULL)
  const result = await db.query(
    `SELECT ws.id, ws.url, ws.secret, ws.group_id
     FROM webhook_subscriptions ws
     WHERE ws.org_id = $1
       AND ws.is_active = TRUE
       AND (ws.group_id IS NULL OR ws.group_id = ANY($2::uuid[]))`,
    [orgId, vehicleGroupIds.length > 0 ? vehicleGroupIds : [null]]
  );

  const subs = result.rows;

  try {
    await redis.set(cacheKey, JSON.stringify(subs), 'EX', CACHE_TTL_SEC);
  } catch (_) { /* non-critical */ }

  return subs;
}

/**
 * Fetch the groups a vehicle belongs to.
 * Cached 5 minutes (same as IMEI → vehicle cache).
 */
async function getVehicleGroupIds(vehicleId) {
  const cacheKey = `vehicle:groups:${vehicleId}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (_) {}

  const result = await db.query(
    `SELECT group_id FROM vehicle_groups WHERE vehicle_id = $1`,
    [vehicleId]
  );
  const ids = result.rows.map((r) => r.group_id);

  try {
    await redis.set(cacheKey, JSON.stringify(ids), 'EX', 300);
  } catch (_) {}

  return ids;
}

// ─── Public API ────────────────────────────────────────────

/**
 * Main entry point — called by locationSubscriber after each live GPS packet.
 * Fire-and-forget: never awaited, never throws, never blocks the GPS pipeline.
 *
 * @param {object} vehicle  - Row from VehicleModel.findByImei()
 * @param {object} point    - The parsed GPS data from the Redis tracking channel
 */
function dispatch(vehicle, point) {
  // Immediately hand off to async worker — the caller does NOT await this
  _dispatchAsync(vehicle, point).catch((err) => {
    console.error('[WEBHOOK] Unexpected top-level error (should never happen):', err.message);
  });
}

async function _dispatchAsync(vehicle, point) {
  try {
    // 1. Get group IDs this vehicle belongs to
    const groupIds = await getVehicleGroupIds(vehicle.id);

    // 2. Get matching webhook subscriptions
    const subs = await getSubscriptions(vehicle.org_id, groupIds);
    if (!subs || subs.length === 0) return; // No subscribers — nothing to do

    // 3. Build the client-spec payload
    const sats = parseInt(point.satellites) || 0;
    const voltageRaw = parseFloat(point.voltage);
    const batteryRaw = parseFloat(point.battery);

    const payload = {
      event:     'gps.update',
      timestamp: toIST(new Date()),
      data: {
        vehicleRegistrationNumber: vehicle.plate || vehicle.name || null,
        imei:                      vehicle.imei,
        speed:                     parseFloat(point.speed) || 0,
        longitude:                 parseFloat(point.lng),
        latitude:                  parseFloat(point.lat),
        dateTime:                  toIST(point.deviceTime),
        vehicleBatteryVoltage:     isNaN(voltageRaw) ? null : Math.min(32, Math.max(0, voltageRaw)),
        deviceBatteryVoltage:      isNaN(batteryRaw) ? null : Math.min(6,  Math.max(0, batteryRaw)),
        ignitionOn:                point.ignition === true || point.ignition === 'true',
        gpsFix:                    sats >= 3,
        gpsSignalQuality:          gpsSignalQuality(sats),
        accuracy:                  gpsAccuracy(sats),
        bearing:                   parseFloat(point.direction) || 0,
        is_history:                false,
      },
    };

    // 4. Dispatch to all subscribers in parallel (independent — one failure won't block others)
    await Promise.allSettled(subs.map((sub) => dispatchWithRetry(sub, payload)));

  } catch (err) {
    // MUST NOT propagate — log and swallow
    console.error('[WEBHOOK] Dispatch error (non-fatal):', err.message);
  }
}

module.exports = { dispatch };
