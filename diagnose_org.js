const db = require('./backend/config/db');

async function run() {
  try {
    console.log('=== 1. SUPERADMIN USERS ===');
    const users = await db.query(`
      SELECT u.id, u.username, u.name, u.email, u.role, u.org_id, o.name as org_name
      FROM users u
      LEFT JOIN organizations o ON u.org_id = o.id
      WHERE u.role = 'superadmin' OR u.username = 'admin'
    `);
    console.log(JSON.stringify(users.rows, null, 2));

    console.log('=== 2. ALL ORGANIZATIONS ===');
    const orgs = await db.query(`
      SELECT id, name, type, parent_id, is_active, created_at
      FROM organizations
      ORDER BY created_at ASC
    `);
    console.log(JSON.stringify(orgs.rows, null, 2));

    console.log('=== 3. ORGANIZATIONS TABLE COLUMNS ===');
    const cols = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'organizations'
      ORDER BY ordinal_position
    `);
    console.log(JSON.stringify(cols.rows, null, 2));

    console.log('=== 4. BRANDING PROFILES ===');
    const brands = await db.query(`
      SELECT * FROM dealer_branding
    `);
    console.log(JSON.stringify(brands.rows, null, 2));

  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    process.exit(0);
  }
}
run();
