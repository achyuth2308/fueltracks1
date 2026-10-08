const db = require('./backend/config/db');
async function run() {
  const orgs = await db.query("SELECT id, name FROM organizations WHERE name ILIKE '%sathya%'");
  console.log("Found orgs:", orgs.rows);
  
  for (let org of orgs.rows) {
      const res = await db.query("SELECT plate, imei FROM vehicles WHERE org_id = $1 ORDER BY plate", [org.id]);
      console.log(`Vehicles in ${org.name}:`, res.rows.length);
      console.log(JSON.stringify(res.rows, null, 2));
  }
  process.exit(0);
}
run();
