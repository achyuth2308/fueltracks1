const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'fueltracks',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
});

async function checkMigrations() {
  console.log(`Checking migrations on database: ${process.env.DB_NAME || 'fueltracks'}`);
  let client;
  try {
    client = await pool.connect();
    
    // Check tables
    const { rows: tablesRes } = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `);
    const tables = tablesRes.map(r => r.table_name);

    // Check columns
    const { rows: colsRes } = await client.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public';
    `);
    const columns = colsRes.map(r => `${r.table_name}.${r.column_name}`);

    const checks = [
      { name: 'Devices Migration', isApplied: tables.includes('devices') },
      { name: 'Audit Logs Migration', isApplied: tables.includes('audit_logs') },
      { name: 'Organization Profiles Migration', isApplied: columns.includes('organizations.address') },
      { name: 'Geofences and Routes Migration', isApplied: tables.includes('geofences') },
      { name: 'Raw Packets Maintenance Migration', isApplied: tables.includes('raw_packets') },
      { name: 'API Keys Migration', isApplied: tables.includes('api_keys') },
      { name: 'FCM Notifications Migration', isApplied: tables.includes('user_fcm_tokens') },
      { name: 'Forgot Password Migration', isApplied: columns.includes('users.reset_password_token') },
      { name: 'Category & Onboarding Migration', isApplied: columns.includes('vehicles.category') },
      { name: 'Mining Registrations Migration', isApplied: tables.includes('mining_registrations') },
    ];

    console.log('\n--- Migration Status ---');
    checks.forEach(c => {
      console.log(`[${c.isApplied ? 'APPLIED' : 'MISSING'}] ${c.name}`);
    });

    const missing = checks.filter(c => !c.isApplied);
    if (missing.length === 0) {
      console.log('\n✅ All known migrations appear to be applied.');
    } else {
      console.log(`\n❌ Found ${missing.length} unapplied migrations.`);
    }

  } catch (err) {
    console.error('Error checking migrations:', err.message);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

checkMigrations();
