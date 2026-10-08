const db = require('./backend/config/db');
async function run() {
  const res = await db.query("SELECT plate, imei, name FROM vehicles WHERE org_id = '15d63d13-839a-42af-ad39-7458349b2ba7' ORDER BY plate LIMIT 50");
  console.log(JSON.stringify(res.rows, null, 2));
  process.exit(0);
}
run();
