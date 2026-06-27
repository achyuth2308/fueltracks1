// ============================================================
// DATABASE MIGRATIONS RUNNER
// Reads and executes outstanding migrations sequentially
// Run using: npm run db:migrate
// ============================================================

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'fueltracks1',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  connectionTimeoutMillis: 5000,
});

async function runMigrations() {
  console.log(`[DB-MIGRATE] Connecting to database: "${process.env.DB_NAME || 'fueltracks1'}"...`);
  
  let client;
  try {
    client = await pool.connect();
    console.log('[DB-MIGRATE] Connected successfully.');

    // 1. Proactively ensure 'metadata' column exists on 'vehicles' table
    console.log('[DB-MIGRATE] Ensuring vehicles.metadata column exists...');
    await client.query(`
      ALTER TABLE vehicles 
      ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
    `);
    console.log('[DB-MIGRATE] ✓ vehicles.metadata column verified/added.');

    // List of migration files to execute in order
    const migrations = [
      { name: 'Devices Migration', file: 'devices_migration.sql' },
      { name: 'Audit Logs Migration', file: 'audit_migration.sql' },
      { name: 'Organization Profiles Migration', file: 'profile_migration.sql' },
      { name: 'Geofences and Routes Migration', file: 'geofence_route_migration.sql' },
      { name: 'Raw Packets Enhancement Migration', file: 'raw_packets_enhancement_migration.sql' },
      { name: 'Raw Packets Maintenance Migration', file: 'raw_packets_maintenance_migration.sql' }
    ];

    for (const migration of migrations) {
      const filePath = path.join(__dirname, '..', 'database', migration.file);
      console.log(`[DB-MIGRATE] Reading ${migration.name} from: ${filePath}`);
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`Migration file not found at ${filePath}`);
      }

      const sql = fs.readFileSync(filePath, 'utf8');
      console.log(`[DB-MIGRATE] Executing ${migration.file}...`);
      await client.query(sql);
      console.log(`[DB-MIGRATE] ✓ ${migration.name} applied successfully.`);
    }

    console.log('============================================================');
    console.log('  ALL MIGRATIONS COMPLETED SUCCESSFULLY!');
    console.log('============================================================');

  } catch (err) {
    console.error('[DB-MIGRATE] Migrations failed:');
    console.error(err.message);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

runMigrations();
