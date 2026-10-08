const db = require('./config/db');

async function cleanup() {
  try {
    // Remove inactive vehicles from ALL groups
    const result = await db.query(`
      DELETE FROM vehicle_groups 
      WHERE vehicle_id IN (
        SELECT id FROM vehicles WHERE is_active = FALSE
      )
      RETURNING vehicle_id
    `);
    
    console.log(`Removed ${result.rows.length} inactive vehicle assignments from groups`);
    
    // Verify the ALLVEHICLES group count now
    const countRes = await db.query(`
      SELECT g.name, COUNT(vg.vehicle_id) as count 
      FROM groups g 
      LEFT JOIN vehicle_groups vg ON g.id = vg.group_id
      GROUP BY g.name
    `);
    console.log("Group counts after cleanup:", countRes.rows);
    
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
cleanup();
