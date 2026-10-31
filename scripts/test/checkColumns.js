const db = require('../../backend/config/db');

async function check() {
  const col1 = await db.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'vehicle_latest_state' AND column_name = 'today_distance'
  `);
  const col2 = await db.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'alerts' AND column_name = 'is_read'
  `);
  console.log('vehicle_latest_state.today_distance:', col1.rows);
  console.log('alerts.is_read:', col2.rows);
  await db.pool.end();
}

check().catch(console.error);

