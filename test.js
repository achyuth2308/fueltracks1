const db = require('./backend/config/db');
async function test() {
  try {
    const userRes = await db.query('SELECT id, name, email, role FROM users');
    console.log('Query result:', userRes.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
test();
