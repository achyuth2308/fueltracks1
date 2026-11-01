const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { Client } = require('pg');
const env = require('../backend/config/env');

async function testMigrationUpDown() {
  console.log('--- STARTING UP/DOWN MIGRATION TEST ON DB COPY ---');

  const rootClient = new Client({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASS,
    database: 'postgres'
  });

  await rootClient.connect();

  const testDbName = 'fueltracks_test_migration';
  console.log(`[TEST-MIGRATE] Preparing clean database: ${testDbName}...`);
  await rootClient.query(`DROP DATABASE IF EXISTS ${testDbName}`);
  await rootClient.query(`CREATE DATABASE ${testDbName}`);
  await rootClient.end();

  const testClient = new Client({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASS,
    database: testDbName,
    options: '-c timezone=UTC'
  });

  await testClient.connect();

  try {
    // 1. Setup prerequisite base tables for foreign keys and verify existing row counts
    console.log('[TEST-MIGRATE] Setting up prerequisite tables (organizations, users, vehicles, devices)...');
    await testClient.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL
      );
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL
      );
      CREATE TABLE IF NOT EXISTS devices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        device_id VARCHAR(50) UNIQUE NOT NULL,
        imei VARCHAR(20) NOT NULL
      );
      CREATE TABLE IF NOT EXISTS vehicles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        plate_number VARCHAR(20) NOT NULL,
        device_id UUID REFERENCES devices(id)
      );

      -- Insert baseline rows into existing tables
      INSERT INTO organizations (name) VALUES ('Acme Fleet'), ('Global Logistics');
      INSERT INTO users (name) VALUES ('Admin User'), ('Operations Driver');
      INSERT INTO devices (device_id, imei) VALUES ('DEV-001', '861329085344688');
      INSERT INTO vehicles (plate_number) VALUES ('KA05LT0001');
    `);

    async function getRowCounts() {
      const orgs = await testClient.query('SELECT COUNT(*) FROM organizations');
      const users = await testClient.query('SELECT COUNT(*) FROM users');
      const devs = await testClient.query('SELECT COUNT(*) FROM devices');
      const vehs = await testClient.query('SELECT COUNT(*) FROM vehicles');
      return {
        organizations: parseInt(orgs.rows[0].count, 10),
        users: parseInt(users.rows[0].count, 10),
        devices: parseInt(devs.rows[0].count, 10),
        vehicles: parseInt(vehs.rows[0].count, 10)
      };
    }

    const initialCounts = await getRowCounts();
    console.log('[TEST-MIGRATE] Existing table row counts BEFORE UP migration:', initialCounts);

    // 2. Run UP Migration
    console.log('[TEST-MIGRATE] Executing document_scanner_migration.sql (UP)...');
    const upSql = fs.readFileSync(path.join(__dirname, '..', 'database', 'document_scanner_migration.sql'), 'utf8');
    await testClient.query(upSql);
    console.log('[TEST-MIGRATE] ✓ UP migration executed successfully.');

    const postUpCounts = await getRowCounts();
    console.log('[TEST-MIGRATE] Existing table row counts AFTER UP migration:', postUpCounts);

    // Verify tables exist
    const tablesRes = await testClient.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('document_scans', 'document_scan_fields')
      ORDER BY table_name;
    `);
    console.log('[TEST-MIGRATE] Created tables:', tablesRes.rows.map(r => r.table_name));
    if (tablesRes.rows.length !== 2) throw new Error('Expected 2 tables to be created');

    // Verify indexes exist
    const indexesRes = await testClient.query(`
      SELECT indexname, indexdef FROM pg_indexes 
      WHERE schemaname = 'public' AND tablename IN ('document_scans', 'document_scan_fields')
      ORDER BY indexname;
    `);
    console.log('[TEST-MIGRATE] Created indexes:');
    indexesRes.rows.forEach(idx => console.log(`  - ${idx.indexname}: ${idx.indexdef}`));

    // Verify idempotency unique index definition has status NOT IN ('failed', 'rejected', 'purged')
    const uqIndex = indexesRes.rows.find(i => i.indexname === 'uq_document_scans_org_hash');
    if (!uqIndex) throw new Error('uq_document_scans_org_hash index missing');
    const isPredicateValid = (uqIndex.indexdef.includes('NOT IN') || uqIndex.indexdef.includes('<> ALL')) && 
                             uqIndex.indexdef.includes('purged') &&
                             uqIndex.indexdef.includes('failed') &&
                             uqIndex.indexdef.includes('rejected');
    if (!isPredicateValid) {
      throw new Error('uq_document_scans_org_hash does not contain the required status predicate');
    }
    console.log('[TEST-MIGRATE] ✓ Unique idempotency index predicate verified.');

    // 3. Test insert & unique constraint
    console.log('[TEST-MIGRATE] Testing insertion and idempotency index...');
    const orgRes = await testClient.query(`SELECT id FROM organizations LIMIT 1`);
    const orgId = orgRes.rows[0].id;
    const dummyHash = 'a'.repeat(64);

    await testClient.query(`
      INSERT INTO document_scans (org_id, file_name, file_path, file_hash, file_size, mime_type, status)
      VALUES ($1, 'test.pdf', '/tmp/test.pdf', $2, 1024, 'application/pdf', 'queued')
    `, [orgId, dummyHash]);

    // Test duplicate queued insert fails with 23505
    let dupFailed = false;
    try {
      await testClient.query(`
        INSERT INTO document_scans (org_id, file_name, file_path, file_hash, file_size, mime_type, status)
        VALUES ($1, 'test2.pdf', '/tmp/test2.pdf', $2, 1024, 'application/pdf', 'queued')
      `, [orgId, dummyHash]);
    } catch (err) {
      if (err.code === '23505') dupFailed = true;
    }
    if (!dupFailed) throw new Error('Expected duplicate (org_id, file_hash) with status=queued to be rejected by unique index');
    console.log('[TEST-MIGRATE] ✓ Duplicate upload on active scan correctly blocked by unique index.');

    // 4. Run DOWN Migration
    console.log('[TEST-MIGRATE] Executing document_scanner_migration_down.sql (DOWN)...');
    const downSql = fs.readFileSync(path.join(__dirname, '..', 'database', 'document_scanner_migration_down.sql'), 'utf8');
    await testClient.query(downSql);
    console.log('[TEST-MIGRATE] ✓ DOWN migration executed successfully.');

    // Verify tables are dropped
    const postDownRes = await testClient.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('document_scans', 'document_scan_fields');
    `);
    if (postDownRes.rows.length !== 0) throw new Error('Expected tables to be dropped by DOWN migration');
    console.log('[TEST-MIGRATE] ✓ Verified all document scanner tables dropped cleanly.');

    const finalCounts = await getRowCounts();
    console.log('[TEST-MIGRATE] Existing table row counts AFTER DOWN migration:', finalCounts);
    assert.deepStrictEqual(initialCounts, finalCounts, 'Existing table row counts must remain completely unchanged across UP and DOWN');
    console.log('[TEST-MIGRATE] ✓ Existing table row counts identically preserved across entire migration lifecycle.');

    console.log('--- UP/DOWN MIGRATION TEST COMPLETED SUCCESSFULLY! ---');
  } finally {
    await testClient.end();
    // Cleanup test database
    const cleanupClient = new Client({
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASS,
      database: 'postgres'
    });
    await cleanupClient.connect();
    await cleanupClient.query(`DROP DATABASE IF EXISTS ${testDbName}`);
    await cleanupClient.end();
  }
}

testMigrationUpDown().catch(err => {
  console.error('[TEST-MIGRATE] FAILED:', err);
  process.exit(1);
});
