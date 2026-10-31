const db = require('../../backend/config/db');

async function check() {
  const cols = await db.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'gps_points'
    ORDER BY ordinal_position
  `);
  console.log('Columns in gps_points:', cols.rows);
  const sample = await db.query('SELECT * FROM gps_points LIMIT 2');
  console.log('Sample row:', sample.rows);
  await db.pool.end();
}

check().catch(console.error);

