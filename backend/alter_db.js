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
    await pool.query("ALTER TABLE vehicles ALTER COLUMN plate TYPE VARCHAR(100);");
    console.log("Successfully altered plate column to VARCHAR(100)");
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
main();
