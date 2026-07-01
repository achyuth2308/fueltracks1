
const db = require('./fueltracks1/backend/config/db');
async function run() {
  try {
    const res = await db.query("SELECT * FROM vehicles WHERE name='Vehicle 869925071852873'");
    console.log('VEHICLE:', res.rows[0]);
    if (res.rows[0]) {
      const imei = res.rows[0].imei;
      const res2 = await db.query("SELECT received_at, packet_type, device_time FROM raw_packets WHERE imei=$1 ORDER BY received_at DESC LIMIT 10", [imei]);
      console.log('PACKETS:', res2.rows);
    }
  } catch(e) { console.error(e); }
  process.exit(0);
}
run();
