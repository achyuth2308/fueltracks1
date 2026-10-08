const db = require('./backend/config/db');
async function run() {
  const grps = await db.query("SELECT id, name FROM groups WHERE name ILIKE '%sathya%'");
  console.log("Groups:", grps.rows);
  
  for (let grp of grps.rows) {
      const res = await db.query(`
          SELECT v.plate, v.imei 
          FROM vehicles v 
          JOIN vehicle_groups vg ON v.id = vg.vehicle_id 
          WHERE vg.group_id = $1
      `, [grp.id]);
      console.log(`Vehicles in group ${grp.name}:`, res.rows.length);
      console.log(JSON.stringify(res.rows, null, 2));
  }
  process.exit(0);
}
run();
