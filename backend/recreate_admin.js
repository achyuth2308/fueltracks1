const bcrypt = require('bcryptjs');
const db = require('./config/db');

async function run() {
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('admin123', salt);
    
    // Get org id
    const orgRes = await db.query("SELECT id FROM organizations WHERE name = 'FuelTracks Platform' LIMIT 1");
    if (orgRes.rows.length === 0) {
      console.log('Org not found!');
      process.exit(1);
    }
    const orgId = orgRes.rows[0].id;

    // Check if user exists
    const userRes = await db.query("SELECT id FROM users WHERE email = 'admin@fueltracks.in'");
    if (userRes.rows.length > 0) {
      console.log('User already exists, updating password and setting active...');
      await db.query("UPDATE users SET password = $1, is_active = true WHERE email = 'admin@fueltracks.in'", [hash]);
    } else {
      console.log('Creating new user...');
      await db.query(
        "INSERT INTO users (org_id, email, password, role, name, phone, is_active) VALUES ($1, 'admin@fueltracks.in', $2, 'superadmin', 'Super Admin', '+919999999999', true)",
        [orgId, hash]
      );
    }
    console.log('Admin user recreated!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
