const { Pool } = require('pg');
require('dotenv').config({ path: 'fueltracks1/.env' });

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'fueltracks',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres'
});

async function main() {
  const v = await pool.query("SELECT id, name, plate, imei, metadata FROM vehicles WHERE imei IN ('861329087487006', '865006049210215', '865006049210216')");
  console.log('Vehicles:', JSON.stringify(v.rows, null, 2));

  // Check user relations or org_id
  const userVehicles = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%veh%' OR table_name LIKE '%user%'");
  console.log('Related tables:', userVehicles.rows.map(r => r.table_name));

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
