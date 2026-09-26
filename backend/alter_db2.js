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
    await pool.query("ALTER TABLE vehicles ALTER COLUMN gps_sim_no TYPE VARCHAR(50);");
    await pool.query("ALTER TABLE vehicles ALTER COLUMN imei TYPE VARCHAR(50);");
    await pool.query("ALTER TABLE vehicles ALTER COLUMN driver_phone TYPE VARCHAR(50);");
    console.log("Successfully altered other columns.");
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
main();
