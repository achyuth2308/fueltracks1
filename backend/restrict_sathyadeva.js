const db = require('./config/db');

async function debug() {
  try {
    // 1. Get the SREESATHYADEVA group ID
    const grpRes = await db.query("SELECT id FROM groups WHERE name = 'SREESATHYADEVA'");
    if (grpRes.rows.length === 0) {
      console.log("Group not found");
      process.exit(0);
    }
    const groupId = grpRes.rows[0].id;
    console.log("Group ID:", groupId);

    // 2. Get the vehicle ID for TS29TA8996
    const vehRes = await db.query("SELECT id FROM vehicles WHERE plate = 'TS29TA8996'");
    if (vehRes.rows.length === 0) {
      console.log("Vehicle TS29TA8996 not found");
      process.exit(0);
    }
    const vehicleId = vehRes.rows[0].id;
    console.log("Vehicle ID to keep:", vehicleId);

    // 3. Delete all other vehicles from the group
    const delRes = await db.query(
      "DELETE FROM vehicle_groups WHERE group_id = $1 AND vehicle_id != $2 RETURNING vehicle_id",
      [groupId, vehicleId]
    );
    console.log(`Removed ${delRes.rowCount} vehicles from the group.`);

    // 4. Update the cached count in the groups table
    const updateRes = await db.query(
      "UPDATE groups SET vehicle_count = 1 WHERE id = $1",
      [groupId]
    );
    console.log("Updated group count to 1");

  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
debug();
