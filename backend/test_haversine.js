const { Pool } = require('pg');
const pool = new Pool({ host: '127.0.0.1', port: 5433, user: 'postgres', password: 'fuel', database: 'fueltracks' });

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
