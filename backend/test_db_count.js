const db = require('./config/db');

async function test() {
  try {
    const res = await db.query("SELECT COUNT(*) FROM vehicles;");
    console.log(res.rows[0]);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
test();
