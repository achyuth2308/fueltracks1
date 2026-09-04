require('dotenv').config({path: './backend/.env'});
const { Client } = require('pg');

async function check() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  // Find BSTPL_2
  const vehicle = await client.query(`SELECT id, org_id FROM vehicles WHERE name = 'BSTPL_2'`);
  console.log("BSTPL_2:", vehicle.rows[0]);
  
  if (vehicle.rows.length) {
    const vid = vehicle.rows[0].id;
    // Find all users assigned to it
    const users = await client.query(`
      SELECT ug.user_id 
      FROM vehicle_groups vg 
      JOIN user_groups ug ON ug.group_id = vg.group_id 
      WHERE vg.vehicle_id = $1
    `, [vid]);
    console.log("Users assigned to BSTPL_2:", users.rows);
  }
  
  await client.end();
}
check();
