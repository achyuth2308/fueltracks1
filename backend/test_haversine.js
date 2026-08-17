const { Pool } = require('pg');
const pool = new Pool({ host: '127.0.0.1', port: 5433, user: 'postgres', password: 'fuel', database: 'fueltracks' });

const query = `
SELECT COALESCE(SUM(
  6371 * acos(
    cos(radians(prev_lat)) * cos(radians(lat)) * cos(radians(lng) - radians(prev_lng)) +
    sin(radians(prev_lat)) * sin(radians(lat))
  )
), 0) as today_distance
FROM (
  SELECT 
    lat, lng, 
    LAG(lat) OVER (ORDER BY device_time) as prev_lat, 
    LAG(lng) OVER (ORDER BY device_time) as prev_lng 
  FROM gps_points 
  WHERE vehicle_id = (SELECT id FROM vehicles LIMIT 1)
) sub 
WHERE prev_lat IS NOT NULL
`;

pool.query(query).then(res => {
  console.log("Success:", res.rows);
  process.exit(0);
}).catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
