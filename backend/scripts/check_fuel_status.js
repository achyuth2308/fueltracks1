const { pool } = require('../config/db');

async function check() {
  try {
    const cols = await pool.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name IN ('vehicle_fuel_states', 'vehicle_fuel_configs', 'manual_fuel_logs')
      ORDER BY table_name, ordinal_position
    `);
    console.log('TABLE_COLS:', JSON.stringify(cols.rows, null, 2));

    const vehs = await pool.query(`
      SELECT v.id, v.plate, v.imei, vfs.*, vfc.*
      FROM vehicles v
      LEFT JOIN vehicle_fuel_configs vfc ON v.id = vfc.vehicle_id
      LEFT JOIN vehicle_fuel_states vfs ON v.id = vfs.vehicle_id
      WHERE v.plate ILIKE '%TS08UH1234%' OR v.imei ILIKE '%867010074683211%'
    `);
    console.log('VEHICLE_DATA:', JSON.stringify(vehs.rows, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  }
}

check();
