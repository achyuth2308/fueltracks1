const { Pool } = require('pg');
const pool = new Pool({
  user: 'fuel',
  password: 'S7z97+Ua9V7EF64xVh6LfQfNIBKD1QyW',
  host: 'localhost',
  port: 5435,
  database: 'fueltracks',
});

async function main() {
  try {
    const res = await pool.query("SELECT updated_at, lat, lng FROM vehicle_latest_state WHERE vehicle_id = '021b476c-d251-4277-bedd-4eb4589af133';");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
main();
