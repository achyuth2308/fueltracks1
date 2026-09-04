const { Client } = require('pg');
const env = require('./backend/config/env');

async function check() {
  const client = new Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  const res = await client.query(`
    SELECT v.name, ug.user_id 
    FROM vehicles v 
    LEFT JOIN vehicle_groups vg ON v.id = vg.vehicle_id 
    LEFT JOIN user_groups ug ON ug.group_id = vg.group_id 
    WHERE v.name = 'BSTPL_2'
  `);
  console.log(res.rows);
  await client.end();
}
check();
