const db = require('./config/db');
const GroupModel = require('./models/groupModel');

async function testAssignAll() {
  try {
    const res = await db.query("SELECT id FROM groups WHERE name = 'ALLVEHICLES'");
    if (res.rows.length === 0) return console.log("No ALLVEHICLES group.");
    const groupId = res.rows[0].id;
    
    // Get ALL 252 vehicles
    const vRes = await db.query("SELECT id FROM vehicles");
    const vIds = vRes.rows.map(r => r.id);
    
    console.log(`Assigning ${vIds.length} vehicles to group ${groupId}...`);
    await GroupModel.assignVehiclesToGroup(groupId, vIds);
    
    const assigned = await GroupModel.getAssignedVehicleIds(groupId);
    console.log(`Assigned successfully: ${assigned.length} vehicles.`);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
testAssignAll();
