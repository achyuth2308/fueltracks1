const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'fueltracks1',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'fuel',
  connectionTimeoutMillis: 5000,
});

async function migrate() {
  let client;
  try {
    client = await pool.connect();
    console.log('[MIGRATE] Connected to database.');

    await client.query(`
      ALTER TABLE vehicles
      ADD COLUMN IF NOT EXISTS server_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS gps_sim_no VARCHAR(20),
      ADD COLUMN IF NOT EXISTS device_version VARCHAR(50),
      ADD COLUMN IF NOT EXISTS timezone VARCHAR(50),
      ADD COLUMN IF NOT EXISTS apn VARCHAR(100),
      ADD COLUMN IF NOT EXISTS licence_issued_date DATE,
      ADD COLUMN IF NOT EXISTS licence_expire_date DATE;
    `);

    console.log('[MIGRATE] Alter table executed successfully.');
  } catch (err) {
    console.error('[MIGRATE] Error:', err);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

migrate();
