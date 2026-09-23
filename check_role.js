const { Pool } = require('pg');
const env = require('./backend/config/env');
const pool = new Pool({ host: env.DB_HOST, port: env.DB_PORT, database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASS });

async function run() {
  const client = await pool.connect();
  const res = await client.query("SELECT role FROM users WHERE username = 'sreesathyadeva'");
  console.log('Role:', res.rows[0].role);
  client.release();
  await pool.end();
}
run().catch(console.error);
