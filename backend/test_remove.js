const db = require('./config/db');
const GroupModel = require('./models/groupModel');

async function testRemove() {
  try {
    const res = await db.query("SELECT id FROM groups WHERE name = 'ALLVEHICLES'");
    const groupId = res.rows[0].id;
    
    // Get ALL 259 vehicles
    const vRes = await db.query("SELECT id FROM vehicles");
    const vIds = vRes.rows.map(r => r.id);
    
    // Find the ID of AP04X5678
    const targetRes = await db.query("SELECT id FROM vehicles WHERE name = 'AP04X5678'");
    if (targetRes.rows.length === 0) return console.log("Target vehicle not found.");
    const targetId = targetRes.rows[0].id;
    
    // Remove the target vehicle from the array
    const filteredIds = vIds.filter(id => id !== targetId);
    
    console.log(`Assigning ${filteredIds.length} vehicles to group ${groupId}...`);
    
    // Simulate updateGroup logic
    if (filteredIds && Array.isArray(filteredIds)) {
      await GroupModel.assignVehiclesToGroup(groupId, filteredIds);
    }
    
    const assigned = await GroupModel.getAssignedVehicleIds(groupId);
    console.log(`Assigned successfully: ${assigned.length} vehicles.`);
    
    const liveCount = await db.query("SELECT COUNT(vg.vehicle_id) as count FROM groups g LEFT JOIN vehicle_groups vg ON g.id = vg.group_id WHERE g.name = 'ALLVEHICLES' GROUP BY g.name");
    console.log("Live DB count:", liveCount.rows[0].count);
    
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
testRemove();
