const db = require('./config/db');

async function test() {
  const result = await db.query("SELECT name, COUNT(*) as count FROM vehicles GROUP BY name HAVING COUNT(*) > 1");
  console.log(result.rows);
  process.exit(0);
}
test();
