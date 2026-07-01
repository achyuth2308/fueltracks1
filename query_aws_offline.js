
const db = require('./fueltracks1/backend/config/db');
async function run() {
  try {
    const res = await db.query("SELECT id FROM vehicles WHERE name='Vehicle 869925071852873'");
    if (res.rows[0]) {
      const vId = res.rows[0].id;
      const res2 = await db.query("SELECT * FROM vehicle_latest_state WHERE vehicle_id=$1", [vId]);
      console.log('LATEST STATE:', res2.rows[0]);
      
      const res3 = await db.query("SELECT * FROM gps_points WHERE vehicle_id=$1 ORDER BY device_time DESC LIMIT 1", [vId]);
      console.log('LAST GPS POINT:', res3.rows[0]);
    }
  } catch(e) { console.error(e); }
  process.exit(0);
}
run();
