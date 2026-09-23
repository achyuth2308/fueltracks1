const { Pool } = require('pg');
const env = require('./backend/config/env');

const pool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASS,
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('--- Searching for Sathyadeva users ---');
    const res = await client.query(`
      SELECT u.id, u.username, u.email, u.is_active, o.name AS org_name
      FROM users u
      LEFT JOIN organizations o ON o.id = u.org_id
      WHERE u.username ILIKE '%sathya%' OR u.email ILIKE '%sathya%' OR o.name ILIKE '%sathya%'
    `);
    
    if (res.rows.length === 0) {
      console.log('No users found matching that pattern.');
    } else {
      res.rows.forEach(u => {
        console.log(`Username: "${u.username}" | Email: "${u.email}" | Active: ${u.is_active} | Org: "${u.org_name}"`);
      });
    }
  } finally {
    client.release();
    await pool.end();
  }
}
run().catch(console.error);
