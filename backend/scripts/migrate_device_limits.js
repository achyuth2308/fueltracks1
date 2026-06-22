// One-time migration: adds device_limits column to organizations table
const db = require('../config/db');

async function migrate() {
  try {
    await db.query(`
      ALTER TABLE organizations
      ADD COLUMN IF NOT EXISTS device_limits JSONB 
      DEFAULT '{"Starter": 0, "Basic": 0, "Advanced": 0, "Premium": 0}'::jsonb
    `);
    console.log('[MIGRATION] ✓ device_limits column added to organizations');
    process.exit(0);
  } catch (err) {
    console.error('[MIGRATION] ✗ Failed:', err.message);
    process.exit(1);
  }
}

migrate();
