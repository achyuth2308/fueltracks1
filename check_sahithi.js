const { Pool } = require('pg');
const pool = new Pool({
  host: '127.0.0.1',
  port: 5432,
  database: 'fueltracks',
  user: 'postgres',
  password: 'achyu',
});

async function run() {
  try {
    const res = await pool.query("SELECT * FROM users WHERE name ILIKE '%sahithi%' OR email ILIKE '%sahithi%'");
    console.log("SAHITHI_USER:", JSON.stringify(res.rows, null, 2));

    if (res.rows.length > 0) {
      const userId = res.rows[0].id;
      const groups = await pool.query("SELECT g.* FROM groups g JOIN user_groups ug ON g.id = ug.group_id WHERE ug.user_id = $1", [userId]);
      console.log("SAHITHI_GROUPS:", JSON.stringify(groups.rows, null, 2));
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
