const db = require('./config/db');

async function test() {
  const result = await db.query("SELECT COUNT(*) FROM vehicles WHERE is_active = TRUE");
  console.log("Total active vehicles:", result.rows[0].count);
  process.exit(0);
}
test();
