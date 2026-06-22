const db = require('../../../config/db');

class ReportRepository {
  /**
   * Trip Report (Ignition / Speed based contiguous sequences)
   * We use the 'is_moving' flag: speed > 0 OR ignition = true.
   */
  async getTrips(vehicleId, startDate, endDate) {
    const query = `
      WITH flagged AS (
          SELECT 
              lat, lng, speed, device_time, odometer,
              (ignition = true OR speed > 0) as is_moving
          FROM gps_points
          WHERE vehicle_id = $1 AND device_time BETWEEN $2 AND $3
          ORDER BY device_time
      ),
      state_changes AS (
          SELECT 
              *,
              CASE WHEN is_moving != LAG(is_moving) OVER (ORDER BY device_time) 
                   OR LAG(is_moving) OVER (ORDER BY device_time) IS NULL 
              THEN 1 ELSE 0 END as is_change
          FROM flagged
      ),
      islands AS (
          SELECT 
              *,
              SUM(is_change) OVER (ORDER BY device_time) as trip_id
          FROM state_changes
      )
      SELECT 
          MIN(device_time) as start_time,
          MAX(device_time) as end_time,
          (ARRAY_AGG(lat ORDER BY device_time ASC))[1] as start_lat,
          (ARRAY_AGG(lng ORDER BY device_time ASC))[1] as start_lng,
          (ARRAY_AGG(lat ORDER BY device_time DESC))[1] as end_lat,
          (ARRAY_AGG(lng ORDER BY device_time DESC))[1] as end_lng,
          MAX(speed) as max_speed,
          AVG(speed) as avg_speed,
          MAX(odometer) - MIN(odometer) as distance,
          EXTRACT(EPOCH FROM (MAX(device_time) - MIN(device_time))) as duration_seconds
      FROM islands
      WHERE is_moving = true
      GROUP BY trip_id
      HAVING EXTRACT(EPOCH FROM (MAX(device_time) - MIN(device_time))) > 60 -- Only trips > 1 minute
      ORDER BY start_time;
    `;
    const res = await db.query(query, [vehicleId, startDate, endDate]);
    return res.rows;
  }

  /**
   * Daily Distance Report
   */
  async getDailyDistance(vehicleId, startDate, endDate) {
    const query = `
      SELECT 
          DATE(device_time) as date,
          MIN(odometer) as start_odometer,
          MAX(odometer) as end_odometer,
          MAX(odometer) - MIN(odometer) as distance_travelled,
          COUNT(*) as point_count
      FROM gps_points
      WHERE vehicle_id = $1 AND device_time BETWEEN $2 AND $3
      GROUP BY DATE(device_time)
      ORDER BY date;
    `;
    const res = await db.query(query, [vehicleId, startDate, endDate]);
    return res.rows;
  }

  /**
   * Vehicle Activity Report (Time categorization)
   */
  async getActivity(vehicleId, startDate, endDate) {
    const query = `
      WITH time_diffs AS (
          SELECT 
              device_time,
              speed,
              ignition,
              odometer,
              COALESCE(EXTRACT(EPOCH FROM (LEAD(device_time) OVER (ORDER BY device_time) - device_time)), 0) as duration_seconds
          FROM gps_points
          WHERE vehicle_id = $1 AND device_time BETWEEN $2 AND $3
      )
      SELECT 
          SUM(CASE WHEN speed > 0 THEN duration_seconds ELSE 0 END) as running_seconds,
          SUM(CASE WHEN speed = 0 AND ignition = true THEN duration_seconds ELSE 0 END) as idle_seconds,
          SUM(CASE WHEN speed = 0 AND (ignition = false OR ignition IS NULL) THEN duration_seconds ELSE 0 END) as stopped_seconds,
          MAX(odometer) - MIN(odometer) as distance_travelled
      FROM time_diffs;
    `;
    const res = await db.query(query, [vehicleId, startDate, endDate]);
    return res.rows[0];
  }

  /**
   * Route History Report (Raw points)
   */
  async getRouteHistory(vehicleId, startDate, endDate) {
    const query = `
      SELECT lat, lng, speed, ignition, device_time, odometer
      FROM gps_points
      WHERE vehicle_id = $1 AND device_time BETWEEN $2 AND $3
      ORDER BY device_time
      LIMIT 10000; -- Limit to prevent huge memory spikes, downsampling can be implemented if needed
    `;
    const res = await db.query(query, [vehicleId, startDate, endDate]);
    return res.rows;
  }

  /**
   * Ignition Report
   */
  async getIgnitionEvents(vehicleId, startDate, endDate) {
    const query = `
      WITH lagged AS (
          SELECT 
              device_time, lat, lng, ignition,
              LAG(ignition) OVER (ORDER BY device_time) as prev_ignition
          FROM gps_points
          WHERE vehicle_id = $1 AND device_time BETWEEN $2 AND $3
      )
      SELECT 
          device_time, lat, lng, 
          CASE WHEN ignition = true THEN 'ON' ELSE 'OFF' END as event_type
      FROM lagged
      WHERE ignition IS NOT NULL AND (prev_ignition IS NULL OR prev_ignition != ignition)
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
      WITH flagged AS (
          SELECT lat, lng, speed, device_time, odometer,
                 (speed > $4) as is_overspeeding
          FROM gps_points
          WHERE vehicle_id = $1 AND device_time BETWEEN $2 AND $3
          ORDER BY device_time
      ),
      state_changes AS (
          SELECT *,
                 CASE WHEN is_overspeeding != LAG(is_overspeeding) OVER (ORDER BY device_time) 
                      OR LAG(is_overspeeding) OVER (ORDER BY device_time) IS NULL 
                 THEN 1 ELSE 0 END as is_change
          FROM flagged
      ),
      islands AS (
          SELECT *, SUM(is_change) OVER (ORDER BY device_time) as event_id
          FROM state_changes
      )
      SELECT 
          MIN(device_time) as start_time, MAX(device_time) as end_time,
          (ARRAY_AGG(lat ORDER BY device_time ASC))[1] as lat,
          (ARRAY_AGG(lng ORDER BY device_time ASC))[1] as lng,
          MAX(speed) as max_speed, AVG(speed) as avg_speed,
          EXTRACT(EPOCH FROM (MAX(device_time) - MIN(device_time))) as duration_seconds
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
   * Stoppage Report
   */
  async getStoppages(vehicleId, startDate, endDate) {
    const query = `
      WITH flagged AS (
          SELECT lat, lng, speed, device_time, odometer, ignition,
                 (speed = 0 AND (ignition = false OR ignition IS NULL)) as is_stopped
          FROM gps_points
          WHERE vehicle_id = $1 AND device_time BETWEEN $2 AND $3
          ORDER BY device_time
      ),
      state_changes AS (
          SELECT *,
                 CASE WHEN is_stopped != LAG(is_stopped) OVER (ORDER BY device_time) 
                      OR LAG(is_stopped) OVER (ORDER BY device_time) IS NULL 
                 THEN 1 ELSE 0 END as is_change
          FROM flagged
      ),
      islands AS (
          SELECT *, SUM(is_change) OVER (ORDER BY device_time) as event_id
          FROM state_changes
      )
      SELECT 
          MIN(device_time) as start_time, MAX(device_time) as end_time,
          (ARRAY_AGG(lat ORDER BY device_time ASC))[1] as lat,
          (ARRAY_AGG(lng ORDER BY device_time ASC))[1] as lng,
          EXTRACT(EPOCH FROM (MAX(device_time) - MIN(device_time))) as duration_seconds
      FROM islands
      WHERE is_stopped = true
      GROUP BY event_id
      HAVING EXTRACT(EPOCH FROM (MAX(device_time) - MIN(device_time))) > 60
      ORDER BY start_time;
    `;
    const res = await db.query(query, [vehicleId, startDate, endDate]);
    return res.rows;
  }

  /**
   * Consolidated Report (Org-level Activity)
   */
  async getConsolidatedActivity(orgId, startDate, endDate) {
    const query = `
      WITH time_diffs AS (
          SELECT 
              g.vehicle_id, g.device_time, g.speed, g.ignition, g.odometer,
              COALESCE(EXTRACT(EPOCH FROM (LEAD(g.device_time) OVER (PARTITION BY g.vehicle_id ORDER BY g.device_time) - g.device_time)), 0) as duration_seconds
          FROM gps_points g
          JOIN vehicles v ON g.vehicle_id = v.id
          WHERE v.org_id = $1 AND g.device_time BETWEEN $2 AND $3
      )
      SELECT 
          t.vehicle_id, v.name as vehicle_name, v.plate,
          SUM(CASE WHEN t.speed > 0 THEN t.duration_seconds ELSE 0 END) as running_seconds,
          SUM(CASE WHEN t.speed = 0 AND t.ignition = true THEN t.duration_seconds ELSE 0 END) as idle_seconds,
          SUM(CASE WHEN t.speed = 0 AND (t.ignition = false OR t.ignition IS NULL) THEN t.duration_seconds ELSE 0 END) as stopped_seconds,
          MAX(t.odometer) - MIN(t.odometer) as distance_travelled
      FROM time_diffs t
      JOIN vehicles v ON t.vehicle_id = v.id
      GROUP BY t.vehicle_id, v.name, v.plate
      ORDER BY v.name;
    `;
    const res = await db.query(query, [orgId, startDate, endDate]);
    return res.rows;
  }
}

module.exports = new ReportRepository();
