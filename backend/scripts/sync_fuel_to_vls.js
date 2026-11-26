const { pool } = require('../config/db');

async function syncAll() {
  try {
    const res = await pool.query(`
      SELECT vfs.vehicle_id, vfs.current_fuel, vfs.last_known_odometer
      FROM vehicle_fuel_states vfs
    `);

    for (const row of res.rows) {
      if (row.current_fuel != null) {
        await pool.query(`
          INSERT INTO vehicle_latest_state (vehicle_id, fuel, last_seen)
          VALUES ($1, $2, NOW())
          ON CONFLICT (vehicle_id) DO UPDATE SET fuel = $2
        `, [row.vehicle_id, row.current_fuel]);
        console.log(`Synced vehicle ${row.vehicle_id} -> fuel ${row.current_fuel}L`);
      }
    }
    console.log('All vehicle fuel states synced to vehicle_latest_state.');
    process.exit(0);
  } catch (err) {
    console.error('Error syncing:', err);
    process.exit(1);
  }
}

syncAll();
