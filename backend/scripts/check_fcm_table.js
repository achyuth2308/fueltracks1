const { Pool } = require('pg');

const pool = new Pool({
  host: '127.0.0.1',
  port: 5433,
  database: 'fueltracks',
  user: 'postgres',
  password: 'fuel'
});

async function check() {
  try {
    const res = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_fcm_tokens'
      );
    `);
    console.log("Table exists: ", res.rows[0].exists);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

check();
