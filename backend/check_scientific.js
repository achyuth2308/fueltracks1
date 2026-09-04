const pool = require('./config/db');

async function run() {
  const res = await pool.query(`SELECT id, gps_sim_no, metadata, plate FROM vehicles WHERE plate = 'AP07TG1879'`);
  console.log(res.rows);
  
  // also select ANY vehicle with scientific notation just in case
  const res2 = await pool.query(`SELECT id, gps_sim_no FROM vehicles WHERE gps_sim_no ~* 'e'`);
  console.log('Regex E count:', res2.rows.length);
  
  pool.end();
  process.exit(0);
}
run();
