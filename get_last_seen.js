const db = require('./backend/config/db');
async function run() {
  const res = await db.query("SELECT last_seen, lat, lng FROM vehicle_latest_state WHERE vehicle_id IN (SELECT id FROM vehicles WHERE imei = '868329081297552')");
  console.log(res.rows);
  process.exit(0);
}
run();
