// ============================================================
// AUDIT MIGRATION RUNNER
// One-time script to create the audit_logs table
// Usage: node backend/scripts/runAuditMigration.js
// ============================================================

const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function runMigration() {
  try {
    console.log('[AUDIT MIGRATION] Starting...');
    const sql = fs.readFileSync(
      path.join(__dirname, '../../database/audit_migration.sql'),
      'utf8'
    );
    await db.query(sql);
    console.log('[AUDIT MIGRATION] ✓ audit_logs table created successfully.');
    process.exit(0);
  } catch (err) {
    console.error('[AUDIT MIGRATION] ✗ Failed:', err.message);
    process.exit(1);
  }
}

runMigration();
