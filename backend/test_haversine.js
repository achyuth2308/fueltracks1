// LOCAL DEBUG TOOL — validates the haversine distance query used in vehicle stats.
// Run with: node backend/test_haversine.js
// Reads DB credentials from .env (same file used by the server).
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS,   // no hardcoded fallback — must be in .env
  database: process.env.DB_NAME || 'fueltracks',
});


const query = `
SELECT COALESCE(SUM(dist), 0) as today_distance FROM (
  SELECT (6371 * acos(least(1.0, cos(radians(prev_lat)) * cos(radians(lat)) * cos(radians(lng) - radians(prev_lng)) + sin(radians(prev_lat)) * sin(radians(lat))))) as dist FROM (
    SELECT lat, lng, LAG(lat) OVER (ORDER BY device_time) as prev_lat, LAG(lng) OVER (ORDER BY device_time) as prev_lng 
    FROM gps_points gp 
    WHERE gp.vehicle_id = (SELECT id FROM vehicles LIMIT 1)
      AND lat > 6.5 AND lat < 37.5 AND lng > 68.0 AND lng < 98.0
  ) sub 
  WHERE prev_lat IS NOT NULL AND (prev_lat != lat OR prev_lng != lng)
) dist_sub 
WHERE dist > 0.01 AND dist < 5
`;

pool.query(query).then(res => {
  console.log("Success:", res.rows);
  process.exit(0);
}).catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
