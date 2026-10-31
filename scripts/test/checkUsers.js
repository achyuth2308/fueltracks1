const db = require('../../backend/config/db');

async function check() {
  const res = await db.query('SELECT id, role, org_id FROM users LIMIT 5');
  console.log('Existing users:', res.rows);
  await db.pool.end();
}

check().catch(console.error);

