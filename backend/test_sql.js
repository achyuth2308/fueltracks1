const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS,
  database: process.env.DB_NAME || 'fueltracks',
});

async function run() {
  const role = 'superadmin';
  const orgId = '521945a0-a75d-4f16-b118-84cd2c86b668'; // Assume some org ID, wait, superadmin queries all
  
  let whereClause = '';
  const params = [];
  if (role !== 'superadmin') {
    whereClause = `WHERE (u.org_id = $1 OR u.org_id IN (SELECT id FROM organizations WHERE parent_id = $1))`;
    params.push(orgId);
  }

  const query = `
    SELECT u.id, u.org_id, u.email, u.username, u.role, u.name, u.phone,
           u.is_active, u.last_login, u.created_at,
           o.name as org_name,
           string_agg(g.name, ', ' ORDER BY g.name) as group_names,
           COALESCE(
             json_agg(
               json_build_object('id', g.id, 'name', g.name)
             ) FILTER (WHERE g.id IS NOT NULL),
             '[]'::json
           ) as groups
    FROM users u
    JOIN organizations o ON u.org_id = o.id
    LEFT JOIN user_groups ug ON u.id = ug.user_id
    LEFT JOIN groups g ON ug.group_id = g.id
    ${whereClause}
    GROUP BY u.id, u.org_id, u.email, u.username, u.role, u.name, u.phone,
             u.is_active, u.last_login, u.created_at, o.name
    ORDER BY u.created_at DESC
  `;

  try {
    const result = await pool.query(query, params);
    console.log(`Success! Fetched ${result.rowCount} users.`);
  } catch(e) {
    console.error("SQL Error:", e);
  } finally {
    pool.end();
  }
}
run();
