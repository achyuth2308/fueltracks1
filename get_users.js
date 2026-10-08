const db = require('./backend/config/db');
async function run() {
  const users = await db.query("SELECT id, name, org_id FROM users WHERE name ILIKE '%sathya%' OR email ILIKE '%sathya%'");
  console.log("Users:", users.rows);
  process.exit(0);
}
run();
