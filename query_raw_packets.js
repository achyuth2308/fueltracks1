const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:achyu@127.0.0.1:5432/fueltracks' });
async function run() {
  const res = await pool.query(`SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_name = 'raw_packets'`);
  console.log('raw_packets columns:', res.rows);
  
  // also let's just get the latest 5 packets from DB directly to see if they are there!
  const latest = await pool.query(`SELECT id, imei, received_at, packet_type FROM raw_packets ORDER BY received_at DESC LIMIT 5`);
  console.log('Latest 5 packets:', latest.rows);
  
  pool.end();
}
run();
