const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function runMigration() {
  console.log('[MIGRATION] Running Manual Fuel Monitoring schema migration...');
  const sqlPath = path.join(__dirname, 'migrate_manual_fuel.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  try {
    await db.query(sql);
    console.log('[MIGRATION] Manual Fuel Monitoring tables created successfully!');
    process.exit(0);
  } catch (err) {
    console.error('[MIGRATION] Error creating tables:', err.message);
    process.exit(1);
  }
}

runMigration();
