const db = require('./config/db');

async function test() {
  const result = await db.query("SELECT id, name FROM vehicles");
  console.log("Total:", result.rows.length);
  process.exit(0);
}
test();
