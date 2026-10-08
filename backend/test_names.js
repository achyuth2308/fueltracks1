const db = require('./config/db');

async function test() {
  const orgId = '8833df78-a912-47d3-b136-9ec0a218e091';
  const res = await db.query("SELECT name FROM vehicles WHERE org_id = $1 ORDER BY name ASC", [orgId]);
  console.log(res.rows.map(r => r.name));
  process.exit(0);
}
test();
