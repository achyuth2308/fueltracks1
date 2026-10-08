const db = require('./backend/config/db');
async function run() {
  const grps = await db.query("SELECT id, name, org_id FROM groups WHERE name ILIKE '%sathya%'");
  console.log(grps.rows);
  process.exit(0);
}
run();
