const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres', host: '5.223.83.39', database: 'fueltracks', password: 'fuel', port: 5433
});
pool.query("SELECT lat, lng, speed, ignition, is_online FROM vehicles WHERE imei = '352312096374130'")
  .then(res => { console.log('Vehicle Table:', res.rows); return pool.query("SELECT speed, ignition, device_time FROM gps_points WHERE vehicle_id = (SELECT id FROM vehicles WHERE imei = '352312096374130') ORDER BY server_time DESC LIMIT 5"); })
  .then(res => { console.log('GPS Table:', res.rows); process.exit(0); })
  .catch(console.error);
