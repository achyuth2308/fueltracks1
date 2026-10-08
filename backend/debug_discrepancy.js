const db = require('./config/db');

async function debug() {
  // Find ALLVEHICLES group
  const grp = await db.query("SELECT id FROM groups WHERE name = 'ALLVEHICLES'");
  const groupId = grp.rows[0].id;
  
  // How many vehicles does the superadmin API return (no groupId filter)?
  const allVehicles = await db.query("SELECT COUNT(*) as c FROM vehicles WHERE is_active = TRUE");
  console.log("All active vehicles (no group filter):", allVehicles.rows[0].c);

  // How many vehicles does the groupId-filtered API return?
  const groupVehicles = await db.query(
    "SELECT COUNT(*) as c FROM vehicles v JOIN vehicle_groups vg ON v.id = vg.vehicle_id WHERE vg.group_id = $1 AND v.is_active = TRUE",
    [groupId]
  );
  console.log("Vehicles in ALLVEHICLES group:", groupVehicles.rows[0].c);

  // Are there vehicles in the group that are NOT in the 'all vehicles' query for superadmin?
  // Superadmin sees all vehicles with is_active = TRUE
  // Group has 258 vehicles. But all active is 252. So 6 vehicles in group are is_active=FALSE!
  const orphaned = await db.query(
    "SELECT v.name, v.is_active FROM vehicles v JOIN vehicle_groups vg ON v.id = vg.vehicle_id WHERE vg.group_id = $1 AND v.is_active = FALSE",
    [groupId]
  );
  console.log("Inactive vehicles still in ALLVEHICLES group:", orphaned.rows.length);
  orphaned.rows.forEach(r => console.log(" -", r.name, "active:", r.is_active));

  process.exit(0);
}
debug();
