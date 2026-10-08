const db = require('./config/db');
const GroupModel = require('./models/groupModel');

async function restore() {
  try {
    const res = await db.query("SELECT * FROM groups WHERE name = 'ALLVEHICLES'");
    if (res.rows.length === 0) return console.log("No ALLVEHICLES group.");
    const group = res.rows[0];
    
    // Get all vehicles belonging to the organization
    const vRes = await db.query("SELECT id FROM vehicles WHERE org_id = $1", [group.org_id]);
    const vIds = vRes.rows.map(r => r.id);
    
    console.log(`Restoring ${vIds.length} vehicles to ALLVEHICLES group...`);
    await GroupModel.assignVehiclesToGroup(group.id, vIds);
    
    console.log("Restoration complete.");
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
restore();
