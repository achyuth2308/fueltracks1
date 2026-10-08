const db = require('./config/db');

async function debug() {
  try {
    // Find the Sathyadeva org
    const org = await db.query("SELECT id, name FROM organizations WHERE name ILIKE '%sathyadeva%'");
    console.log("Sathyadeva orgs:", org.rows);
    const orgId = org.rows[0].id;

    // Find the SREESATHYADEVA group
    const grp = await db.query("SELECT id, name, org_id FROM groups WHERE name = 'SREESATHYADEVA'");
    const groupId = grp.rows[0].id;
    console.log("\nSREESATHYADEVA group:", grp.rows[0]);

    // What does the current API query return?
    // WHERE v.org_id = orgId AND in group
    const currentResult = await db.query(`
      SELECT v.name, v.org_id
      FROM vehicles v
      WHERE v.org_id = $1
        AND v.is_active = TRUE
        AND v.id IN (SELECT vehicle_id FROM vehicle_groups WHERE group_id = $2)
    `, [orgId, groupId]);
    console.log("\nCurrent API (wrong - org filter) returns:", currentResult.rows.length, "vehicles");
    currentResult.rows.forEach(v => console.log(" -", v.name));

    // What SHOULD it return (group scope only, no org filter)?
    const correctResult = await db.query(`
      SELECT v.name, v.org_id
      FROM vehicles v
      WHERE v.is_active = TRUE
        AND v.id IN (SELECT vehicle_id FROM vehicle_groups WHERE group_id = $1)
    `, [groupId]);
    console.log("\nCorrect (group scope only) returns:", correctResult.rows.length, "vehicles");

    // What orgs do the 19 vehicles belong to?
    const vehicleOrgs = await db.query(`
      SELECT DISTINCT v.org_id, o.name as org_name, COUNT(*) as count
      FROM vehicles v
      JOIN vehicle_groups vg ON v.id = vg.vehicle_id
      JOIN organizations o ON v.org_id = o.id
      WHERE vg.group_id = $1 AND v.is_active = TRUE
      GROUP BY v.org_id, o.name
    `, [groupId]);
    console.log("\nOrg breakdown of the 19 vehicles:");
    vehicleOrgs.rows.forEach(r => console.log(`  ${r.org_name}: ${r.count} vehicles`));

  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
debug();
