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
    await db.query('ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS brand_name VARCHAR(255);');
    await db.query('ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS brand_tagline VARCHAR(255);');
    await db.query("ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS primary_color VARCHAR(50) DEFAULT '#FF6A00';");
    await db.query("ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(50) DEFAULT '#2E4867';");
    await db.query('ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS footer_text TEXT;');
    await db.query('ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS support_email VARCHAR(255);');
    await db.query('ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS support_phone VARCHAR(100);');
    await db.query('ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS pan_number VARCHAR(50);');
    await db.query('ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS is_whitelabel_enabled BOOLEAN DEFAULT TRUE;');
    await db.query('ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS subdomain VARCHAR(100);');
    await db.query('ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);');
    await db.query('ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS designation VARCHAR(100);');
    await db.query('ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(100);');
    console.log('MIGRATION_SUCCESS');
    process.exit(0);
  } catch (err) {
    console.error('MIGRATION_ERROR:', err);
    process.exit(1);
  }
}

run();
