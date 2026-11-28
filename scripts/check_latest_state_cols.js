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
  const c = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'vehicle_latest_state'");
  console.log('vehicle_latest_state cols:', c.rows.map(r => r.column_name));
  await pool.end();
}

main().catch(console.error);
