const bcrypt = require('bcryptjs');
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
    const username = 'sreesathyadeva';
    const newPassword = 'password123';
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update the DB
    const res = await client.query(
      'UPDATE users SET password = $1 WHERE username = $2 RETURNING id, username',
      [hashedPassword, username]
    );
    
    if (res.rows.length > 0) {
      console.log(`Password for user ${username} successfully reset to: ${newPassword}`);
    } else {
      console.log(`User ${username} not found!`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}
run().catch(console.error);
