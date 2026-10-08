const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS,
  database: process.env.DB_NAME || 'fueltracks',
});

async function fixTodayDistance() {
  console.log('Starting mass recalculation of today_distance for all active vehicles...');
  const client = await pool.connect();
  try {
    // We will use the exact logic from the History Page, but in SQL.
    // It filters out bounds, applies wasMoving, and caps distance.
    const query = `
      WITH moving_points AS (
        SELECT 
          vehicle_id, 
          lat, 
          lng, 
          device_time,
          speed,
          ignition,
          LAG(lat) OVER (PARTITION BY vehicle_id ORDER BY device_time) as prev_lat, 
          LAG(lng) OVER (PARTITION BY vehicle_id ORDER BY device_time) as prev_lng,
          LAG(speed) OVER (PARTITION BY vehicle_id ORDER BY device_time) as prev_speed,
          LAG(ignition) OVER (PARTITION BY vehicle_id ORDER BY device_time) as prev_ignition
        FROM gps_points
        WHERE device_time >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date
          AND lat > 6.5 AND lat < 37.5 AND lng > 68.0 AND lng < 98.0
      ),
      distances AS (
        SELECT 
          vehicle_id,
          (6371 * acos(least(1.0, 
            cos(radians(prev_lat)) * cos(radians(lat)) * cos(radians(lng) - radians(prev_lng)) + 
            sin(radians(prev_lat)) * sin(radians(lat))
          ))) as dist
        FROM moving_points
        WHERE prev_lat IS NOT NULL AND (prev_lat != lat OR prev_lng != lng)
          AND ( (speed > 3 OR ignition = true) OR (prev_speed > 3 OR prev_ignition = true) )
      ),
      aggregated AS (
        SELECT 
          vehicle_id,
          ROUND(CAST(COALESCE(SUM(dist), 0) AS numeric), 3) as total_dist
        FROM distances
        WHERE dist > 0.01 AND dist < 5
        GROUP BY vehicle_id
      )
      UPDATE vehicle_latest_state vls
      SET today_distance = a.total_dist
      FROM aggregated a
      WHERE vls.vehicle_id = a.vehicle_id
      AND vls.today_distance_date >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date;
    `;
    
    console.log('Executing massive recalculation query... Please wait...');
    const result = await client.query(query);
    console.log(`Successfully recalculated and fixed today_distance for ${result.rowCount} vehicles!`);
  } catch (error) {
    console.error('Error recalculating distances:', error);
  } finally {
    client.release();
    pool.end();
  }
}

fixTodayDistance();
