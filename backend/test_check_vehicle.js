const db = require('./config/db');

async function test() {
  const result = await db.query(`
    SELECT vg.vehicle_id 
    FROM vehicle_groups vg
    JOIN vehicles v ON vg.vehicle_id = v.id
    JOIN groups g ON vg.group_id = g.id
    WHERE v.name = 'AP04X5678' AND g.name = 'ALLVEHICLES'
  `);
  console.log("Is AP04X5678 in ALLVEHICLES?", result.rows.length > 0);
  process.exit(0);
}
test();
