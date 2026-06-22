const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'fueltracks1',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
});

async function run() {
  try {
    console.log('Deleting all organizations except the super admin organization...');
    // This will cascade and delete all users, vehicles, groups, devices, etc. associated with those orgs
    const res = await pool.query("DELETE FROM organizations WHERE id != 'a0000000-0000-0000-0000-000000000001';");
    console.log(`Deleted ${res.rowCount} organizations and all their cascaded data.`);
  } catch(e) {
    console.error('Error:', e);
  } finally {
    pool.end();
  }
}
run();
