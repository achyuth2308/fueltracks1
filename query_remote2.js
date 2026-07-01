
const db = require('./fueltracks1/backend/config/db');
async function run() {
  try {
    const res = await db.query("SELECT id FROM vehicles WHERE plate='FTTPL_MYCARMGWINDSOR'");
    if (res.rows[0]) {
      const vId = res.rows[0].id;
      const res2 = await db.query("SELECT device_time, server_time, speed, ignition, odometer FROM gps_points WHERE vehicle_id=$1 ORDER BY server_time DESC LIMIT 50", [vId]);
      console.log('LATEST POINTS BY SERVER TIME:', res2.rows);
    }
  } catch(e) { console.error(e); }
  process.exit(0);
}
run();
