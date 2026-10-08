const db = require('./config/db');

async function check() {
  const res = await db.query("SELECT name, org_id FROM vehicles WHERE name = 'AP04X5678'");
  console.log(res.rows);
  process.exit(0);
}
check();
