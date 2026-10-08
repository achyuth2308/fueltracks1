const db = require('./config/db');

async function check() {
  const res = await db.query("SELECT g.name, COUNT(vg.vehicle_id) as count FROM groups g LEFT JOIN vehicle_groups vg ON g.id = vg.group_id WHERE g.name = 'ALLVEHICLES' GROUP BY g.name");
  console.log(res.rows);
  process.exit(0);
}
check();
