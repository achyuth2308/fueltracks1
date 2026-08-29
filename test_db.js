const { Client } = require('pg');

async function run() {
  const client = new Client({
    user: 'fueltracks_user',
    host: 'localhost',
    database: 'fueltracks',
    password: 'fueltracks_password',
    port: 5432
  });
  
  await client.connect();
  
  // 1. Get user groups
  const ugRes = await client.query('SELECT * FROM user_groups');
  console.log("User Groups:", ugRes.rows);
  
  // 2. Get vehicle groups
  const vgRes = await client.query('SELECT * FROM vehicle_groups');
  console.log("Vehicle Groups:", vgRes.rows);
  
  // 3. Count moving points in the last 24 hours
  const moveRes = await client.query(`
    SELECT vehicle_id, COUNT(*) 
    FROM gps_points 
    WHERE speed > 0 AND device_time > NOW() - INTERVAL '48 HOURS' 
    GROUP BY vehicle_id
  `);
  console.log("Moving GPS Points (last 48 hours):", moveRes.rows);
  
  await client.end();
}

run().catch(console.error);
