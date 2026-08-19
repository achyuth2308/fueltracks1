// LOCAL DEBUG TOOL — not part of the production application.
// Run with: node backend/query.js
// Reads DB credentials from .env (same file used by the server).
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const client = new Client({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || '127.0.0.1',
  database: process.env.DB_NAME || 'fueltracks',
  password: process.env.DB_PASS,   // no hardcoded fallback — must be in .env
  port: process.env.DB_PORT || 5432,
});


async function check() {
  await client.connect();
  try {
    const res = await client.query("SELECT id, name FROM vehicles;");
    console.log("Vehicle:", JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
check();
