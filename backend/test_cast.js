const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS,
  database: process.env.DB_NAME || 'fueltracks',
});

async function run() {
  const { rows } = await pool.query(`SELECT '2026-09-29T18:30:00.000Z'::timestamp as casted_time, (NOW() AT TIME ZONE 'Asia/Kolkata')::date as today_start`);
  console.log(rows);
  pool.end();
}
run();
