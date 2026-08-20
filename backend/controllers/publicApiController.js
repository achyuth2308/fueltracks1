// ============================================================
// THIRD-PARTY API CONTROLLER — FuelTracks
// Exposes live location and GPS history to external clients.
// All requests are org-scoped via API key.
// ============================================================

const db = require('../config/db');

// ─── Helper ─────────────────────────────────────────────────
// Convert a UTC timestamp from PostgreSQL to IST formatted string
function toIST(utcDate) {
  if (!utcDate) return null;
  const d = new Date(utcDate);
  // IST = UTC + 5:30
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(d.getTime() + istOffset);
  const pad = (n) => String(n).padStart(2, '0');
  return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())} ${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}:${pad(ist.getUTCSeconds())}`;
}

// ─── Shape a GPS record into the client-required format ─────
function formatPoint(row, isHistory) {
  // vehicleBatteryVoltage: the main 12/24V vehicle supply (stored as `voltage`, 0-32V)
  // deviceBatteryVoltage:  the internal GPS device battery (stored as `battery`, 0-6V)
  const voltageRaw = parseFloat(row.voltage);
  const batteryRaw = parseFloat(row.battery);

  // GPS signal quality: map satellites count to descriptive quality
  let gpsSignalQuality = 'none';
  const sats = parseInt(row.satellites) || 0;
  if (sats >= 7)      gpsSignalQuality = 'excellent';
  else if (sats >= 5) gpsSignalQuality = 'good';
  else if (sats >= 3) gpsSignalQuality = 'fair';
  else if (sats >= 1) gpsSignalQuality = 'poor';

  // gpsFix: device has a valid GPS lock (>= 3 satellites)
  const gpsFix = sats >= 3;

  // accuracy: derived from satellite count (rough HDOP approximation in metres)
  let accuracy;
  if (sats >= 7) accuracy = 5;
  else if (sats >= 5) accuracy = 10;
  else if (sats >= 3) accuracy = 25;
  else accuracy = null;

  return {
    vehicleRegistrationNumber: row.plate || null,
    imei:                      row.imei,
    speed:                     parseFloat(row.speed) || 0,
    longitude:                 parseFloat(row.lng),
    latitude:                  parseFloat(row.lat),
    dateTime:                  toIST(row.device_time),
    vehicleBatteryVoltage:     isNaN(voltageRaw) ? null : Math.min(32, Math.max(0, voltageRaw)),
    deviceBatteryVoltage:      isNaN(batteryRaw) ? null : Math.min(6, Math.max(0, batteryRaw)),
    ignitionOn:                row.ignition === true || row.ignition === 'true',
    gpsFix,
    gpsSignalQuality,
    accuracy,
    bearing:                   parseFloat(row.direction) || 0,
    is_history:                isHistory,
  };
}

// ─── GET /api/v1/location/live ──────────────────────────────
// Returns the latest known position for every vehicle in the org.
// Optional query param: ?imei=<imei>  (filter to a single vehicle)
async function getLiveLocation(req, res, next) {
  try {
    const { orgId } = req.apiOrg;
    const { imei } = req.query;

    let whereImei = '';
    const params = [orgId];

    if (imei) {
      params.push(imei.trim());
      whereImei = `AND v.imei = $${params.length}`;
    }

    const result = await db.query(
      `SELECT
         v.imei,
         v.plate,
         vls.lat,
         vls.lng,
         vls.speed,
         vls.direction,
         vls.voltage,
         vls.battery,
         vls.ignition,
         vls.satellites,
         vls.gsm_signal,
         vls.last_seen AS device_time
       FROM vehicles v
       JOIN vehicle_latest_state vls ON vls.vehicle_id = v.id
       WHERE v.org_id = $1
         ${whereImei}
       ORDER BY v.plate ASC`,
      params
    );

    if (imei && result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No vehicle with IMEI "${imei}" found in your organization.`,
        code: 'VEHICLE_NOT_FOUND',
      });
    }

    const data = result.rows.map((row) => formatPoint(row, false));

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/v1/location/live ──────────────────────────────
// Client sends IMEI(s) in the request body.
// They hit this when they spot a vehicle in their own system
// and want to know its live GPS position.
//
// Body (single):  { "imei": "869925070566102" }
// Body (batch):   { "imeis": ["869925070566102", "867440068994847"] }
async function postLiveLocation(req, res, next) {
  try {
    const { orgId } = req.apiOrg;
    const { imei, imeis } = req.body || {};

    // Build list of IMEIs from either `imei` (single) or `imeis` (array)
    let imeiList = [];
    if (imei)  imeiList = [String(imei).trim()];
    if (imeis && Array.isArray(imeis)) imeiList = imeis.map(i => String(i).trim()).filter(Boolean);

    if (imeiList.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Provide "imei" (single string) or "imeis" (array of strings) in the request body.',
        code: 'MISSING_IMEI',
      });
    }

    if (imeiList.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 IMEIs per request.',
        code: 'TOO_MANY_IMEIS',
      });
    }

    // Build $2, $3, $4 ... placeholders for the IN clause
    const placeholders = imeiList.map((_, i) => `$${i + 2}`).join(', ');
    const params = [orgId, ...imeiList];

    const result = await db.query(
      `SELECT
         v.imei,
         v.plate,
         vls.lat,
         vls.lng,
         vls.speed,
         vls.direction,
         vls.voltage,
         vls.battery,
         vls.ignition,
         vls.satellites,
         vls.gsm_signal,
         vls.last_seen AS device_time
       FROM vehicles v
       JOIN vehicle_latest_state vls ON vls.vehicle_id = v.id
       WHERE v.org_id = $1
         AND v.imei IN (${placeholders})
       ORDER BY v.plate ASC`,
      params
    );

    const data = result.rows.map((row) => formatPoint(row, false));

    // Identify any requested IMEIs that were not found in this org
    const foundImeis = new Set(result.rows.map(r => r.imei));
    const notFound = imeiList.filter(i => !foundImeis.has(i));

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
      ...(notFound.length > 0 && { not_found: notFound }),
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/v1/location/history ───────────────────────────
// Returns paginated GPS history for a specific vehicle.
// Required:  ?imei=<imei>&start=YYYY-MM-DD&end=YYYY-MM-DD
// Optional:  ?page=1&limit=500
async function getHistory(req, res, next) {
  try {
    const { orgId } = req.apiOrg;
    const { imei, start, end, page = 1, limit = 500 } = req.query;

    // ── Validation ──────────────────────────────────────────
    if (!imei) {
      return res.status(400).json({
        success: false,
        error: 'Query param "imei" is required.',
        code: 'MISSING_IMEI',
      });
    }
    if (!start || !end) {
      return res.status(400).json({
        success: false,
        error: 'Query params "start" and "end" (YYYY-MM-DD) are required.',
        code: 'MISSING_DATE_RANGE',
      });
    }

    const parsedPage  = Math.max(1, parseInt(page)  || 1);
    const parsedLimit = Math.min(1000, Math.max(1, parseInt(limit) || 500));
    const offset      = (parsedPage - 1) * parsedLimit;

    // ── Verify vehicle belongs to org (security scope check) ─
    const vehicleRes = await db.query(
      `SELECT v.id FROM vehicles v
       WHERE v.imei = $1 AND v.org_id = $2`,
      [imei.trim(), orgId]
    );


    if (vehicleRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No vehicle with IMEI "${imei}" found in your organization.`,
        code: 'VEHICLE_NOT_FOUND',
      });
    }

    const vehicleId = vehicleRes.rows[0].id;
    const startTs   = `${start} 00:00:00`;
    const endTs     = `${end} 23:59:59`;

    // ── Count total ─────────────────────────────────────────
    const countRes = await db.query(
      `SELECT COUNT(*) FROM gps_points
       WHERE vehicle_id = $1
         AND device_time BETWEEN $2 AND $3`,
      [vehicleId, startTs, endTs]
    );
    const total = parseInt(countRes.rows[0].count);

    // ── Fetch points ────────────────────────────────────────
    // Join vehicles to get plate + imei for formatting
    const histRes = await db.query(
      `SELECT
         v.imei,
         v.plate,
         gp.lat,
         gp.lng,
         gp.speed,
         gp.direction,
         gp.voltage,
         gp.battery,
         gp.ignition,
         gp.satellites,
         gp.gsm_signal,
         gp.device_time
       FROM gps_points gp
       JOIN vehicles v ON v.id = gp.vehicle_id
       WHERE gp.vehicle_id = $1
         AND gp.device_time BETWEEN $2 AND $3
       ORDER BY gp.device_time ASC
       LIMIT $4 OFFSET $5`,
      [vehicleId, startTs, endTs, parsedLimit, offset]
    );

    const data = histRes.rows.map((row) => formatPoint(row, true));

    return res.status(200).json({
      success: true,
      imei,
      dateRange: { start, end },
      pagination: {
        page:       parsedPage,
        limit:      parsedLimit,
        total,
        totalPages: Math.ceil(total / parsedLimit),
      },
      count: data.length,
      data,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getLiveLocation, postLiveLocation, getHistory };

