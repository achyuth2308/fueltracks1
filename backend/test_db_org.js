const db = require('./config/db');

async function test() {
  try {
    const res = await db.query("SELECT * FROM organizations WHERE id = '3c5f6cf3-e956-4971-840c-40fbb1be4ed5';");
    console.log(res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
test();
