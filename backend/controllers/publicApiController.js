// ============================================================
// THIRD-PARTY API CONTROLLER — FuelTracks
// Exposes live location and GPS history to external clients.
// All requests are org-scoped via API key.
//
// CHANGELOG:
//  v2 — Civil Supply integration additions (production-safe, additive only):
//       • postLiveLocation now also accepts vehicleRegistrationNumber / plates
//       • Added postHistory  (POST /api/v1/location/history)
//       • Added getVehicleList (GET /api/v1/vehicles)
//       • All new endpoints respect optional group_id scoping on the API key
// ============================================================

const db = require('../config/db');

// ─── Helpers ────────────────────────────────────────────────

/** Convert a UTC timestamp from PostgreSQL to IST formatted string */
function toIST(utcDate) {
  if (!utcDate) return null;
  const d = new Date(utcDate);
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(d.getTime() + istOffset);
  const pad = (n) => String(n).padStart(2, '0');
  return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())} ${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}:${pad(ist.getUTCSeconds())}`;
}

/** Shape a GPS record into the client-required format */
function formatPoint(row, isHistory) {
  const voltageRaw = parseFloat(row.voltage);
  const batteryRaw = parseFloat(row.battery);

  let gpsSignalQuality = 'none';
  const sats = parseInt(row.satellites) || 0;
  if (sats >= 7)      gpsSignalQuality = 'excellent';
  else if (sats >= 5) gpsSignalQuality = 'good';
  else if (sats >= 3) gpsSignalQuality = 'fair';
  else if (sats >= 1) gpsSignalQuality = 'poor';

  let gpsFix = sats >= 3;

  let accuracy;
  if (sats >= 7)      accuracy = 5;
  else if (sats >= 5) accuracy = 10;
  else if (sats >= 3) accuracy = 25;
  else                accuracy = null;

  const deviceTime = new Date(row.device_time);
  const now = new Date();
  const isOnline = (now - deviceTime) < 5 * 60 * 1000;
  
  const speed = parseFloat(row.speed) || 0;
  const ignitionOn = row.ignition === true || row.ignition === 'true';
  
  let vehicleState = 'Offline';
  if (isOnline) {
    if (speed > 0) vehicleState = 'Moving';
    else if (ignitionOn) vehicleState = 'Idle';
    else vehicleState = 'Stopped';
  }

  return {
    vehicleRegistrationNumber: row.plate || row.name || null,
    imei:                      row.imei,
    speed,
    longitude:                 parseFloat(row.lng),
    latitude:                  parseFloat(row.lat),
    dateTime:                  toIST(row.device_time),
    vehicleBatteryVoltage:     isNaN(voltageRaw) ? null : Math.min(32, Math.max(0, voltageRaw)),
    deviceBatteryVoltage:      isNaN(batteryRaw) ? null : Math.min(6,  Math.max(0, batteryRaw)),
    ignitionOn,
    gpsFix,
    gpsSignalQuality,
    accuracy,
    bearing:                   parseFloat(row.direction) || 0,
    is_online:                 isOnline,
    is_history:                isHistory,
    vehicleState
  };
}

/**
 * Build an optional GROUP scope fragment for SQL queries.
 * If the API key has a group_id attached, restricts results to that group only.
 * Returns { clause: string, params: array } to splice into an existing query.
 *
 * IMPORTANT: pass `startIndex` as the number of params already in the array
 * so placeholder numbering is correct.
 */
function buildGroupScope(groupId, currentParams) {
  if (!groupId) return { clause: '', params: [] };
  const idx = currentParams.length + 1;
  return {
    clause: `AND v.id IN (SELECT vehicle_id FROM vehicle_groups WHERE group_id = $${idx})`,
    params: [groupId],
  };
}

// ─── GET /api/v1/location/live ──────────────────────────────
// (Unchanged from v1 — kept exactly as-is for backward compatibility)
async function getLiveLocation(req, res, next) {
  try {
    const { orgId, groupId } = req.apiOrg;
    const { imei } = req.query;

    let whereImei = '';
    const params = [orgId];

    if (imei) {
      params.push(imei.trim());
      whereImei = `AND v.imei = $${params.length}`;
    }

    const scope = buildGroupScope(groupId, params);
    params.push(...scope.params);

    const result = await db.query(
      `SELECT
         v.imei,
         v.plate,
         v.name,
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
         ${scope.clause}
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
// v2: now also accepts vehicleRegistrationNumber / plates in addition to imei / imeis.
// The client's format: { "user_id": "srsl", "vehicle_id": "WB11E1543" }
// Our format:         { "imei": "..." } | { "imeis": [...] } | { "vehicleRegistrationNumber": "..." } | { "plates": [...] }
async function postLiveLocation(req, res, next) {
  try {
    const { orgId, groupId } = req.apiOrg;
    const { imei, imeis, vehicle_id, vehicleRegistrationNumber, plates } = req.body || {};

    // ── Normalise input into two lists: IMEI list and plate list ──────────────
    let imeiList  = [];
    let plateList = [];

    // IMEI-based lookup
    if (imei)  imeiList  = [String(imei).trim()];
    if (imeis && Array.isArray(imeis)) imeiList = imeis.map((i) => String(i).trim()).filter(Boolean);

    // Plate-based lookup (support both naming conventions from the client's spec)
    const rawPlate = vehicle_id || vehicleRegistrationNumber;
    if (rawPlate)  plateList = [String(rawPlate).trim().toUpperCase()];
    if (plates && Array.isArray(plates)) {
      plateList = plates.map((p) => String(p).trim().toUpperCase()).filter(Boolean);
    }

    if (imeiList.length === 0 && plateList.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Provide one of: "imei", "imeis", "vehicle_id", "vehicleRegistrationNumber", or "plates" in the request body.',
        code: 'MISSING_VEHICLE_IDENTIFIER',
      });
    }

    const totalCount = imeiList.length + plateList.length;
    if (totalCount > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 vehicle identifiers per request.',
        code: 'TOO_MANY_IDENTIFIERS',
      });
    }

    // ── Build query — handles IMEI list, plate list, or both ─────────────────
    const params = [orgId];
    const conditions = [];

    if (imeiList.length > 0) {
      const ph = imeiList.map((_, i) => `$${params.length + i + 1}`).join(', ');
      params.push(...imeiList);
      conditions.push(`v.imei IN (${ph})`);
    }
    if (plateList.length > 0) {
      const ph = plateList.map((_, i) => `$${params.length + i + 1}`).join(', ');
      params.push(...plateList);
      conditions.push(`(UPPER(v.plate) IN (${ph}) OR UPPER(v.name) IN (${ph}))`);
    }

    const vehicleWhere = conditions.length > 0 ? `AND (${conditions.join(' OR ')})` : '';
    const scope = buildGroupScope(groupId, params);
    params.push(...scope.params);

    const result = await db.query(
      `SELECT
         v.imei,
         v.plate,
         v.name,
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
         ${vehicleWhere}
         ${scope.clause}
       ORDER BY v.plate ASC`,
      params
    );

    const data = result.rows.map((row) => formatPoint(row, false));

    // Report back any identifiers that weren't found
    const foundImeis  = new Set(result.rows.map((r) => r.imei));
    const foundPlates = new Set(result.rows.map((r) => (r.plate || r.name || '').toUpperCase()));
    const notFound = [
      ...imeiList.filter((i) => !foundImeis.has(i)),
      ...plateList.filter((p) => !foundPlates.has(p)),
    ];

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
// (Unchanged from v1 — kept exactly as-is for backward compatibility)
async function getHistory(req, res, next) {
  try {
    const { orgId, groupId } = req.apiOrg;
    const { imei, start, end, page = 1, limit = 500 } = req.query;

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

    const vehicleParams = [imei.trim(), orgId];
    const vehicleScope  = buildGroupScope(groupId, vehicleParams);
    vehicleParams.push(...vehicleScope.params);

    const vehicleRes = await db.query(
      `SELECT v.id FROM vehicles v
       WHERE v.imei = $1 AND v.org_id = $2 ${vehicleScope.clause}`,
      vehicleParams
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

    const countRes = await db.query(
      `SELECT COUNT(*) FROM gps_points
       WHERE vehicle_id = $1
         AND device_time BETWEEN $2 AND $3`,
      [vehicleId, startTs, endTs]
    );
    const total = parseInt(countRes.rows[0].count);

    const histRes = await db.query(
      `SELECT
         v.imei,
         v.plate,
         v.name,
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

// ─── POST /api/v1/location/history ──────────────────────────
// NEW in v2 — accepts same params as GET history but via JSON body.
// Supports lookup by imei OR vehicleRegistrationNumber (plate).
async function postHistory(req, res, next) {
  try {
    const { orgId, groupId } = req.apiOrg;
    const {
      imei,
      vehicle_id,
      vehicleRegistrationNumber,
      start,
      end,
      page  = 1,
      limit = 500,
    } = req.body || {};

    // Accept plate from either "vehicle_id" (legacy client format) or "vehicleRegistrationNumber"
    const plate = vehicle_id || vehicleRegistrationNumber;

    if (!imei && !plate) {
      return res.status(400).json({
        success: false,
        error: 'Provide "imei" or "vehicleRegistrationNumber" (vehicle registration number) in the request body.',
        code: 'MISSING_VEHICLE_IDENTIFIER',
      });
    }
    if (!start || !end) {
      return res.status(400).json({
        success: false,
        error: 'Provide "start" and "end" dates in YYYY-MM-DD format.',
        code: 'MISSING_DATE_RANGE',
      });
    }

    const parsedPage  = Math.max(1, parseInt(page)  || 1);
    const parsedLimit = Math.min(1000, Math.max(1, parseInt(limit) || 500));
    const offset      = (parsedPage - 1) * parsedLimit;

    // ── Resolve vehicle by IMEI or plate ─────────────────────
    let vehicleQuery, vehicleParams;
    if (imei) {
      vehicleQuery  = 'SELECT v.id, v.imei, v.plate, v.name FROM vehicles v WHERE v.imei = $1 AND v.org_id = $2';
      vehicleParams = [String(imei).trim(), orgId];
    } else {
      vehicleQuery  = 'SELECT v.id, v.imei, v.plate, v.name FROM vehicles v WHERE (UPPER(v.plate) = $1 OR UPPER(v.name) = $1) AND v.org_id = $2';
      vehicleParams = [String(plate).trim().toUpperCase(), orgId];
    }

    const scope = buildGroupScope(groupId, vehicleParams);
    vehicleParams.push(...scope.params);
    const vehicleRes = await db.query(`${vehicleQuery} ${scope.clause}`, vehicleParams);

    if (vehicleRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Vehicle not found in your organization.`,
        code: 'VEHICLE_NOT_FOUND',
      });
    }

    const vehicle   = vehicleRes.rows[0];
    const vehicleId = vehicle.id;
    const startTs   = `${start} 00:00:00`;
    const endTs     = `${end} 23:59:59`;

    const countRes = await db.query(
      `SELECT COUNT(*) FROM gps_points WHERE vehicle_id = $1 AND device_time BETWEEN $2 AND $3`,
      [vehicleId, startTs, endTs]
    );
    const total = parseInt(countRes.rows[0].count);

    const histRes = await db.query(
      `SELECT
         v.imei,
         v.plate,
         v.name,
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
      vehicleRegistrationNumber: vehicle.plate || null,
      imei: vehicle.imei,
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

// ─── GET /api/v1/vehicles ────────────────────────────────────
// NEW in v2 — returns a directory of all vehicles the client is allowed to see.
// No GPS data — identity info only (IMEI + plate + name).
// Lets the client build their own local mapping table.
async function getVehicleList(req, res, next) {
  try {
    const { orgId, groupId } = req.apiOrg;

    const params = [orgId];
    const scope  = buildGroupScope(groupId, params);
    params.push(...scope.params);

    const result = await db.query(
      `SELECT v.imei, v.plate, v.name
       FROM vehicles v
       WHERE v.org_id = $1
         AND v.is_active = TRUE
         ${scope.clause}
       ORDER BY v.plate ASC`,
      params
    );

    const vehicles = result.rows.map((v) => ({
      vehicleRegistrationNumber: v.plate || null,
      imei:                      v.imei,
      name:                      v.name || null,
    }));

    return res.status(200).json({
      success: true,
      count: vehicles.length,
      vehicles,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getLiveLocation, postLiveLocation, getHistory, postHistory, getVehicleList };
