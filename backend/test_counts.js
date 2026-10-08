const db = require('./config/db');

async function test() {
  try {
    const groupRes = await db.query("SELECT * FROM groups WHERE name = 'ALLVEHICLES'");
    const group = groupRes.rows[0];
    
    // Count total vehicles
    const totalRes = await db.query("SELECT COUNT(*) FROM vehicles");
    console.log("Total vehicles in DB:", totalRes.rows[0].count);
    
    // Count vehicles for this exact org
    const orgRes = await db.query("SELECT COUNT(*) FROM vehicles WHERE org_id = $1", [group.org_id]);
    console.log(`Vehicles strictly in org ${group.org_id}:`, orgRes.rows[0].count);
    
    // Count vehicles including child orgs
    const childRes = await db.query(
      `SELECT COUNT(*) FROM vehicles 
       WHERE org_id = $1 OR org_id IN (SELECT id FROM organizations WHERE parent_id = $1)`, 
      [group.org_id]
    );
    console.log(`Vehicles in org + child orgs:`, childRes.rows[0].count);

  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
test();
