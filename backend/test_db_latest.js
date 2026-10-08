const db = require('./config/db');

async function test() {
  try {
    const res = await db.query("SELECT id, name, plate, imei, created_at, org_id FROM vehicles ORDER BY created_at DESC LIMIT 5;");
    console.log(res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
test();
