const db = require('./backend/config/db');
async function run() {
  const res = await db.query("SELECT imei, plate FROM vehicles WHERE plate ILIKE '%TS%29%TA%8888%'");
  console.log(res.rows);
  process.exit(0);
}
run();
