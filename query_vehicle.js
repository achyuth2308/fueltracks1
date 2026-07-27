const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:achyu@127.0.0.1:5432/fueltracks' });
async function run() {
  const res = await pool.query(`SELECT id, name, imei FROM vehicles WHERE id = 'a9a3b5d2-69dd-4c0e-9b6b-f0344f53aeb0'`);
  console.log('Vehicle ID from URL:', res.rows);
  const res2 = await pool.query(`SELECT id, name, imei FROM vehicles WHERE name = 'Activa'`);
  console.log('Activa:', res2.rows);
  pool.end();
}
run();
