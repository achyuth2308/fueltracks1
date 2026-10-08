const db = require('./config/db');

async function debug() {
  try {
    // Find the SREESATHYADEVA group
    const grp = await db.query("SELECT id, name, org_id FROM groups WHERE name = 'SREESATHYADEVA'");
    const group = grp.rows[0];
    console.log("Group:", group);

    // All 19 vehicles in the group
    const vehiclesInGroup = await db.query(`
      SELECT v.id, v.name, v.is_active 
      FROM vehicles v
      JOIN vehicle_groups vg ON v.id = vg.vehicle_id
      WHERE vg.group_id = $1
      ORDER BY v.name
    `, [group.id]);
    console.log("\nAll vehicles in SREESATHYADEVA group (", vehiclesInGroup.rows.length, "):");
    vehiclesInGroup.rows.forEach(v => console.log(`  ${v.name} - active: ${v.is_active}`));

    // Count active vs inactive
    const active = vehiclesInGroup.rows.filter(v => v.is_active);
    const inactive = vehiclesInGroup.rows.filter(v => !v.is_active);
    console.log("\nActive:", active.length, "| Inactive:", inactive.length);

    // Check what the /v1/vehicles endpoint would return for this group
    // The v1 endpoint filters by is_active = TRUE by default
    const activeInGroup = await db.query(`
      SELECT v.id, v.name 
      FROM vehicles v
      JOIN vehicle_groups vg ON v.id = vg.vehicle_id
      WHERE vg.group_id = $1 AND v.is_active = TRUE
      ORDER BY v.name
    `, [group.id]);
    console.log("\nActive vehicles (what API should return):", activeInGroup.rows.length);

    // Check who is the SATHYADEVA customer user
    const orgRes = await db.query("SELECT id, name FROM organizations WHERE id = $1", [group.org_id]);
    console.log("\nGroup's organization:", orgRes.rows[0]);

    // Check if there's a customer user for this org
    const users = await db.query(`
      SELECT u.id, u.email, u.role, u.org_id,
             array_agg(g.name) as groups
      FROM users u
      LEFT JOIN user_groups ug ON u.id = ug.user_id
      LEFT JOIN groups g ON ug.group_id = g.id
      WHERE u.org_id = $1
      GROUP BY u.id, u.email, u.role, u.org_id
    `, [group.org_id]);
    console.log("\nUsers in this org:");
    users.rows.forEach(u => console.log(`  ${u.email} (${u.role}) - groups: ${u.groups}`));

  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
debug();
