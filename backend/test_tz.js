const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS,
  database: process.env.DB_NAME || 'fueltracks',
});

async function run() {
  const query = `
    SELECT 
      ((NOW() AT TIME ZONE 'Asia/Kolkata')::date) as just_date,
      ((NOW() AT TIME ZONE 'Asia/Kolkata')::date AT TIME ZONE 'Asia/Kolkata' AT TIME ZONE 'UTC') as correct_utc_start
  `;
  const { rows } = await pool.query(query);
  console.log(rows);
  pool.end();
}
run();
