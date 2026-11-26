const manualFuelService = require('../modules/fuel/services/manualFuelService');
const { pool } = require('../config/db');

async function testOverview() {
  try {
    const userRes = await pool.query("SELECT * FROM users WHERE username = 'fuel'");
    const user = userRes.rows[0];

    const data = await manualFuelService.getFleetFuelOverview(user.org_id, user.role, user.id);
    console.log('OVERVIEW_DATA:', JSON.stringify(data, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  }
}

testOverview();
