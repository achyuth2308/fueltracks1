
const db = require('./fueltracks1/backend/config/db');
async function run() {
  try {
    const res = await db.query("SELECT MIN(device_time) as start_time, MAX(device_time) as end_time FROM gps_points");
    console.log('MIN OBJ:', res.rows[0].start_time);
    console.log('MIN ISO:', res.rows[0].start_time.toISOString());
  } catch(e) { console.error(e); }
  process.exit(0);
}
run();
