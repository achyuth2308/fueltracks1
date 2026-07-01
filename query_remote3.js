
const db = require('./fueltracks1/backend/config/db');
async function run() {
  try {
    const res = await db.query("SELECT device_time FROM gps_points ORDER BY id DESC LIMIT 1");
    console.log('DEVICE_TIME OBJ:', res.rows[0].device_time);
    console.log('DEVICE_TIME ISO:', res.rows[0].device_time.toISOString());
  } catch(e) { console.error(e); }
  process.exit(0);
}
run();
