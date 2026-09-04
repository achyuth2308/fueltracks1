const env = require('./backend/config/env');
const { Pool } = require('pg');

async function check() {
  const pool = new Pool({
    user: env.DB_USER,
    host: env.DB_HOST,
    database: env.DB_NAME,
    password: env.DB_PASSWORD,
    port: env.DB_PORT,
  });
  
  // Find BSTPL_2
  const vehicle = await pool.query(`SELECT id, org_id FROM vehicles WHERE name = 'BSTPL_2'`);
  console.log("BSTPL_2:", vehicle.rows[0]);
  
  if (vehicle.rows.length) {
    const vid = vehicle.rows[0].id;
    // Find all users assigned to it
    const users = await pool.query(`
      SELECT ug.user_id 
      FROM vehicle_groups vg 
      JOIN user_groups ug ON ug.group_id = vg.group_id 
      WHERE vg.vehicle_id = $1
    `, [vid]);
    console.log("Users assigned to BSTPL_2:", users.rows);
  }
  
  await pool.end();
}
check();
