// ============================================================
// DATABASE INITIALIZER HELPER
// Reads schema.sql and seed.sql, and executes them against PostgreSQL
// Run using: node scripts/dbInit.js
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

async function initDb() {
  console.log(`[DB-INIT] Connecting to PostgreSQL database: "${process.env.DB_NAME || 'fueltracks1'}"...`);

  let client;
  try {
    client = await pool.connect();
    console.log('[DB-INIT] Connected successfully.');

    // 1. Read schema.sql
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    console.log(`[DB-INIT] Reading schema from: ${schemaPath}`);
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // 2. Execute schema.sql
    console.log('[DB-INIT] Executing schema.sql (Creating tables, indexes, triggers)...');
    await client.query(schemaSql);
    console.log('[DB-INIT] Schema loaded successfully.');

    // 3. Read seed.sql
    const seedPath = path.join(__dirname, '..', 'database', 'seed.sql');
    console.log(`[DB-INIT] Reading seed data from: ${seedPath}`);
    const seedSql = fs.readFileSync(seedPath, 'utf8');

    // 4. Execute seed.sql
    console.log('[DB-INIT] Executing seed.sql (Inserting default organizations, users, vehicles)...');
    await client.query(seedSql);
    console.log('[DB-INIT] Seed data loaded successfully.');

    // 5. Execute migrations
    console.log('[DB-INIT] Running database migrations...');
    const migrations = [
      'devices_migration.sql',
      'audit_migration.sql',
      'profile_migration.sql',
      'geofence_route_migration.sql',
      'raw_packets_enhancement_migration.sql',
      'raw_packets_maintenance_migration.sql'
    ];

    for (const migrationFile of migrations) {
      const filePath = path.join(__dirname, '..', 'database', migrationFile);
      if (fs.existsSync(filePath)) {
        console.log(`[DB-INIT] Executing migration: ${migrationFile}...`);
        const migSql = fs.readFileSync(filePath, 'utf8');
        await client.query(migSql);
      }
    }
    console.log('[DB-INIT] All migrations applied successfully.');

    console.log('============================================================');
    console.log('  DATABASE INITIALIZATION COMPLETE!');
    console.log('  Tables created, Seed data & Migrations applied.');
    console.log('============================================================');

  } catch (err) {
    console.error('[DB-INIT] Database initialization failed:');
    console.error(err.message);
    if (err.code === '3D000') {
      console.error(`\n[TIP] The database "${process.env.DB_NAME || 'fueltracks1'}" does not exist.`);
      console.error(`Please create the database first using pgAdmin or run:`);
      console.error(`CREATE DATABASE ${process.env.DB_NAME || 'fueltracks1'};`);
    }
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

initDb();
