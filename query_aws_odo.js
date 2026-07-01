
const db = require('./fueltracks1/backend/config/db');
async function run() {
  try {
    const res = await db.query("SELECT id FROM vehicles WHERE name='Vehicle 869925071852873'");
    if (res.rows[0]) {
      const vId = res.rows[0].id;
      const res2 = await db.query("SELECT device_time, odometer, speed FROM gps_points WHERE vehicle_id=$1 ORDER BY device_time DESC LIMIT 20", [vId]);
      console.log('GPS POINTS:', res2.rows);
    }
  } catch(e) { console.error(e); }
  process.exit(0);
}
run();
