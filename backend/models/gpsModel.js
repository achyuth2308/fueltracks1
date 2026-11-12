// ============================================================
// GPS MODEL - SQL queries for gps_points, alerts, vehicle_latest_state
// ============================================================

const db = require('../config/db');
const { gpsQuery } = require('../config/db'); // GPS writes use dedicated isolated pool
const { redis } = require('../config/redis');

/**
 * 3-Minute Hysteresis Debounce Filter on GPS points:
 * Absorbs momentary electrical dips (< 3 mins) while running (e.g. borewell pump load / starter drops)
 * and momentary electrical surges (< 3 mins) while parked, preventing false split sessions.
 */
function debounceIgnitionPoints(points) {
  if (!points || points.length <= 1) return points;

  const runs = [];
  let currentRun = {
    status: !!points[0].ignition ? 'ON' : 'OFF',
    points: [points[0]],
    startTime: new Date(points[0].device_time).getTime(),
    endTime: new Date(points[0].device_time).getTime(),
    hasMovement: parseFloat(points[0].speed || 0) > 5
  };

  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    const status = !!p.ignition ? 'ON' : 'OFF';
    const isMoving = parseFloat(p.speed || 0) > 5;
    const pTime = new Date(p.device_time).getTime();

    if (status === currentRun.status) {
      currentRun.points.push(p);
      currentRun.endTime = pTime;
      if (isMoving) currentRun.hasMovement = true;
    } else {
      runs.push(currentRun);
      currentRun = {
        status,
        points: [p],
        startTime: pTime,
        endTime: pTime,
        hasMovement: isMoving
      };
    }
  }
  runs.push(currentRun);

  const DEBOUNCE_MS = 3 * 60 * 1000;

  for (let i = 0; i < runs.length; i++) {
    const prev = runs[i - 1];
    const cur = runs[i];
    const next = runs[i + 1];
    const durationMs = cur.endTime - cur.startTime;

    // Absorb electrical dip < 3 mins while operating
    if (cur.status === 'OFF' && durationMs < DEBOUNCE_MS) {
      if ((prev && prev.status === 'ON') || (next && next.status === 'ON')) {
        cur.status = 'ON';
        cur.points.forEach(p => { p.ignition = true; });
      }
    }
    // Absorb electrical spike < 3 mins while parked
    else if (cur.status === 'ON' && !cur.hasMovement && durationMs < DEBOUNCE_MS) {
      if ((prev && prev.status === 'OFF') || (next && next.status === 'OFF')) {
        cur.status = 'OFF';
        cur.points.forEach(p => { p.ignition = false; });
      }
    }
  }

  const result = [];
  for (const r of runs) {
    for (const p of r.points) {
      result.push(p);
    }
  }
  return result;
}

const GpsModel = {
  /**
   * Save a GPS point (with dedup via ON CONFLICT)
   */
  async savePoint({ vehicleId, lat, lng, speed, direction, odometer, fuel,
                     ignition, satellites, gsmSignal, battery, voltage,
                     isLive, deviceTime }) {
    let safeFuel = null;
    if (fuel != null && !isNaN(fuel)) {
      const numFuel = Number(fuel);
      safeFuel = numFuel > 9999.99 ? 9999.99 : (numFuel < 0 ? 0 : numFuel);
    }

    const result = await gpsQuery(
      `INSERT INTO gps_points
        (vehicle_id, lat, lng, speed, direction, odometer, fuel, ignition,
         satellites, gsm_signal, battery, voltage, is_live, device_time)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (vehicle_id, device_time) DO NOTHING
       RETURNING id`,
      [vehicleId, lat, lng, speed, direction, odometer, safeFuel, ignition,
       satellites, gsmSignal, battery, voltage, isLive, deviceTime]
    );
    return result.rows[0] || null;
  },

  /**
   * Get recent alerts for an organization
   */
  async getRecentAlerts(orgId, limit = 100) {
    const result = await db.query(
      `SELECT a.id, a.vehicle_id as "vehicleId", v.imei, v.name as "vehicleName", v.plate,
              a.alert_type as "alertType", a.alert_text as "alertText", 
              a.lat, a.lng, a.device_time as "deviceTime", a.server_time as "serverTime",
              COALESCE(a.is_read, FALSE) as "isRead"
       FROM alerts a
       JOIN vehicles v ON a.vehicle_id = v.id
       WHERE v.org_id = $1 AND COALESCE(a.is_read, FALSE) = FALSE
       ORDER BY a.server_time DESC
       LIMIT $2`,
      [orgId, limit]
    );
    return result.rows;
  },

  /**
   * Update vehicle latest state (upsert)
   */
  async updateLatestState({ vehicleId, lat, lng, speed, direction, fuel,
                             ignition, voltage, odometer, satellites, gsmSignal, battery }) {
    let safeFuel = null;
    if (fuel != null && !isNaN(fuel)) {
      const numFuel = Number(fuel);
      safeFuel = numFuel > 9999.99 ? 9999.99 : (numFuel < 0 ? 0 : numFuel);
    }

    // Read previous lat/lng and today_distance_date to compute incremental distance.
    // RETURNING today_distance so the caller can include it in the socket emit payload,
    // which fixes the "covered distance always 0.00 km" issue in the mobile app.
    const result = await gpsQuery(
      `INSERT INTO vehicle_latest_state
        (vehicle_id, lat, lng, speed, direction, fuel, ignition, voltage,
         odometer, satellites, gsm_signal, battery, is_online, last_seen,
         today_distance, today_distance_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,TRUE,NOW(), 0,
               (NOW() AT TIME ZONE 'Asia/Kolkata')::date)
       ON CONFLICT (vehicle_id) DO UPDATE SET
        lat = COALESCE($2, vehicle_latest_state.lat),
        lng = COALESCE($3, vehicle_latest_state.lng),
        speed = COALESCE($4, vehicle_latest_state.speed),
        direction = COALESCE($5, vehicle_latest_state.direction),
        fuel = COALESCE($6, vehicle_latest_state.fuel),
        ignition = COALESCE($7, vehicle_latest_state.ignition),
        voltage = COALESCE($8, vehicle_latest_state.voltage),
        odometer = COALESCE($9, vehicle_latest_state.odometer),
        satellites = COALESCE($10, vehicle_latest_state.satellites),
        gsm_signal = COALESCE($11, vehicle_latest_state.gsm_signal),
        battery = COALESCE($12, vehicle_latest_state.battery),
        is_online = TRUE, last_seen = NOW(),
        today_distance_date = CASE
          WHEN vehicle_latest_state.today_distance_date IS DISTINCT FROM (NOW() AT TIME ZONE 'Asia/Kolkata')::date
          THEN (NOW() AT TIME ZONE 'Asia/Kolkata')::date
          ELSE vehicle_latest_state.today_distance_date
        END,
        today_start_odometer = CASE
          WHEN vehicle_latest_state.today_distance_date IS DISTINCT FROM (NOW() AT TIME ZONE 'Asia/Kolkata')::date
          THEN COALESCE($9, vehicle_latest_state.odometer)
          ELSE vehicle_latest_state.today_start_odometer
        END,
        today_distance = CASE
          -- New day — reset counter; the accurate value will be written
          -- by getTodayDistanceFromHistory() called from locationSubscriber
          WHEN vehicle_latest_state.today_distance_date IS DISTINCT FROM (NOW() AT TIME ZONE 'Asia/Kolkata')::date
            THEN 0
          -- Same day but no previous coords — keep existing
          WHEN vehicle_latest_state.lat IS NULL OR vehicle_latest_state.lng IS NULL
            THEN COALESCE(vehicle_latest_state.today_distance, 0)
          -- Same day — add incremental distance only when moving (speed > 3 OR ignition ON)
          -- Segment must be >10 m and <10 km (raised from 5 km to capture longer update intervals)
          ELSE ROUND((COALESCE(vehicle_latest_state.today_distance, 0) + GREATEST(0,
            CASE WHEN (
              6371 * acos(least(1.0,
                cos(radians(vehicle_latest_state.lat)) * cos(radians($2)) *
                cos(radians($3) - radians(vehicle_latest_state.lng)) +
                sin(radians(vehicle_latest_state.lat)) * sin(radians($2))
              )) BETWEEN 0.005 AND 10
            )
            THEN 6371 * acos(least(1.0,
                cos(radians(vehicle_latest_state.lat)) * cos(radians($2)) *
                cos(radians($3) - radians(vehicle_latest_state.lng)) +
                sin(radians(vehicle_latest_state.lat)) * sin(radians($2))
              ))
            ELSE 0
            END
          ))::numeric, 3)
        END
       RETURNING today_distance`,
      [vehicleId, lat, lng, speed, direction, safeFuel, ignition, voltage,
       odometer, satellites, gsmSignal, battery]
    );
    // Return the updated today_distance so it can be emitted via socket
    return parseFloat(result.rows[0]?.today_distance ?? 0);
  },



  /**
   * Get GPS history for a vehicle (paginated)
   */
  async getHistory(vehicleId, { startDate, endDate, page = 1, limit = 100, noCount = false, sample = false, maxPoints = 500 }) {
    const offset = (page - 1) * limit;
    const params = [vehicleId];
    let dateFilter = '';

    if (startDate) {
      params.push(startDate.length === 10 ? `${startDate} 00:00:00` : startDate);
      dateFilter += ` AND device_time >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate.length === 10 ? `${endDate} 23:59:59` : endDate);
      dateFilter += ` AND device_time <= $${params.length}`;
    }

    if (sample) {
      // Smart Downsampling for Analytics / Charts across full time window
      // Guarantees first point (rn=1), last point (rn=total_cnt), and uniformly spaced points in ASC order
      const targetMax = Math.max(100, Math.min(2000, parseInt(maxPoints) || 500));
      params.push(targetMax);

      const sampleSql = `
        WITH ranked AS (
          SELECT id, lat, lng, speed, direction, odometer, fuel, ignition,
                 satellites, gsm_signal, battery, voltage, is_live, device_time, server_time,
                 ROW_NUMBER() OVER (ORDER BY device_time ASC) as rn,
                 COUNT(*) OVER () as total_cnt
          FROM gps_points
          WHERE vehicle_id = $1 ${dateFilter}
        )
        SELECT id, lat, lng, speed, direction, odometer, fuel, ignition,
               satellites, gsm_signal, battery, voltage, is_live, device_time, server_time, total_cnt
        FROM ranked
        WHERE total_cnt <= $${params.length}
           OR rn = 1 
           OR rn = total_cnt 
           OR rn % GREATEST(1, (total_cnt / $${params.length})) = 0
        ORDER BY device_time ASC;
      `;

      const result = await db.query(sampleSql, params);
      const totalPoints = result.rows.length > 0 ? parseInt(result.rows[0].total_cnt || 0) : 0;

      return {
        points: result.rows,
        pagination: {
          page: 1,
          limit: result.rows.length,
          total: totalPoints,
          totalPages: 1
        }
      };
    }

    // Default paginated behavior
    let total = 0;
    if (!noCount) {
      const countResult = await db.query(
        `SELECT COUNT(*) FROM gps_points
         WHERE vehicle_id = $1 ${dateFilter}`,
        params
      );
      total = parseInt(countResult.rows[0].count);
    }

    // Fetch
    params.push(limit, offset);
    const result = await db.query(
      `SELECT id, lat, lng, speed, direction, odometer, fuel, ignition,
              satellites, gsm_signal, battery, voltage, is_live, device_time, server_time
       FROM gps_points
       WHERE vehicle_id = $1 ${dateFilter}
       ORDER BY device_time DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return {
      points: result.rows,
      pagination: {
        page,
        limit,
        total: total || result.rows.length,
        totalPages: total ? Math.ceil(total / limit) : 1,
      },
    };
  },

  /**
   * Get route data (lat, lng, time, speed) for polyline drawing
   * Returns ALL points in chronological order (no pagination for route)
   */
  async getRoute(vehicleId, { startDate, endDate }) {
    const params = [vehicleId];
    let dateFilter = '';

    if (startDate) {
      params.push(startDate.length === 10 ? `${startDate} 00:00:00` : startDate);
      dateFilter += ` AND device_time >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate.length === 10 ? `${endDate} 23:59:59` : endDate);
      dateFilter += ` AND device_time <= $${params.length}`;
    }

    const result = await db.query(
      `SELECT lat, lng, speed, fuel, ignition, odometer, direction, battery, voltage, device_time
       FROM gps_points
       WHERE vehicle_id = $1 ${dateFilter}
       ORDER BY device_time ASC
       LIMIT 20000`, // Hard limit to prevent Node.js Out-Of-Memory crashes
      params
    );

    return result.rows;
  },

  /**
   * Compute today's travel distance for a vehicle from gps_points using
   * the EXACT SAME algorithm as the History page (anomaly filter + drift filter
   * + Haversine segments >10m and <5km). Writes the result back to vehicle_latest_state
   * so that the Dashboard "Today Distance" matches the History page exactly.
   *
   * @param {number|string} vehicleId
   * @returns {number} today_distance in km (3 decimal places)
   */
  async getTodayDistanceFromHistory(vehicleId) {
    // 1. Calculate today's start and end boundaries in Asia/Kolkata (IST = UTC+5:30) converted to UTC
    const now = new Date();
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffsetMs);
    const istYear = istNow.getUTCFullYear();
    const istMonth = istNow.getUTCMonth();
    const istDate = istNow.getUTCDate();

    // 00:00:00.000 IST converted to UTC ISO string
    const istStartUtc = new Date(Date.UTC(istYear, istMonth, istDate, 0, 0, 0) - istOffsetMs).toISOString();
    // 23:59:59.999 IST converted to UTC ISO string (+ 10 min margin for device clock skew)
    const istEndUtc = new Date(Date.UTC(istYear, istMonth, istDate, 23, 59, 59, 999) - istOffsetMs + (10 * 60 * 1000)).toISOString();

    // 2. Fetch all of today's points ordered chronologically
    const result = await gpsQuery(
      `SELECT lat, lng, speed, ignition, device_time
       FROM gps_points
       WHERE vehicle_id = $1
         AND device_time >= $2
         AND device_time <= $3
         AND lat IS NOT NULL AND lng IS NOT NULL
         AND lat != 0 AND lng != 0
         AND lat BETWEEN 6.0 AND 38.0
         AND lng BETWEEN 65.0 AND 100.0
       ORDER BY device_time ASC`,
      [vehicleId, istStartUtc, istEndUtc]
    );

    const rows = result.rows;
    if (rows.length < 2) return 0;

    // Haversine formula in km
    function calcDist(lat1, lon1, lat2, lon2) {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // 3. Anomaly Filter: Removes LBS teleports and GPS jumps (identical to HistoryPage.jsx lines 244-285)
    const anomalyFiltered = [];
    let consecutiveRejects = 0;
    for (let i = 0; i < rows.length; i++) {
      const p = rows[i];
      if (anomalyFiltered.length === 0) {
        anomalyFiltered.push(p);
        continue;
      }
      const prev = anomalyFiltered[anomalyFiltered.length - 1];
      const dist = calcDist(parseFloat(prev.lat), parseFloat(prev.lng), parseFloat(p.lat), parseFloat(p.lng));
      const timeDiffMin = (new Date(p.device_time).getTime() - new Date(prev.device_time).getTime()) / 60000;
      const impliedSpeedKmph = timeDiffMin > 0 ? (dist / (timeDiffMin / 60)) : (dist > 0.05 ? Infinity : 0);

      const isImpossible = (impliedSpeedKmph > 150 && dist > 0.2) || (impliedSpeedKmph > 80 && (parseFloat(p.speed) || 0) < 20 && dist > 0.5);

      if (isImpossible) {
        if (anomalyFiltered.length >= 2) {
          const prevPrev = anomalyFiltered[anomalyFiltered.length - 2];
          const distPrevPrev = calcDist(parseFloat(prevPrev.lat), parseFloat(prevPrev.lng), parseFloat(p.lat), parseFloat(p.lng));
          const timeDiffPrevPrev = (new Date(p.device_time).getTime() - new Date(prevPrev.device_time).getTime()) / 60000;
          const speedPrevPrev = timeDiffPrevPrev > 0 ? (distPrevPrev / (timeDiffPrevPrev / 60)) : (distPrevPrev > 0.05 ? Infinity : 0);

          if (speedPrevPrev < 150) {
            anomalyFiltered.pop();
            anomalyFiltered.push(p);
            consecutiveRejects = 0;
            continue;
          }
        }

        consecutiveRejects++;
        if (consecutiveRejects > 3) {
          anomalyFiltered.push(p);
          consecutiveRejects = 0;
        }
        continue;
      }

      consecutiveRejects = 0;
      anomalyFiltered.push(p);
    }

    // 4. Static Drift Filter: Removes stationary GPS starburst clusters (identical to HistoryPage.jsx lines 289-309)
    const driftFiltered = [];
    let lastValid = null;
    for (const p of anomalyFiltered) {
      if (!lastValid) {
        driftFiltered.push(p);
        lastValid = p;
        continue;
      }
      const distKm = calcDist(parseFloat(lastValid.lat), parseFloat(lastValid.lng), parseFloat(p.lat), parseFloat(p.lng));
      const timeDiffMin = (new Date(p.device_time).getTime() - new Date(lastValid.device_time).getTime()) / 60000;

      if (distKm >= 0.005 || (p.speed && parseFloat(p.speed) > 0) || p.ignition || timeDiffMin >= 3) {
        driftFiltered.push(p);
        lastValid = p;
      }
    }

    // 5. Haversine accumulation: Segments >10m and <5km (identical to HistoryPage.jsx lines 314-322)
    let totalKm = 0;
    for (let i = 1; i < driftFiltered.length; i++) {
      const prev = driftFiltered[i - 1];
      const curr = driftFiltered[i];
      const segDist = calcDist(
        parseFloat(prev.lat), parseFloat(prev.lng),
        parseFloat(curr.lat), parseFloat(curr.lng)
      );

      if (segDist > 0.01 && segDist < 5) {
        totalKm += segDist;
      }
    }

    const finalKm = parseFloat(totalKm.toFixed(3));

    // 6. Write back to vehicle_latest_state with today's date so dashboard reads matching value
    await gpsQuery(
      `UPDATE vehicle_latest_state
       SET today_distance = $2,
           today_distance_date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
       WHERE vehicle_id = $1`,
      [vehicleId, finalKm]
    );

    return finalKm;
  },

  /**
   * Get daily report data for a vehicle
   */
  async getReport(vehicleId, { startDate, endDate }) {
    const params = [vehicleId];
    let dateFilter = '';

    if (startDate) {
      params.push(startDate.length === 10 ? `${startDate} 00:00:00` : startDate);
      dateFilter += ` AND device_time >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate.length === 10 ? `${endDate} 23:59:59` : endDate);
      dateFilter += ` AND device_time <= $${params.length}`;
    }

    // Daily aggregated stats
    const result = await db.query(
      `SELECT
        DATE(device_time) as date,
        COUNT(*) as total_points,
        ROUND(AVG(speed)::numeric, 1) as avg_speed,
        MAX(speed) as max_speed,
        MIN(CASE WHEN fuel > 0 THEN fuel END)::numeric as min_fuel,
        MAX(fuel)::numeric as max_fuel,
        MAX(odometer) - MIN(NULLIF(odometer, 0)) as distance_km,
        SUM(CASE WHEN ignition = TRUE THEN 1 ELSE 0 END) as ignition_on_count,
        MIN(device_time) as first_point,
        MAX(device_time) as last_point
       FROM gps_points
       WHERE vehicle_id = $1 ${dateFilter}
       GROUP BY DATE(device_time)
       ORDER BY date DESC`,
      params
    );

    // Summary
    const summaryResult = await db.query(
      `SELECT
        COUNT(*) as total_points,
        ROUND(AVG(speed)::numeric, 1) as avg_speed,
        MAX(speed) as max_speed,
        MAX(odometer) - MIN(NULLIF(odometer, 0)) as total_distance,
        MIN(CASE WHEN fuel > 0 THEN fuel END)::numeric as min_fuel,
        MAX(fuel)::numeric as max_fuel,
        MIN(device_time) as start_time,
        MAX(device_time) as end_time
       FROM gps_points
       WHERE vehicle_id = $1 ${dateFilter}`,
      params
    );

    return {
      daily: result.rows,
      summary: summaryResult.rows[0],
    };
  },

  /**
   * Helper: Debounces historical GPS points with a 3-minute hysteresis window.
   * Absorbs momentary voltage drops (< 3 mins) while running and momentary spikes (< 3 mins) while parked.
   */
  debounceIgnitionPoints(points) {
    return debounceIgnitionPoints(points);
  },

  /**
   * Get ignition report (ON/OFF events, intervals and summaries)
   */
  async getIgnitionReport(vehicleId, { startDate, endDate }) {
    // 1. Fetch vehicle details & organization
    const vehicleRes = await db.query(
      `SELECT v.id, v.name, v.plate, v.metadata, o.name as org_name
       FROM vehicles v
       LEFT JOIN organizations o ON v.org_id = o.id
       WHERE v.id = $1`,
      [vehicleId]
    );
    const vehicle = vehicleRes.rows[0] || {};
    const metadata = vehicle.metadata || {};

    const engineOnDetection = metadata.engineOnStatus || metadata.engineOn || 'Voltage + Ignition ( 12.8 )';
    const vehicleGroup = vehicle.org_name || 'Fleet';

    const params = [vehicleId];
    let dateFilter = '';
    if (startDate) {
      params.push(startDate.length === 10 ? `${startDate} 00:00:00` : startDate);
      dateFilter += ` AND device_time >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate.length === 10 ? `${endDate} 23:59:59` : endDate);
      dateFilter += ` AND device_time <= $${params.length}`;
    }

    // Get all points to calculate intervals & events
    const result = await db.query(
      `SELECT lat, lng, speed, ignition, odometer, device_time
       FROM gps_points
       WHERE vehicle_id = $1 ${dateFilter}
       ORDER BY device_time ASC`,
      params
    );

    // 3-Minute Hysteresis Debounce Filter:
    // Absorbs momentary electrical dips (< 3 mins) while running (e.g. borewell pump load / starter drops)
    // and momentary electrical surges (< 3 mins) while parked, preventing false split sessions.
    const rawPoints = result.rows;
    const points = debounceIgnitionPoints(rawPoints);
    const events = [];
    const intervals = [];
    let currentOnSession = null;
    let currentInterval = null;
    let topSpeed = 0;
    let topSpeedTime = null;
    let totalDistance = 0;
    let minOdo = null;
    let maxOdo = null;

    let prevStatus = null;
    let totalRunningMs = 0;
    let totalParkedMs = 0;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const speed = parseFloat(p.speed || 0);
      const isIgnitionOn = !!p.ignition;
      const odo = parseFloat(p.odometer || 0);

      if (speed > topSpeed) {
        topSpeed = speed;
        topSpeedTime = p.device_time;
      }

      if (odo > 0) {
        if (minOdo === null || odo < minOdo) minOdo = odo;
        if (maxOdo === null || odo > maxOdo) maxOdo = odo;
      }

      const status = isIgnitionOn ? 'ON' : 'OFF';

      if (prevStatus === null || prevStatus !== status) {
        if (status === 'ON') {
          currentOnSession = {
            startTime: p.device_time,
            startLat: p.lat,
            startLng: p.lng
          };
          events.push({
            time: p.device_time,
            status: 'ON',
            durationMs: null,
            lat: p.lat,
            lng: p.lng
          });
        } else {
          let durMs = 0;
          if (currentOnSession) {
            durMs = Math.max(0, new Date(p.device_time).getTime() - new Date(currentOnSession.startTime).getTime());
            totalRunningMs += durMs;
            intervals.push({
              status: 'ON',
              startTime: currentOnSession.startTime,
              endTime: p.device_time,
              durationMs: durMs,
              startLat: currentOnSession.startLat,
              startLng: currentOnSession.startLng,
              endLat: p.lat,
              endLng: p.lng
            });
            events.push({
              time: p.device_time,
              status: 'OFF',
              durationMs: durMs,
              lat: p.lat,
              lng: p.lng
            });
          }
          currentOnSession = null;
        }
        prevStatus = status;
      }
    }

    if (currentOnSession && points.length > 0) {
      const lastP = points[points.length - 1];
      const durMs = Math.max(0, new Date(lastP.device_time).getTime() - new Date(currentOnSession.startTime).getTime());
      totalRunningMs += durMs;
      intervals.push({
        status: 'ON',
        startTime: currentOnSession.startTime,
        endTime: lastP.device_time,
        durationMs: durMs,
        startLat: currentOnSession.startLat,
        startLng: currentOnSession.startLng,
        endLat: lastP.lat,
        endLng: lastP.lng
      });
      for (let j = events.length - 1; j >= 0; j--) {
        if (events[j].status === 'ON' && events[j].durationMs === null) {
          events[j].durationMs = durMs;
          break;
        }
      }
    }

    if (minOdo !== null && maxOdo !== null) {
      totalDistance = Math.max(0, maxOdo - minOdo);
    }

    // Also build backward compatible intervals array for existing code
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const isIgnitionOn = !!p.ignition;
      if (!currentInterval) {
        currentInterval = {
          status: isIgnitionOn ? 'ON' : 'OFF',
          startTime: p.device_time,
          startLat: p.lat,
          startLng: p.lng,
          endTime: p.device_time
        };
      } else if (currentInterval.status !== (isIgnitionOn ? 'ON' : 'OFF')) {
        currentInterval.endTime = p.device_time;
        currentInterval.durationMs = new Date(currentInterval.endTime).getTime() - new Date(currentInterval.startTime).getTime();
        currentInterval = {
          status: isIgnitionOn ? 'ON' : 'OFF',
          startTime: p.device_time,
          startLat: p.lat,
          startLng: p.lng,
          endTime: p.device_time
        };
      } else {
        currentInterval.endTime = p.device_time;
      }
    }

    return {
      vehicleInfo: {
        id: vehicle.id,
        name: vehicle.name || 'N/A',
        plate: vehicle.plate || 'N/A',
        vehicleGroup: vehicleGroup,
        engineOnDetection: engineOnDetection
      },
      events: events,
      intervals: intervals,
      summary: {
        topSpeed,
        topSpeedTime,
        totalDistance: totalDistance.toFixed(2),
        totalRunningMs,
        totalParkedMs,
        totalEvents: events.length
      }
    };
  },

  /**
   * Save an alert
   */
  async saveAlert({ vehicleId, alertType, alertText, lat, lng, deviceTime }) {
    const result = await db.query(
      `INSERT INTO alerts (vehicle_id, alert_type, alert_text, lat, lng, device_time)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [vehicleId, alertType, alertText, lat, lng, deviceTime]
    );
    return result.rows[0];
  },

  /**
   * Background update of alert address without throwing
   */
  async updateAlertAddress(alertId, address) {
    try {
      // Append address to alert_text if not already present
      await db.query(
        `UPDATE alerts SET alert_text = alert_text || ' - ' || $2 WHERE id = $1`,
        [alertId, address]
      );
    } catch (err) {
      console.warn('[DB] Failed to update alert address:', err.message);
    }
  },

  /**
   * Get alerts for a vehicle (paginated)
   */
  async getAlerts(vehicleId, { page = 1, limit = 50, alertType } = {}) {
    const offset = (page - 1) * limit;
    const params = [vehicleId];
    let typeFilter = '';
    if (alertType) {
      const typeStr = alertType.toLowerCase();
      if (typeStr === 'geofence') {
        typeFilter = ` AND alert_type IN ('geofence', 'geofence_enter', 'geofence_exit', 'geofenceenter', 'geofenceexit')`;
      } else if (typeStr === 'ignition') {
        typeFilter = ` AND alert_type IN ('ignition', 'ignition_on', 'ignition_off', 'moving', 'start_moving', 'trip_started', 'trip_ended', 'stopped', 'idle', 'stoppage')`;
      } else if (typeStr === 'sos') {
        typeFilter = ` AND alert_type IN ('sos', 'panic', 'theft', 'theft_alarm', 'tamper', 'tow', 'crash', 'accident')`;
      } else if (typeStr === 'power' || typeStr === 'power_cut') {
        typeFilter = ` AND alert_type IN ('power', 'power_cut', 'power_disconnected', 'main_battery_disconnected', 'main_battery_connected', 'battery')`;
      } else if (typeStr === 'harsh') {
        typeFilter = ` AND alert_type IN ('harsh', 'harsh_driving', 'harsh_braking', 'harsh_acceleration')`;
      } else {
        params.push(typeStr);
        typeFilter = ` AND alert_type = $${params.length}`;
      }
    }

    const countResult = await db.query(
      `SELECT COUNT(*) FROM alerts WHERE vehicle_id = $1 ${typeFilter}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const result = await db.query(
      `SELECT a.id, a.vehicle_id as "vehicleId", v.name as "vehicleName", v.plate, v.imei,
              a.alert_type as "alertType", a.alert_text as "alertText",
              a.lat, a.lng, a.device_time as "deviceTime", a.server_time as "serverTime",
              COALESCE(a.is_read, FALSE) as "isRead"
       FROM alerts a
       JOIN vehicles v ON a.vehicle_id = v.id
       WHERE a.vehicle_id = $1 ${typeFilter}
       ORDER BY a.device_time DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return {
      alerts: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Save raw packet for debugging
   */
  async saveRawPacket(imei, raw, parsed = true, error = null) {
    const sampleRate = parseInt(process.env.RAW_LOG_SAMPLE_RATE) || 1;
    if (sampleRate > 1 && Math.random() > (1 / sampleRate)) {
      return; // Skip logging this packet
    }

    await db.query(
      `INSERT INTO raw_packets (imei, raw, parsed, error) VALUES ($1, $2, $3, $4)`,
      [imei, raw, parsed, error]
    );
  },

  /**
   * Save raw packet with extended metadata for Sensor Data logs.
   * Strips null bytes (0x00) from string fields to prevent PostgreSQL UTF-8 errors.
   */
  async saveRawPacketWithMetadata({ imei, raw, packetType, deviceTime, odometer, rawHex, parsedJson, parsed = true, error = null }) {
    if (!imei) return;
    const sampleRate = parseInt(process.env.RAW_LOG_SAMPLE_RATE) || 1;
    if (sampleRate > 1 && Math.random() > (1 / sampleRate)) {
      return; // Skip logging this packet
    }

    // PostgreSQL TEXT columns reject null bytes — strip them from every string field
    const sanitizeStr = (v) => (typeof v === 'string' ? v.replace(/\0/g, '') : (v == null ? null : String(v)));
    const cleanRaw = sanitizeStr(rawHex || raw);
    const cleanPacketType = sanitizeStr(packetType || 'DATA');
    const safeDeviceTime = deviceTime && !isNaN(new Date(deviceTime).getTime()) ? new Date(deviceTime) : new Date();
    const safeOdometer = odometer !== null && odometer !== undefined && !isNaN(Number(odometer)) ? Math.round(Number(odometer)) : 0;
    const parsedDataJson = parsedJson ? (typeof parsedJson === 'object' ? JSON.stringify(parsedJson) : String(parsedJson)) : null;
    const isParsed = parsed !== false;
    const cleanError = sanitizeStr(error);

    try {
      await db.query(
        `INSERT INTO raw_packets 
         (imei, raw, parsed, packet_type, device_time, odometer, raw_hex, parsed_data, error) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          sanitizeStr(imei),
          cleanRaw,
          isParsed,
          cleanPacketType,
          safeDeviceTime,
          safeOdometer,
          cleanRaw,
          parsedDataJson,
          cleanError
        ]
      );
    } catch (err) {
      // Safe fallback if extended columns have issues
      try {
        await db.query(
          `INSERT INTO raw_packets (imei, raw, parsed, error) VALUES ($1, $2, $3, $4)`,
          [sanitizeStr(imei), cleanRaw, isParsed, cleanError]
        );
      } catch (fallbackErr) {
        console.error('[DB] saveRawPacket fallback error:', fallbackErr.message);
      }
    }
  },

  /**
   * Get raw messages for Sensor Data page
   */
  async getRawMessages(imei, { page = 1, limit = 100, date = null, startDate = null, endDate = null, startTime = null, endTime = null, from = null, to = null }) {
    if (!imei) {
      return { messages: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 1 } };
    }
    const offset = (page - 1) * limit;

    let whereClause = `WHERE imei = $1`;
    const params = [imei];
    let paramIdx = 2;

    if (date) {
      whereClause += ` AND (DATE(COALESCE(device_time, received_at) + interval '5 hours 30 minutes') = $${paramIdx}::date OR DATE(received_at + interval '5 hours 30 minutes') = $${paramIdx}::date)`;
      params.push(date);
      paramIdx++;
    }

    const countResult = await db.query(
      `SELECT COUNT(*) FROM raw_packets ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.count || 0);

    const queryParams = [...params, limit, offset];
    const result = await db.query(
      `SELECT id, imei, raw, parsed, error, received_at,
              COALESCE(packet_type, 'DATA') as packet_type,
              COALESCE(device_time, received_at) as device_time,
              COALESCE(odometer, 0) as odometer,
              COALESCE(raw_hex, raw) as raw_hex,
              parsed_data,
              COALESCE(
                CASE WHEN parsed_data->>'lat' ~ '^-?[0-9]+\.?[0-9]*$' THEN (parsed_data->>'lat')::numeric ELSE NULL END,
                NULL
              ) as lat,
              COALESCE(
                CASE WHEN parsed_data->>'lng' ~ '^-?[0-9]+\.?[0-9]*$' THEN (parsed_data->>'lng')::numeric ELSE NULL END,
                CASE WHEN parsed_data->>'lon' ~ '^-?[0-9]+\.?[0-9]*$' THEN (parsed_data->>'lon')::numeric ELSE NULL END,
                NULL
              ) as lng,
              COALESCE(
                CASE WHEN parsed_data->>'speed' ~ '^[0-9]+\.?[0-9]*$' THEN (parsed_data->>'speed')::numeric ELSE NULL END,
                0
              ) as speed,
              COALESCE(
                CASE WHEN parsed_data->>'fuel' ~ '^[0-9]+\.?[0-9]*$' THEN (parsed_data->>'fuel')::numeric ELSE NULL END,
                CASE WHEN parsed_data->>'fuelLevel' ~ '^[0-9]+\.?[0-9]*$' THEN (parsed_data->>'fuelLevel')::numeric ELSE NULL END,
                NULL
              ) as fuel,
              COALESCE(
                CASE WHEN parsed_data->>'voltage' ~ '^[0-9]+\.?[0-9]*$' THEN (parsed_data->>'voltage')::numeric ELSE NULL END,
                CASE WHEN parsed_data->>'mainVoltage' ~ '^[0-9]+\.?[0-9]*$' THEN (parsed_data->>'mainVoltage')::numeric ELSE NULL END,
                CASE WHEN parsed_data->>'battVoltage' ~ '^[0-9]+\.?[0-9]*$' THEN (parsed_data->>'battVoltage')::numeric ELSE NULL END,
                NULL
              ) as voltage,
              COALESCE(
                CASE 
                  WHEN parsed_data->>'ignition' IN ('true', '1', 't') THEN true
                  WHEN parsed_data->>'ignition' IN ('false', '0', 'f') THEN false
                  ELSE NULL 
                END,
                NULL
              ) as ignition
       FROM raw_packets
       ${whereClause}
       ORDER BY received_at DESC, id DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      queryParams
    );

    // Fallback extraction helper for raw packet string
    const extractPacketFallback = (rawStr) => {
      if (!rawStr || typeof rawStr !== 'string') return {};
      const trimmed = rawStr.trim();
      // Volty semicolon-delimited packet
      if (trimmed.includes(';') && (trimmed.includes('VLT') || trimmed.includes('DL1') || trimmed.includes('M1.'))) {
        const parts = trimmed.replace(/\*/g, '').split(';');
        const imeiIdx = parts.findIndex(p => /^\d{14,16}$/.test(p.trim()));
        if (imeiIdx !== -1) {
          const ignVal = parts[imeiIdx + 16] ? parts[imeiIdx + 16].trim() : '';
          const voltVal = parts[imeiIdx + 18] ? parts[imeiIdx + 18].trim() : (parts[imeiIdx + 17] ? parts[imeiIdx + 17].trim() : '');
          return {
            ignition: ignVal === '1' ? true : (ignVal === '0' ? false : null),
            voltage: voltVal && !isNaN(parseFloat(voltVal)) ? parseFloat(voltVal) : null
          };
        }
      }
      // AIS140 / BSTPL comma-delimited packets
      if (trimmed.includes(',')) {
        const parts = trimmed.replace(/\*/g, '').split(',');
        if (parts[0] === '$10' || parts[0] === '$11') {
          const ignVal = parts[9];
          const voltVal = parts[10];
          return {
            ignition: ignVal === '1' ? true : (ignVal === '0' ? false : null),
            voltage: voltVal && !isNaN(parseFloat(voltVal)) ? parseFloat(voltVal) : null
          };
        }
      }
      return {};
    };

    const enrichedMessages = result.rows.map(row => {
      let voltage = row.voltage != null ? parseFloat(row.voltage) : null;
      let ignition = row.ignition != null ? (row.ignition === true || row.ignition === 'true' || row.ignition === 1) : null;

      if (voltage == null || ignition == null) {
        const fallback = extractPacketFallback(row.raw_hex || row.raw);
        if (voltage == null && fallback.voltage != null) voltage = fallback.voltage;
        if (ignition == null && fallback.ignition != null) ignition = fallback.ignition;
      }

      const speed = row.speed != null ? parseFloat(row.speed) : 0;
      let engine_status = null;
      if (speed > 2.0) {
        engine_status = 'ON (Moving)';
      } else if (ignition === true) {
        engine_status = 'ON (Idle)';
      } else if (ignition === false) {
        engine_status = 'OFF';
      }

      return {
        ...row,
        voltage,
        ignition,
        engine_status
      };
    });

    return {
      messages: enrichedMessages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  },

  /**
   * Get paginated alerts for an org (user-facing history feed)
   */
  async getAlertsForOrg(orgId, { page = 1, limit = 50, alertType, role, userId } = {}) {
    // 1. Try Redis cache for default fetch
    const redisKey = `org:alerts:${orgId}`;
    if (page === 1 && !alertType && limit <= 50 && role !== 'customer') {
      try {
        const cached = await redis.lrange(redisKey, 0, limit - 1);
        if (cached && cached.length > 0) {
          return {
            alerts: cached.map(JSON.parse),
            pagination: { page: 1, limit, total: -1, totalPages: 1 }, // approximated for cache
          };
        }
      } catch (err) {
        console.warn('[REDIS] Alert cache read failed:', err.message);
      }
    }

    const offset = (page - 1) * limit;
    const params = [orgId];
    let typeFilter = '';
    
    // Add user filter
    let userFilter = '';
    if (role === 'customer' && userId) {
      params.push(userId);
      userFilter = ` AND EXISTS (SELECT 1 FROM vehicle_groups vg JOIN user_groups ug ON vg.group_id = ug.group_id WHERE vg.vehicle_id = v.id AND ug.user_id = $${params.length})`;
    }

    if (alertType) {
      const typeStr = alertType.toLowerCase();
      if (typeStr === 'geofence') {
        typeFilter = ` AND a.alert_type IN ('geofence', 'geofence_enter', 'geofence_exit', 'geofenceenter', 'geofenceexit')`;
      } else if (typeStr === 'ignition') {
        typeFilter = ` AND a.alert_type IN ('ignition', 'ignition_on', 'ignition_off', 'moving', 'start_moving', 'trip_started', 'trip_ended', 'stopped', 'idle', 'stoppage')`;
      } else if (typeStr === 'sos') {
        typeFilter = ` AND a.alert_type IN ('sos', 'panic', 'theft', 'theft_alarm', 'tamper', 'tow', 'crash', 'accident')`;
      } else if (typeStr === 'power' || typeStr === 'power_cut') {
        typeFilter = ` AND a.alert_type IN ('power', 'power_cut', 'power_disconnected', 'main_battery_disconnected', 'main_battery_connected', 'battery')`;
      } else if (typeStr === 'harsh') {
        typeFilter = ` AND a.alert_type IN ('harsh', 'harsh_driving', 'harsh_braking', 'harsh_acceleration')`;
      } else {
        params.push(typeStr);
        typeFilter = ` AND a.alert_type = $${params.length}`;
      }
    }

    const countResult = await db.query(
      `SELECT COUNT(*) FROM alerts a
       JOIN vehicles v ON a.vehicle_id = v.id
       WHERE v.org_id = $1 ${userFilter} ${typeFilter}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const result = await db.query(
      `SELECT a.id, a.vehicle_id as "vehicleId", v.name as "vehicleName", v.plate, v.imei,
              a.alert_type as "alertType", a.alert_text as "alertText",
              a.lat, a.lng, a.device_time as "deviceTime", a.server_time as "serverTime",
              COALESCE(a.is_read, FALSE) as "isRead"
       FROM alerts a
       JOIN vehicles v ON a.vehicle_id = v.id
       WHERE v.org_id = $1 ${userFilter} ${typeFilter}
       ORDER BY a.server_time DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    // 2. Populate Redis cache on miss
    if (page === 1 && !alertType && result.rows.length > 0 && role !== 'customer') {
      try {
        const pipeline = redis.pipeline();
        pipeline.del(redisKey);
        result.rows.slice(0, 50).forEach(alert => {
          pipeline.rpush(redisKey, JSON.stringify(alert));
        });
        pipeline.expire(redisKey, 86400); // 24h
        await pipeline.exec();
      } catch (err) {
        console.warn('[REDIS] Alert cache write failed:', err.message);
      }
    }

    return {
      alerts: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  /**
   * Mark a single alert as read
   */
  async markAlertRead(alertId, orgId) {
    let query, params;
    if (orgId) {
      query = `UPDATE alerts SET is_read = TRUE WHERE id = $1 AND vehicle_id IN (SELECT id FROM vehicles WHERE org_id = $2) RETURNING id`;
      params = [alertId, orgId];
    } else {
      query = `UPDATE alerts SET is_read = TRUE WHERE id = $1 RETURNING id, (SELECT org_id FROM vehicles WHERE id = vehicle_id) as v_org`;
      params = [alertId];
    }
    const result = await db.query(query, params);

    if (result.rows.length > 0) {
      try {
        const targetOrgId = orgId || result.rows[0].v_org;
        if (targetOrgId) await redis.del(`org:alerts:${targetOrgId}`);
      } catch (err) {
        console.warn('[REDIS] Alert cache invalidation failed:', err.message);
      }
    }

    return result.rows[0] || null;
  },

  /**
   * Mark all alerts as read for an org
   */
  async markAllAlertsRead(orgId) {
    let query, params;
    if (orgId) {
      query = `UPDATE alerts SET is_read = TRUE WHERE vehicle_id IN (SELECT id FROM vehicles WHERE org_id = $1) AND COALESCE(is_read, FALSE) = FALSE RETURNING id`;
      params = [orgId];
    } else {
      query = `UPDATE alerts SET is_read = TRUE WHERE COALESCE(is_read, FALSE) = FALSE RETURNING id`;
      params = [];
    }
    const result = await db.query(query, params);

    if (result.rows.length > 0 && orgId) {
      try {
        await redis.del(`org:alerts:${orgId}`);
      } catch (err) {
        console.warn('[REDIS] Alert cache invalidation failed:', err.message);
      }
    }

    return result.rowCount;
  },

  /**
   * Get user alert preferences (returns defaults if not set)
   */
  async getUserAlertPreferences(userId) {
    // 1. Try to fetch from Redis Cache
    const redisKey = `user:preferences:${userId}`;
    try {
      const cached = await redis.get(redisKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      console.warn('[REDIS] Failed to get user preferences from cache:', err.message);
    }

    // 2. Fallback to Database
    const result = await db.query(
      `SELECT preferences FROM user_alert_preferences WHERE user_id = $1`,
      [userId]
    );

    let preferences = null;
    if (result.rows[0]) {
      preferences = result.rows[0].preferences;
    } else {
      // Return default preferences
      preferences = {
        sos: true, panic: true, crash: true, accident: true,
        tow: true, power_cut: true, theft: true, theft_alarm: true,
        safety_park: true,
        overspeed: true, harsh_braking: true, harsh_acceleration: true,
        geofence_enter: true, geofence_exit: true, low_battery: true,
        ignition_on: true, ignition_off: true, idle: false,
        parking: true, trip_started: false, stopped: false, moving: true,
        idle_duration_mins: 60, parking_duration_mins: 60, moving_duration_mins: 60,
      };
    }

    // 3. Save to Redis Cache (expire in 24 hours to keep fresh)
    try {
      await redis.set(redisKey, JSON.stringify(preferences), 'EX', 86400);
    } catch (err) {
      console.warn('[REDIS] Failed to cache user preferences:', err.message);
    }

    return preferences;
  },

  /**
   * Upsert user alert preferences
   */
  async upsertUserAlertPreferences(userId, preferences) {
    const result = await db.query(
      `INSERT INTO user_alert_preferences (user_id, preferences, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET preferences = $2, updated_at = NOW()
       RETURNING preferences`,
      [userId, JSON.stringify(preferences)]
    );

    // Update Redis Cache instantly
    const redisKey = `user:preferences:${userId}`;
    try {
      await redis.set(redisKey, JSON.stringify(result.rows[0].preferences), 'EX', 86400);
    } catch (err) {
      console.warn('[REDIS] Failed to update user preferences cache:', err.message);
    }

    return result.rows[0].preferences;
  },

  /**
   * Register or update an FCM token for a user
   */
  async registerFcmToken(userId, fcmToken, deviceInfo = {}) {
    await db.query(
      `INSERT INTO user_fcm_tokens (user_id, fcm_token, device_info, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, fcm_token) DO UPDATE SET device_info = $3, updated_at = NOW()`,
      [userId, fcmToken, JSON.stringify(deviceInfo)]
    );
  },

  /**
   * Remove an FCM token (logout / token refresh)
   */
  async removeFcmToken(userId, fcmToken) {
    await db.query(
      `DELETE FROM user_fcm_tokens WHERE user_id = $1 AND fcm_token = $2`,
      [userId, fcmToken]
    );
  },

  async getFcmTokensForAlert(orgId, vehicleId, alertType) {
    let prefKey = alertType;
    if (alertType) {
      const type = alertType.toLowerCase();
      if (type === 'ignition_on' || type === 'ignition_off') {
        prefKey = 'ignition';
      } else if (type === 'excessive_idle' || type === 'idle' || type === 'stopped') {
        prefKey = 'idle';
      } else if (type === 'parking') {
        prefKey = 'parking';
      } else if (type === 'moving' || type === 'start_moving') {
        prefKey = 'moving';
      } else if (type === 'trip_started' || type === 'trip_ended') {
        prefKey = 'trip_started';
      } else if (type === 'safety_park') {
        prefKey = 'theft';
      } else if (type === 'route_deviation') {
        prefKey = 'geofence';
      } else if (type === 'main_battery_disconnected' || type === 'main_battery_connected' || type === 'power_cut' || type === 'battery') {
        prefKey = 'power_cut';
      } else if (type === 'fuel_refill_final' || type === 'fuel_refill' || type === 'fuel_fill') {
        prefKey = 'fuel_refill';
      } else if (type === 'fuel_theft' || type === 'theft') {
        prefKey = 'fuel_theft';
      }
    }

    const result = await db.query(
      `SELECT t.fcm_token, p.preferences
       FROM user_fcm_tokens t
       JOIN users u ON t.user_id = u.id
       LEFT JOIN user_alert_preferences p ON p.user_id = u.id
       WHERE (
           u.org_id = $1 
           OR u.role = 'superadmin'
           OR EXISTS (
             SELECT 1
             FROM user_groups ug
             JOIN vehicle_groups vg ON ug.group_id = vg.group_id
             WHERE ug.user_id = u.id AND vg.vehicle_id = $3
           )
         )
         AND (
           p.preferences IS NULL
           OR COALESCE((p.preferences->$2)::text, 'true') != 'false'
         )
         AND (
           u.role != 'customer'
           OR EXISTS (
             SELECT 1
             FROM user_groups ug
             JOIN vehicle_groups vg ON ug.group_id = vg.group_id
             WHERE ug.user_id = u.id AND vg.vehicle_id = $3
           )
           OR NOT EXISTS (
             SELECT 1 FROM user_groups WHERE user_id = u.id
           )
         )`,
      [orgId, prefKey, vehicleId]
    );

    // Filter by customer-configured alert schedule (time window) if specified
    const activeTokens = [];
    const nowTimeStr = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date());

    for (const row of result.rows) {
      if (row.preferences) {
        if (row.preferences[prefKey] === false) continue;

        // Timing window check (e.g. customer set alert should only come between 09:00 and 18:00)
        const timing = row.preferences?.timings?.[prefKey] || row.preferences?.timings?.[alertType.toLowerCase()];
        if (timing && timing.all_day === false && timing.start_time && timing.end_time) {
          const { start_time, end_time } = timing;
          const inWindow = start_time <= end_time
            ? (nowTimeStr >= start_time && nowTimeStr <= end_time)
            : (nowTimeStr >= start_time || nowTimeStr <= end_time); // overnight span
          if (!inWindow) continue; // Outside allowed time window
        }
      }
      activeTokens.push(row.fcm_token);
    }

    return activeTokens;
  },

  /**
   * Get dashboard stats for an org
   */
  async getDashboardStats(orgId, role, noDataMinutes = 30) {
    const mins = Math.max(1, parseInt(noDataMinutes, 10) || 30);
    let result;

    if (role === 'superadmin') {
      result = await db.query(`
        SELECT
          (SELECT COUNT(*) FROM vehicles WHERE is_active = TRUE) AS total_vehicles,
          (SELECT COUNT(*) FROM vehicle_latest_state vls
           JOIN vehicles v ON v.id = vls.vehicle_id
           WHERE v.is_active = TRUE AND vls.last_seen >= NOW() - ($1 || ' minutes')::INTERVAL) AS online_vehicles,
          (SELECT COUNT(*) FROM vehicle_latest_state vls
           JOIN vehicles v ON v.id = vls.vehicle_id
           WHERE v.is_active = TRUE AND vls.last_seen IS NOT NULL AND vls.last_seen < NOW() - ($1 || ' minutes')::INTERVAL) AS offline_vehicles,
          (SELECT COUNT(*) FROM vehicles v
           LEFT JOIN vehicle_latest_state vls ON v.id = vls.vehicle_id
           WHERE v.is_active = TRUE AND (vls.last_seen IS NULL OR vls.vehicle_id IS NULL)) AS unreachable_vehicles,
          (SELECT COUNT(*) FROM organizations) AS organizations_count,
          (SELECT COUNT(*) FROM users) AS users_count
      `, [mins]);
    } else {
      result = await db.query(`
        SELECT
          (SELECT COUNT(*) FROM vehicles v
           JOIN organizations o ON v.org_id = o.id
           WHERE v.is_active = TRUE AND (o.id = $1 OR o.parent_id = $1)) AS total_vehicles,
          (SELECT COUNT(*) FROM vehicle_latest_state vls
           JOIN vehicles v ON v.id = vls.vehicle_id
           JOIN organizations o ON v.org_id = o.id
           WHERE v.is_active = TRUE AND (o.id = $1 OR o.parent_id = $1)
             AND vls.last_seen >= NOW() - ($2 || ' minutes')::INTERVAL) AS online_vehicles,
          (SELECT COUNT(*) FROM vehicle_latest_state vls
           JOIN vehicles v ON v.id = vls.vehicle_id
           JOIN organizations o ON v.org_id = o.id
           WHERE v.is_active = TRUE AND (o.id = $1 OR o.parent_id = $1)
             AND vls.last_seen IS NOT NULL AND vls.last_seen < NOW() - ($2 || ' minutes')::INTERVAL) AS offline_vehicles,
          (SELECT COUNT(*) FROM vehicles v
           JOIN organizations o ON v.org_id = o.id
           LEFT JOIN vehicle_latest_state vls ON v.id = vls.vehicle_id
           WHERE v.is_active = TRUE AND (o.id = $1 OR o.parent_id = $1)
             AND (vls.last_seen IS NULL OR vls.vehicle_id IS NULL)) AS unreachable_vehicles,
          (SELECT COUNT(*) FROM organizations WHERE id = $1 OR parent_id = $1) AS organizations_count,
          (SELECT COUNT(*) FROM users u
           JOIN organizations o ON u.org_id = o.id
           WHERE o.id = $1 OR o.parent_id = $1) AS users_count
      `, [orgId, mins]);
    }

    const totalVehicles = parseInt(result.rows[0].total_vehicles || 0);
    const onlineVehicles = parseInt(result.rows[0].online_vehicles || 0);
    const offlineVehicles = parseInt(result.rows[0].offline_vehicles || 0);
    const unreachableVehicles = parseInt(result.rows[0].unreachable_vehicles || 0);
    const availableInventory = 0; // Inventory not tracked in DB — honest zero rather than fabricated constant

    return {
      total_devices: totalVehicles + availableInventory,
      assigned_devices: totalVehicles,
      available_devices: availableInventory,
      total_vehicles: totalVehicles,
      online_vehicles: onlineVehicles,
      offline_vehicles: offlineVehicles,
      nodata_vehicles: offlineVehicles,
      unreachable_vehicles: unreachableVehicles,
      organizations: parseInt(result.rows[0].organizations_count || 0),
      users: parseInt(result.rows[0].users_count || 0),
    };
  },

  async clearAlertsForOrg(orgId) {
    let query, params;
    if (orgId) {
      query = `DELETE FROM alerts USING vehicles WHERE alerts.vehicle_id = vehicles.id AND vehicles.org_id = $1`;
      params = [orgId];
    } else {
      query = `DELETE FROM alerts`;
      params = [];
    }
    const result = await db.query(query, params);
    if (orgId) await redis.del(`org:alerts:${orgId}`).catch(() => {});
    return result.rowCount;
  },

  async clearAlertsForVehicle(vehicleId, orgId) {
    let query, params;
    if (orgId) {
      query = `DELETE FROM alerts USING vehicles WHERE alerts.vehicle_id = vehicles.id AND alerts.vehicle_id = $1 AND vehicles.org_id = $2`;
      params = [vehicleId, orgId];
    } else {
      query = `DELETE FROM alerts WHERE vehicle_id = $1 RETURNING (SELECT org_id FROM vehicles WHERE id = $1) as v_org`;
      params = [vehicleId];
    }
    const result = await db.query(query, params);
    const targetOrgId = orgId || (result.rows.length > 0 ? result.rows[0].v_org : null);
    if (targetOrgId) await redis.del(`org:alerts:${targetOrgId}`).catch(() => {});
    return result.rowCount;
  },

  async deleteAlert(alertId, orgId) {
    let query, params;
    if (orgId) {
      query = `DELETE FROM alerts USING vehicles WHERE alerts.vehicle_id = vehicles.id AND alerts.id = $1 AND vehicles.org_id = $2`;
      params = [alertId, orgId];
    } else {
      query = `DELETE FROM alerts WHERE id = $1 RETURNING (SELECT org_id FROM vehicles WHERE id = vehicle_id) as v_org`;
      params = [alertId];
    }
    const result = await db.query(query, params);
    const targetOrgId = orgId || (result.rows.length > 0 ? result.rows[0].v_org : null);
    if (targetOrgId) await redis.del(`org:alerts:${targetOrgId}`).catch(() => {});
    return result.rowCount > 0;
  },
};

module.exports = GpsModel;
