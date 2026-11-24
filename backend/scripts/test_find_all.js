const VehicleModel = require('../models/vehicleModel');
const { pool } = require('../config/db');

async function test() {
  try {
    const userRes = await pool.query("SELECT * FROM users WHERE username = 'fuel'");
    const user = userRes.rows[0];
    console.log('USER:', user);

    const result = await VehicleModel.findAll(user.org_id, user.role, {
      page: 1,
      limit: 100,
      userId: user.id
    });

    console.log('VEHICLES COUNT:', result.vehicles.length);
    console.log('VEHICLES:', JSON.stringify(result.vehicles.map(v => ({
      id: v.id,
      plate: v.plate,
      imei: v.imei,
      current_fuel: v.current_fuel,
      tank_capacity: v.tank_capacity,
      manual_tank_capacity: v.manual_tank_capacity,
      last_seen: v.last_seen,
      is_online: v.is_online
    })), null, 2));

    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  }
}

test();
