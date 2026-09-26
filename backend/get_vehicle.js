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
    const res = await pool.query("SELECT * FROM vehicles WHERE id = '021b476c-d251-4277-bedd-4eb4589af133'");
    console.log(JSON.stringify(res.rows[0], null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
main();
