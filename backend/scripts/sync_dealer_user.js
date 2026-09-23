const db = require('../config/db');
const bcrypt = require('bcryptjs');

async function syncDealerUser() {
  try {
    const passwordHash = await bcrypt.hash('Madhu@123$$', 10);
    const email = 'madhumathidonuru@gmail.com';
    const name = 'Madhumathi';
    const orgId = 'a0000000-0000-0000-0000-000000000002';

    console.log(`[Sync] Updating dealer user for org ${orgId}...`);
    await db.query(
      `UPDATE users 
       SET email = $1, name = $2, password = $3 
       WHERE org_id = $4 AND role = 'dealer'`,
      [email, name, passwordHash, orgId]
    );

    // Also ensure organizations table has name 'Madhumathi Trackers'
    await db.query(
      `UPDATE organizations SET name = $1 WHERE id = $2`,
      ['Madhumathi Trackers', orgId]
    );

    const check = await db.query(
      `SELECT id, name, email, role, org_id FROM users WHERE email = $1`,
      [email]
    );

    console.log('[Sync] User in database:', check.rows[0]);
    console.log('[Sync] Done! You can now log in with email:', email, 'and password: Madhu@123$$');
    process.exit(0);
  } catch (err) {
    console.error('[Sync] Error:', err);
    process.exit(1);
  }
}

syncDealerUser();
