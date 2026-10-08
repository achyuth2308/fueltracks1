const db = require('./config/db');
const GroupModel = require('./models/groupModel');

async function test() {
  try {
    const res = await db.query("SELECT * FROM groups WHERE name = 'ALLVEHICLES'");
    if (res.rows.length === 0) return console.log("No ALLVEHICLES group.");
    const group = res.rows[0];
    
    const vRes = await db.query("SELECT id FROM vehicles LIMIT 5");
    const vIds = vRes.rows.map(r => r.id);
    
    console.log("Assigning vehicles:", vIds);
    await GroupModel.assignVehiclesToGroup(group.id, vIds);
    
    const assigned = await GroupModel.getAssignedVehicleIds(group.id);
    console.log("Assigned in DB:", assigned);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
test();
