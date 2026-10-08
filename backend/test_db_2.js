const db = require('./config/db');

async function test() {
  try {
    const res = await db.query("SELECT id, name, plate, imei, created_at, org_id FROM vehicles WHERE plate ILIKE '%4576%';");
    console.log(res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
test();
