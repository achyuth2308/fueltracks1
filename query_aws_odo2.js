
const db = require('./fueltracks1/backend/config/db');
async function run() {
  try {
    const res = await db.query("SELECT id FROM vehicles WHERE name='Vehicle 869925071852873'");
    if (res.rows[0]) {
      const vId = res.rows[0].id;
      const resFirst = await db.query("SELECT device_time, odometer, speed FROM gps_points WHERE vehicle_id=$1 AND device_time >= '2026-06-30T18:30:00Z' ORDER BY device_time ASC LIMIT 1", [vId]);
      const resLast = await db.query("SELECT device_time, odometer, speed FROM gps_points WHERE vehicle_id=$1 AND device_time >= '2026-06-30T18:30:00Z' ORDER BY device_time DESC LIMIT 1", [vId]);
      console.log('FIRST POINT TODAY:', resFirst.rows);
      console.log('LAST POINT TODAY:', resLast.rows);
    }
  } catch(e) { console.error(e); }
  process.exit(0);
}
run();
