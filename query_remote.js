
const db = require('./fueltracks1/backend/config/db');
async function run() {
  try {
    const res = await db.query("SELECT id FROM vehicles WHERE plate='FTTPL_MYCARMGWINDSOR'");
    if (res.rows[0]) {
      const vId = res.rows[0].id;
      const res2 = await db.query("SELECT device_time, speed, ignition, odometer FROM gps_points WHERE vehicle_id=$1 AND device_time >= '2026-07-01 00:00:00' AND device_time <= '2026-07-01 23:59:59' ORDER BY device_time", [vId]);
      console.log('JULY 1st POINTS:', res2.rows);
    }
  } catch(e) { console.error(e); }
  process.exit(0);
}
run();
