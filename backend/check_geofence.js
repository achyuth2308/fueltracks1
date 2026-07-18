const { Pool } = require('pg');

const pool = new Pool({
  host: '127.0.0.1',
  port: 5432,
  user: 'postgres',
  password: 'achyu',
  database: 'fueltracks'
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
