const db = require('../../../config/db');

// ─── Shared PostgreSQL Haversine expression ───────────────────────────────────
// Computes distance in km between consecutive GPS points using LAG().
// Guards against floating-point domain errors with GREATEST/LEAST clamp.
// Filters out:
//   - segments with time gap > 10 minutes (signal loss / overnight)
//   - segments > 5 km in one step (teleport / GPS corrupt)
const HAVERSINE_SEGMENT_KM = `
  CASE
    WHEN prev_lat IS NOT NULL AND prev_lng IS NOT NULL
         AND prev_time IS NOT NULL
         AND EXTRACT(EPOCH FROM (device_time - prev_time)) < 600
         AND (6371 * acos(GREATEST(-1.0, LEAST(1.0,
               cos(radians(prev_lat)) * cos(radians(lat)) *
               cos(radians(lng) - radians(prev_lng)) +
               sin(radians(prev_lat)) * sin(radians(lat))
             )))) < 5
    THEN 6371 * acos(GREATEST(-1.0, LEAST(1.0,
           cos(radians(prev_lat)) * cos(radians(lat)) *
           cos(radians(lng) - radians(prev_lng)) +
           sin(radians(prev_lat)) * sin(radians(lat))
         )))
    ELSE 0
  END
`;

class ReportRepository {
  /**
   * Trip Report
   * Groups consecutive moving points into trips and computes per-trip distance
   * using Haversine (NOT odometer — odometer is null for buffered packets).
   */
  async getTrips(vehicleId, startDate, endDate) {
    const query = `
      WITH raw AS (
          SELECT
              lat, lng, speed, ignition, device_time,
              LAG(lat)         OVER (ORDER BY device_time) AS prev_lat,
              LAG(lng)         OVER (ORDER BY device_time) AS prev_lng,
              LAG(device_time) OVER (ORDER BY device_time) AS prev_time,
              (ignition = true OR speed > 0)               AS is_moving
          FROM gps_points
          WHERE vehicle_id = $1
            AND device_time BETWEEN $2 AND $3
      ),
      with_dist AS (
          SELECT *,
              ${HAVERSINE_SEGMENT_KM} AS segment_km
          FROM raw
      ),
      state_changes AS (
          SELECT *,
              CASE WHEN is_moving != LAG(is_moving) OVER (ORDER BY device_time)
                        OR LAG(is_moving) OVER (ORDER BY device_time) IS NULL
              THEN 1 ELSE 0 END AS is_change
          FROM with_dist
      ),
      islands AS (
          SELECT *,
              SUM(is_change) OVER (ORDER BY device_time) AS trip_id
          FROM state_changes
      )
      SELECT
          MIN(device_time)                                          AS start_time,
          MAX(device_time)                                          AS end_time,
          (ARRAY_AGG(lat ORDER BY device_time ASC))[1]             AS start_lat,
          (ARRAY_AGG(lng ORDER BY device_time ASC))[1]             AS start_lng,
          (ARRAY_AGG(lat ORDER BY device_time DESC))[1]            AS end_lat,
          (ARRAY_AGG(lng ORDER BY device_time DESC))[1]            AS end_lng,
          MAX(speed)                                                AS max_speed,
          ROUND(AVG(NULLIF(speed, 0))::numeric, 1)                 AS avg_speed,
          ROUND(SUM(segment_km)::numeric, 2)                       AS distance,
          EXTRACT(EPOCH FROM (MAX(device_time) - MIN(device_time))) AS duration_seconds
      FROM islands
      WHERE is_moving = true
      GROUP BY trip_id
      HAVING EXTRACT(EPOCH FROM (MAX(device_time) - MIN(device_time))) > 60
      ORDER BY start_time;
    `;
    const res = await db.query(query, [vehicleId, startDate, endDate]);
    return res.rows;
  }

  /**
   * Daily Distance Report
   * Uses Haversine per-point with LAG() partitioned by IST date.
   */
  async getDailyDistance(vehicleId, startDate, endDate) {
    const query = `
      WITH raw AS (
          SELECT
              lat, lng, device_time, odometer, speed,
              DATE(device_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') AS date,
              LAG(lat)         OVER (PARTITION BY DATE(device_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')
                                    ORDER BY device_time) AS prev_lat,
              LAG(lng)         OVER (PARTITION BY DATE(device_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')
                                    ORDER BY device_time) AS prev_lng,
              LAG(device_time) OVER (PARTITION BY DATE(device_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')
                                    ORDER BY device_time) AS prev_time
          FROM gps_points
          WHERE vehicle_id = $1
            AND device_time BETWEEN $2 AND $3
      ),
      with_dist AS (
          SELECT date, odometer, device_time, speed,
              ${HAVERSINE_SEGMENT_KM} AS segment_km
          FROM raw
      )
      SELECT
          date,
          ROUND(SUM(CASE WHEN speed > 0 THEN segment_km ELSE 0 END)::numeric, 2) AS distance_travelled,
          COUNT(*)                           AS point_count,
          COALESCE((ARRAY_AGG(odometer ORDER BY device_time ASC) FILTER (WHERE odometer IS NOT NULL AND odometer > 0))[1], 0) AS start_odometer,
          COALESCE((ARRAY_AGG(odometer ORDER BY device_time DESC) FILTER (WHERE odometer IS NOT NULL AND odometer > 0))[1], 0) AS end_odometer
      FROM with_dist
      GROUP BY date
      ORDER BY date;
    `;
    const res = await db.query(query, [vehicleId, startDate, endDate]);
    return res.rows;
  }

  /**
   * Vehicle Activity Report (Running / Idle / Stopped time + distance)
   */
  async getActivity(vehicleId, startDate, endDate) {
    const query = `
      WITH raw AS (
          SELECT
              lat, lng, speed, ignition, device_time,
              LAG(lat)         OVER (ORDER BY device_time) AS prev_lat,
              LAG(lng)         OVER (ORDER BY device_time) AS prev_lng,
              LAG(device_time) OVER (ORDER BY device_time) AS prev_time,
              COALESCE(EXTRACT(EPOCH FROM (
                LEAD(device_time) OVER (ORDER BY device_time) - device_time
              )), 0) AS duration_seconds
          FROM gps_points
          WHERE vehicle_id = $1
            AND device_time BETWEEN $2 AND $3
      ),
      with_dist AS (
          SELECT *,
              ${HAVERSINE_SEGMENT_KM} AS segment_km
          FROM raw
      )
      SELECT
          SUM(CASE WHEN speed > 0 THEN duration_seconds ELSE 0 END)                              AS running_seconds,
          SUM(CASE WHEN speed = 0 AND ignition = true THEN duration_seconds ELSE 0 END)          AS idle_seconds,
          SUM(CASE WHEN speed = 0 AND (ignition = false OR ignition IS NULL) THEN duration_seconds ELSE 0 END) AS stopped_seconds,
          ROUND(SUM(CASE WHEN speed > 0 THEN segment_km ELSE 0 END)::numeric, 2)                 AS distance_travelled
      FROM with_dist;
    `;
    const res = await db.query(query, [vehicleId, startDate, endDate]);
    return res.rows[0];
  }

  /**
   * Route History Report (Raw points for map rendering)
   */
  async getRouteHistory(vehicleId, startDate, endDate) {
    const query = `
      SELECT lat, lng, speed, ignition, device_time, odometer
      FROM gps_points
      WHERE vehicle_id = $1 AND device_time BETWEEN $2 AND $3
      ORDER BY device_time
      LIMIT 10000;
    `;
    const res = await db.query(query, [vehicleId, startDate, endDate]);
    return res.rows;
  }

  /**
   * Ignition Events Report
   */
  async getIgnitionEvents(vehicleId, startDate, endDate) {
    const query = `
      WITH lagged AS (
          SELECT
              device_time, lat, lng, ignition,
              LAG(ignition) OVER (ORDER BY device_time) AS prev_ignition
          FROM gps_points
          WHERE vehicle_id = $1 AND device_time BETWEEN $2 AND $3
      )
      SELECT
          device_time, lat, lng,
          CASE WHEN ignition = true THEN 'ON' ELSE 'OFF' END AS event_type
      FROM lagged
      WHERE ignition IS NOT NULL
        AND (prev_ignition IS NULL OR prev_ignition != ignition)
      ORDER BY device_time;
    `;
    const res = await db.query(query, [vehicleId, startDate, endDate]);
    return res.rows;
  }

  /**
   * Overspeeding Report
   */
  async getOverspeeding(vehicleId, startDate, endDate, speedLimit = 60) {
    const query = `
      WITH raw AS (
          SELECT lat, lng, speed, device_time,
                 LAG(lat)         OVER (ORDER BY device_time) AS prev_lat,
                 LAG(lng)         OVER (ORDER BY device_time) AS prev_lng,
                 LAG(device_time) OVER (ORDER BY device_time) AS prev_time,
                 (speed > $4) AS is_overspeeding
          FROM gps_points
          WHERE vehicle_id = $1 AND device_time BETWEEN $2 AND $3
      ),
      with_dist AS (
          SELECT *,
              ${HAVERSINE_SEGMENT_KM} AS segment_km
          FROM raw
      ),
      state_changes AS (
          SELECT *,
              CASE WHEN is_overspeeding != LAG(is_overspeeding) OVER (ORDER BY device_time)
                        OR LAG(is_overspeeding) OVER (ORDER BY device_time) IS NULL
              THEN 1 ELSE 0 END AS is_change
          FROM with_dist
      ),
      islands AS (
          SELECT *, SUM(is_change) OVER (ORDER BY device_time) AS event_id
          FROM state_changes
      )
      SELECT
          MIN(device_time)                                           AS start_time,
          MAX(device_time)                                           AS end_time,
          (ARRAY_AGG(lat ORDER BY device_time ASC))[1]              AS lat,
          (ARRAY_AGG(lng ORDER BY device_time ASC))[1]              AS lng,
          MAX(speed)                                                 AS max_speed,
          ROUND(AVG(NULLIF(speed, 0))::numeric, 1)                  AS avg_speed,
          EXTRACT(EPOCH FROM (MAX(device_time) - MIN(device_time))) AS duration_seconds,
          ROUND(SUM(segment_km)::numeric, 2)                        AS distance
      FROM islands
      WHERE is_overspeeding = true
      GROUP BY event_id
      HAVING EXTRACT(EPOCH FROM (MAX(device_time) - MIN(device_time))) > 0
      ORDER BY start_time;
    `;
    const res = await db.query(query, [vehicleId, startDate, endDate, speedLimit]);
    return res.rows;
  }

  /**
   * Stoppage / Idle / Parked Report
   */
  async getStoppages(vehicleId, startDate, endDate) {
    const query = `
      WITH flagged AS (
          SELECT lat, lng, speed, device_time, ignition,
                 CASE
                   WHEN speed > 0 THEN 'Moving'
                   WHEN speed = 0 AND ignition = true THEN 'Idle'
                   ELSE 'Parked'
                 END AS status
          FROM gps_points
          WHERE vehicle_id = $1 AND device_time BETWEEN $2 AND $3
          ORDER BY device_time
      ),
      state_changes AS (
          SELECT *,
              CASE WHEN status != LAG(status) OVER (ORDER BY device_time)
                        OR LAG(status) OVER (ORDER BY device_time) IS NULL
              THEN 1 ELSE 0 END AS is_change
          FROM flagged
      ),
      islands AS (
          SELECT *, SUM(is_change) OVER (ORDER BY device_time) AS event_id
          FROM state_changes
      )
      SELECT
          status,
          MIN(device_time)                                           AS start_time,
          MAX(device_time)                                           AS end_time,
          (ARRAY_AGG(lat ORDER BY device_time ASC))[1]              AS lat,
          (ARRAY_AGG(lng ORDER BY device_time ASC))[1]              AS lng,
          EXTRACT(EPOCH FROM (MAX(device_time) - MIN(device_time))) AS duration_seconds
      FROM islands
      GROUP BY event_id, status
      HAVING EXTRACT(EPOCH FROM (MAX(device_time) - MIN(device_time))) >= 60
      ORDER BY start_time;
    `;
    const res = await db.query(query, [vehicleId, startDate, endDate]);
    return res.rows;
  }

  /**
   * Consolidated Report (Org-level Activity with Haversine distance)
   *
   * FIX 1: LEFT JOIN from vehicles so every vehicle in the org appears,
   *         even those with zero GPS data in the selected period.
   * FIX 2: Returns start_lat/start_lng (first GPS point) and
   *         end_lat/end_lng (last GPS point) so the mobile app can
   *         reverse-geocode the From/To locations.
   */
  async getConsolidatedActivity(orgId, role, userId, startDate, endDate) {
    let vehicleFilter = '($1::uuid IS NULL OR v.org_id = $1) AND v.is_active = TRUE';
    const params = [orgId || null, startDate, endDate];

    if (role === 'customer') {
      params[0] = userId;
      vehicleFilter = `v.is_active = TRUE AND v.id IN (
        SELECT vg.vehicle_id 
        FROM vehicle_groups vg
        JOIN user_groups ug ON vg.group_id = ug.group_id
        WHERE ug.user_id = $1
      )`;
    }

    const query = `
      WITH raw AS (
          SELECT
              g.vehicle_id, g.lat, g.lng, g.speed, g.ignition, g.device_time, g.fuel,
              v.metadata,
              LAG(g.lat)         OVER (PARTITION BY g.vehicle_id ORDER BY g.device_time) AS prev_lat,
              LAG(g.lng)         OVER (PARTITION BY g.vehicle_id ORDER BY g.device_time) AS prev_lng,
              LAG(g.device_time) OVER (PARTITION BY g.vehicle_id ORDER BY g.device_time) AS prev_time,
              LAG(g.fuel)        OVER (PARTITION BY g.vehicle_id ORDER BY g.device_time) AS prev_fuel,
              COALESCE(EXTRACT(EPOCH FROM (
                LEAD(g.device_time) OVER (PARTITION BY g.vehicle_id ORDER BY g.device_time) - g.device_time
              )), 0) AS duration_seconds
          FROM gps_points g
          JOIN vehicles v ON g.vehicle_id = v.id
          WHERE ${vehicleFilter} AND g.device_time BETWEEN $2 AND $3
      ),
      with_dist AS (
          SELECT *,
              ${HAVERSINE_SEGMENT_KM} AS segment_km,
              COALESCE(fuel - prev_fuel, 0) AS fuel_diff,
              GREATEST(5.0, LEAST(30.0, COALESCE((metadata->>'tankSize')::numeric, 100) * 0.05)) AS fuel_threshold
          FROM raw
      ),
      aggregated AS (
          SELECT
              t.vehicle_id,
              SUM(CASE WHEN t.speed > 0 THEN t.duration_seconds ELSE 0 END)                               AS running_seconds,
              SUM(CASE WHEN t.speed = 0 AND t.ignition = true THEN t.duration_seconds ELSE 0 END)         AS idle_seconds,
              SUM(CASE WHEN t.speed = 0 AND (t.ignition = false OR t.ignition IS NULL) THEN t.duration_seconds ELSE 0 END) AS stopped_seconds,
              SUM(CASE WHEN t.ignition = true THEN t.duration_seconds ELSE 0 END)                         AS engine_on_seconds,
              ROUND(SUM(CASE WHEN t.speed > 0 THEN t.segment_km ELSE 0 END)::numeric, 2)                  AS distance_travelled,
              
              -- First/last fuel and locations
              (ARRAY_AGG(t.fuel ORDER BY t.device_time ASC) FILTER (WHERE t.fuel IS NOT NULL))[1]        AS start_fuel,
              (ARRAY_AGG(t.fuel ORDER BY t.device_time DESC) FILTER (WHERE t.fuel IS NOT NULL))[1]       AS end_fuel,
              (ARRAY_AGG(t.lat ORDER BY t.device_time ASC) FILTER (WHERE t.lat IS NOT NULL))[1]          AS start_lat,
              (ARRAY_AGG(t.lng ORDER BY t.device_time ASC) FILTER (WHERE t.lng IS NOT NULL))[1]          AS start_lng,
              (ARRAY_AGG(t.lat ORDER BY t.device_time DESC) FILTER (WHERE t.lat IS NOT NULL))[1]         AS end_lat,
              (ARRAY_AGG(t.lng ORDER BY t.device_time DESC) FILTER (WHERE t.lng IS NOT NULL))[1]         AS end_lng,
              
              -- Refills and thefts
              SUM(CASE WHEN t.fuel_diff >= t.fuel_threshold AND t.speed <= 5 THEN t.fuel_diff ELSE 0 END) AS total_refill,
              SUM(CASE WHEN t.fuel_diff <= -t.fuel_threshold AND t.speed <= 5 THEN -t.fuel_diff ELSE 0 END) AS total_theft
          FROM with_dist t
          GROUP BY t.vehicle_id
      )
      SELECT
          v.id AS vehicle_id,
          v.name AS vehicle_name,
          v.plate,
          COALESCE(a.running_seconds, 0) AS running_seconds,
          COALESCE(a.idle_seconds, 0) AS idle_seconds,
          COALESCE(a.stopped_seconds, 0) AS stopped_seconds,
          COALESCE(a.engine_on_seconds, 0) AS engine_on_seconds,
          COALESCE(a.distance_travelled, 0) AS distance_travelled,
          a.start_fuel,
          a.end_fuel,
          a.start_lat,
          a.start_lng,
          a.end_lat,
          a.end_lng,
          COALESCE(a.total_refill, 0) AS total_refill,
          COALESCE(a.total_theft, 0) AS total_theft,
          CASE 
            WHEN a.start_fuel IS NOT NULL AND a.end_fuel IS NOT NULL 
            THEN GREATEST(0, ROUND((a.start_fuel - a.end_fuel + a.total_refill - a.total_theft)::numeric, 2))
            ELSE NULL
          END AS consumption,
          CASE 
            WHEN a.start_fuel IS NOT NULL AND a.end_fuel IS NOT NULL AND (a.start_fuel - a.end_fuel + a.total_refill - a.total_theft) > 0
            THEN ROUND((a.distance_travelled / (a.start_fuel - a.end_fuel + a.total_refill - a.total_theft))::numeric, 2)
            ELSE NULL
          END AS kmpl,
          CASE 
            WHEN a.start_fuel IS NOT NULL AND a.end_fuel IS NOT NULL AND a.engine_on_seconds > 0
            THEN ROUND(((a.start_fuel - a.end_fuel + a.total_refill - a.total_theft) / (a.engine_on_seconds / 3600.0))::numeric, 2)
            ELSE NULL
          END AS lph
      FROM vehicles v
      LEFT JOIN aggregated a ON v.id = a.vehicle_id
      WHERE ${vehicleFilter}
      ORDER BY v.name;
    `;
    const res = await db.query(query, params);
    return res.rows;
  }
}

module.exports = new ReportRepository();
