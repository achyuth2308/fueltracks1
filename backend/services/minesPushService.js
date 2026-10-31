// ============================================================
// MINES SERVER (Xenovex / MiningVTS) CONTINUOUS PUSH SERVICE
// Automatically pushes live telemetry for vehicles belonging to
// the 'tnreal mining server' or '%mining%' group to the Mines Portal.
// ============================================================

const axios = require('axios');
const https = require('https');
const db = require('../config/db');

// Dedicated HTTPS Agent with keepAlive and strict bounded sockets
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 5,
  maxFreeSockets: 2,
  timeout: 5000
});

// Endpoints
const MINES_DEV_ENDPOINT = 'https://devmtsv1.xenovex.com/cron/vehiclegpsdata.php';
const MINES_PROD_ENDPOINT = 'https://portal.miningvts.in/cron/vehiclegpsdata.php';

// Target endpoint (defaults to PRODUCTION portal.miningvts.in; can be switched to DEV via MINES_USE_DEV === 'true')
const TARGET_ENDPOINT = process.env.MINES_USE_DEV === 'true'
  ? (process.env.MINES_ENDPOINT || MINES_DEV_ENDPOINT)
  : (process.env.MINES_ENDPOINT || MINES_PROD_ENDPOINT);

// ────────────────────────────────────────────────────────────
// In-Memory Vehicle Cache: Zero DB queries on hot packet loop!
// Periodically refreshed every 5 minutes from PostgreSQL.
// ────────────────────────────────────────────────────────────
let miningVehicleSet = new Set();
let lastCacheSync = 0;
const CACHE_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Per-vehicle push throttle: Max 1 push per 15 seconds per vehicle
const lastPushTimestamps = new Map();
const THROTTLE_INTERVAL_MS = 15 * 1000; // 15 seconds

/**
 * Syncs the in-memory Set of vehicle IDs belonging to the Mining group.
 * Called automatically on startup and refreshed every 5 minutes.
 */
async function refreshMiningVehicles() {
  try {
    const result = await db.query(`
      SELECT DISTINCT v.id, v.imei
      FROM vehicles v
      JOIN vehicle_groups vg ON v.id = vg.vehicle_id
      JOIN groups g ON g.id = vg.group_id
      WHERE (
        g.name ILIKE '%tnreal mining%' OR 
        g.name ILIKE '%mining%' OR 
        g.name ILIKE '%mines%'
      )
      AND v.is_active = TRUE
    `);

    const newSet = new Set();
    for (const row of result.rows) {
      newSet.add(row.id);
      if (row.imei) newSet.add(String(row.imei).trim());
    }

    miningVehicleSet = newSet;
    lastCacheSync = Date.now();
  } catch (err) {
    // If DB is temporarily busy or unreachable, keep previous cache and log quietly
    console.error('[MINES PUSH] Error refreshing mining vehicle cache:', err.message);
  }
}

// Initial sync on startup & recurring background refresh
refreshMiningVehicles();
setInterval(refreshMiningVehicles, CACHE_SYNC_INTERVAL_MS);

/**
 * Formats a Date/UTC string into IST "YYYY-MM-DD HH:mm:ss" required by the Mines Server.
 */
function formatMinesDate(utcDate) {
  const d = utcDate ? new Date(utcDate) : new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // +05:30
  const ist = new Date(d.getTime() + istOffset);

  const yyyy = ist.getUTCFullYear();
  const mm = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(ist.getUTCDate()).padStart(2, '0');
  const hh = String(ist.getUTCHours()).padStart(2, '0');
  const min = String(ist.getUTCMinutes()).padStart(2, '0');
  const ss = String(ist.getUTCSeconds()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

/**
 * Main push handler called by locationSubscriber.js.
 * Strictly non-blocking, fire-and-forget, zero DB queries in the hot path.
 *
 * @param {object} vehicle - Vehicle record from DB
 * @param {object} point - Live telemetry data point
 */
async function pushToMines(vehicle, point) {
  try {
    if (!vehicle || !point) return;

    const imei = String(vehicle.imei || point.imei || '').trim();
    if (!imei) return;

    // 1. FAST MEMORY CHECK: Only process vehicles in the Mining group
    const isTarget = miningVehicleSet.has(vehicle.id) || miningVehicleSet.has(imei);
    if (!isTarget) return;

    // 2. MUST have valid coordinates
    const lat = parseFloat(point.lat);
    const lng = parseFloat(point.lng);
    if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return;

    // 3. THROTTLE: Check if this vehicle was pushed within the last 15 seconds
    const now = Date.now();
    const lastPushed = lastPushTimestamps.get(vehicle.id) || 0;
    if (now - lastPushed < THROTTLE_INTERVAL_MS) {
      return; // Skip packet to protect network and prevent Mines server rate-limiting
    }
    lastPushTimestamps.set(vehicle.id, now);

    // Clean up old entries from throttle map if it grows beyond 10,000 devices
    if (lastPushTimestamps.size > 10000) {
      const expiryCutoff = now - (60 * 1000);
      for (const [vId, ts] of lastPushTimestamps.entries()) {
        if (ts < expiryCutoff) lastPushTimestamps.delete(vId);
      }
    }

    // 4. CONSTRUCT 30-FIELD JSON PAYLOAD
    const payload = {
      latitude: lat,
      longitude: lng,
      signalstrength: point.satellites != null ? Math.min(31, Math.max(0, Math.round(point.satellites * 3.5))) : (point.gsmSignal != null ? Math.round(point.gsmSignal) : 20),
      speed: point.speed != null ? Math.round(point.speed) : 0,
      odometer: point.odometer != null ? Math.round(point.odometer) : 0,
      direction: point.direction != null ? Math.round(point.direction) : 0,
      isonlinedata: point.isLive !== false,
      isignitionon: point.ignition === true,
      gpsdevicets: formatMinesDate(point.deviceTime),
      accelerometer: 0,
      batterystatustype: 1,
      batteryvoltage: point.battery != null && !isNaN(point.battery) ? Number(point.battery) : 12.5,
      istampered: false,
      extbatteryvoltage: point.voltage != null && !isNaN(point.voltage) ? Number(point.voltage) : 12.8,
      mainpowerstatustype: 1,
      gpsstatus: true,
      packettype: point.packetType || 'GPS',
      altitude: point.altitude != null ? Math.round(point.altitude) : 20,
      noofsatellites: point.satellites != null ? Math.round(point.satellites) : 8,
      operatorname: vehicle.metadata?.simOperator || 'Airtel',
      servingcellinfo: 'CELL001',
      neighbourcellinfo: 'CELL002',
      rawdata: point.rawHex || point.raw || 'GPS_PACKET',
      isemergency: false,
      digitalinput: point.ignition === true ? 1 : 0,
      digitaloutput: 0,
      frameno: point.sequence || 1001,
      analoginput1: point.fuel != null && !isNaN(point.fuel) ? Number(point.fuel) : 0,
      analoginput2: 0,
      imeino: imei
    };

    // 5. DISPATCH HTTP POST (Strictly bounded, non-blocking)
    axios.post(TARGET_ENDPOINT, payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'FuelTracks-MinesPush/1.0'
      },
      timeout: 4000,
      httpsAgent
    }).then(response => {
      if (response.data && response.data.status) {
        // Success response from Mines server
        // Example: { status: true, message: 'Vehicle GPS data saved successfully', gpsdata_id: 32031, ... }
      } else {
        // If unmapped IMEI or rejected
        console.warn(`[MINES PUSH] ⚠️ Response for ${vehicle.plate || imei}:`, response.data?.message || response.data);
      }
    }).catch(error => {
      // 403, 500, or network timeout
      const errMsg = error.response ? `${error.response.status} - ${JSON.stringify(error.response.data)}` : error.message;
      console.error(`[MINES PUSH] ❌ Error pushing for ${vehicle.plate || imei}:`, errMsg);
    });

  } catch (err) {
    console.error('[MINES PUSH] Unexpected pipeline error:', err.message);
  }
}

module.exports = {
  pushToMines,
  refreshMiningVehicles,
  formatMinesDate,
  TARGET_ENDPOINT
};
