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
              lat, lng, device_time,
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
          SELECT date,
              ${HAVERSINE_SEGMENT_KM} AS segment_km
          FROM raw
      )
      SELECT
          date,
          ROUND(SUM(segment_km)::numeric, 2) AS distance_travelled,
          COUNT(*)                           AS point_count
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
          ROUND(SUM(segment_km)::numeric, 2)                                                     AS distance_travelled
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
  async getConsolidatedActivity(orgId, startDate, endDate) {
    const query = `
      WITH gps_in_range AS (
          -- All GPS points for this org within the date window
          SELECT
              g.vehicle_id,
              g.lat, g.lng, g.speed, g.ignition, g.device_time,
              LAG(g.lat)         OVER (PARTITION BY g.vehicle_id ORDER BY g.device_time) AS prev_lat,
              LAG(g.lng)         OVER (PARTITION BY g.vehicle_id ORDER BY g.device_time) AS prev_lng,
              LAG(g.device_time) OVER (PARTITION BY g.vehicle_id ORDER BY g.device_time) AS prev_time,
              COALESCE(EXTRACT(EPOCH FROM (
                LEAD(g.device_time) OVER (PARTITION BY g.vehicle_id ORDER BY g.device_time) - g.device_time
              )), 0) AS duration_seconds,
              -- First GPS point for this vehicle in the range
              FIRST_VALUE(g.lat) OVER (
                  PARTITION BY g.vehicle_id ORDER BY g.device_time
                  ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
              ) AS first_lat,
              FIRST_VALUE(g.lng) OVER (
                  PARTITION BY g.vehicle_id ORDER BY g.device_time
                  ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
              ) AS first_lng,
              -- Last GPS point for this vehicle in the range
              LAST_VALUE(g.lat) OVER (
                  PARTITION BY g.vehicle_id ORDER BY g.device_time
                  ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
              ) AS last_lat,
              LAST_VALUE(g.lng) OVER (
                  PARTITION BY g.vehicle_id ORDER BY g.device_time
                  ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
              ) AS last_lng
          FROM gps_points g
          JOIN vehicles v ON g.vehicle_id = v.id
          WHERE v.org_id = $1
            AND g.device_time BETWEEN $2 AND $3
      ),
      with_dist AS (
          SELECT *,
              ${HAVERSINE_SEGMENT_KM} AS segment_km
          FROM gps_in_range
      )
      -- LEFT JOIN ensures ALL org vehicles appear, even those with 0 activity
      SELECT
          v.id                                                                                               AS vehicle_id,
          v.name                                                                                             AS vehicle_name,
          v.plate,
          COALESCE(SUM(CASE WHEN d.speed > 0 THEN d.duration_seconds ELSE 0 END), 0)                       AS running_seconds,
          COALESCE(SUM(CASE WHEN d.speed = 0 AND d.ignition = true THEN d.duration_seconds ELSE 0 END), 0)  AS idle_seconds,
          COALESCE(SUM(CASE WHEN d.speed = 0 AND (d.ignition = false OR d.ignition IS NULL)
                        THEN d.duration_seconds ELSE 0 END), 0)                                            AS stopped_seconds,
          COALESCE(ROUND(SUM(d.segment_km)::numeric, 2), 0)                                               AS distance_travelled,
          MAX(d.first_lat)  AS start_lat,
          MAX(d.first_lng)  AS start_lng,
          MAX(d.last_lat)   AS end_lat,
          MAX(d.last_lng)   AS end_lng
      FROM vehicles v
      LEFT JOIN with_dist d ON d.vehicle_id = v.id
      WHERE v.org_id = $1
      GROUP BY v.id, v.name, v.plate
      ORDER BY v.name;
    `;
    const res = await db.query(query, [orgId, startDate, endDate]);
    return res.rows;
  }
}

module.exports = new ReportRepository();
