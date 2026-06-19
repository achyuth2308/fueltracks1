const { Pool } = require('pg');
const pool = new Pool({
  host: '127.0.0.1',
  port: 5432,
  database: 'fueltracks',
  user: 'postgres',
  password: 'achyu',
});

async function run() {
  try {
    const res = await pool.query("SELECT * FROM vehicle_groups WHERE group_id = '917eba9c-b61e-4c03-bd73-75e27e221c61'");
    console.log("GROUP_VEHICLES:", JSON.stringify(res.rows, null, 2));
    
    const allVeh = await pool.query("SELECT id, name, plate FROM vehicles");
    console.log("ALL_VEHICLES:", JSON.stringify(allVeh.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
