const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'fueltracks1',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  connectionTimeoutMillis: 5000,
});

async function main() {
  console.log('[MIGRATION] Running geofence & route migration...');
  const client = await pool.connect();
  try {
    const filePath = path.join(__dirname, '..', 'database', 'geofence_route_migration.sql');
    const sql = fs.readFileSync(filePath, 'utf8');
    await client.query(sql);
    console.log('[MIGRATION] ✓ Successfully created geofences, routes, and link tables.');
  } catch (err) {
    console.error('[MIGRATION] Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
