const db = require('../config/db');

async function run() {
  try {
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS temp_password VARCHAR(255);');
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS no_data_minutes INT DEFAULT 30;');
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(255);');
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(255);');
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS aadhar VARCHAR(255);');
    await db.query("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;");
    await db.query("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS device_limits JSONB DEFAULT '{\"Starter\":0,\"Basic\":0,\"Advanced\":0,\"Premium\":0}'::jsonb;");
    console.log('MIGRATION_SUCCESS');
    process.exit(0);
  } catch (err) {
    console.error('MIGRATION_ERROR:', err);
    process.exit(1);
  }
}

run();
