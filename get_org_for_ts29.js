const db = require('./backend/config/db');
async function run() {
  const res = await db.query("SELECT v.plate, v.imei, o.name as org_name FROM vehicles v LEFT JOIN organizations o ON v.org_id = o.id WHERE v.plate ILIKE '%TS%29%TA%8888%'");
  console.log(JSON.stringify(res.rows, null, 2));
  process.exit(0);
}
run();
