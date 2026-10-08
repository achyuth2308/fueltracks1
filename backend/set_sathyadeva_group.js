const db = require('./config/db');

async function updateGroup() {
  try {
    const groupIdRes = await db.query("SELECT id FROM groups WHERE name = 'SREESATHYADEVA'");
    const groupId = groupIdRes.rows[0].id;

    // Get the IDs of the two vehicles
    const vehicles = await db.query("SELECT id, plate FROM vehicles WHERE plate IN ('TS29TA8888', 'TS29TA8996')");
    
    // Clear the group first
    await db.query("DELETE FROM vehicle_groups WHERE group_id = $1", [groupId]);

    // Insert both
    for (const v of vehicles.rows) {
      await db.query("INSERT INTO vehicle_groups (group_id, vehicle_id) VALUES ($1, $2)", [groupId, v.id]);
      console.log(`Added ${v.plate} to group`);
    }

    // Update count using a transaction-safe query
    await db.query(`
      UPDATE groups 
      SET vehicle_count = (SELECT COUNT(*) FROM vehicle_groups WHERE group_id = $1)
      WHERE id = $1
    `, [groupId]);
    console.log("Updated group vehicle_count to 2");

  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
updateGroup();
