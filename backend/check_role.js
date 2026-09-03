const db = require('./config/db');

async function check() {
  const res = await db.query(`SELECT id, name, role FROM users WHERE name ILIKE '%K.P.R%'`);
  console.log(res.rows);
  
  const res2 = await db.query(`SELECT COUNT(*) FROM user_groups WHERE user_id = $1`, [res.rows[0].id]);
  console.log("Groups:", res2.rows[0].count);
  process.exit(0);
}
check();
