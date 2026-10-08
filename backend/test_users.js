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
      SELECT u.id, u.org_id, u.email, u.username, u.role, u.name, u.phone,
             u.is_active, u.last_login, u.created_at,
             o.name as org_name,
             string_agg(g.name, ', ' ORDER BY g.name) as group_names
      FROM users u
      JOIN organizations o ON u.org_id = o.id
      LEFT JOIN user_groups ug ON u.id = ug.user_id
      LEFT JOIN groups g ON ug.group_id = g.id
      GROUP BY u.id, u.org_id, u.email, u.username, u.role, u.name, u.phone,
               u.is_active, u.last_login, u.created_at, o.name
      ORDER BY u.created_at DESC
      LIMIT 5
  `;
  const { rows } = await pool.query(query);
  console.log(JSON.stringify(rows, null, 2));
  pool.end();
}
run();
