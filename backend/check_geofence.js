// LOCAL DEBUG TOOL — not part of the production application.
// Run with: node backend/check_geofence.js
// Reads DB credentials from .env (same file used by the server).
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS,   // no hardcoded fallback — must be in .env
  database: process.env.DB_NAME || 'fueltracks',
});


async function main() {
  try {
    const resGeofences = await pool.query('SELECT * FROM geofences');
    console.log('Geofences:', resGeofences.rows);

    const resAssign = await pool.query('SELECT * FROM vehicle_geofences');
    console.log('Vehicle Geofences Assignments:', resAssign.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
