
const db = require('./fueltracks1/backend/config/db');
async function run() {
  try {
    const res = await db.query("UPDATE vehicle_latest_state SET is_online = TRUE WHERE last_seen >= NOW() - INTERVAL '24 hours'");
    console.log('Updated rows:', res.rowCount);
  } catch(e) { console.error(e); }
  process.exit(0);
}
run();
