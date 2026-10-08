const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS,
  database: process.env.DB_NAME || 'fueltracks',
});

async function run() {
  const query = `SELECT * FROM groups`;
  try {
    const { rows } = await pool.query(query);
    console.log(JSON.stringify(rows, null, 2));
  } catch(e) {
    console.error("SQL Error:", e);
  } finally {
    pool.end();
  }
}
run();
