const fs = require('fs');
const path = require('path');
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
    // 1. Setup prerequisite base tables for foreign keys
    console.log('[TEST-MIGRATE] Setting up prerequisite tables (organizations, users)...');
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
    `);

    // 2. Run UP Migration
    console.log('[TEST-MIGRATE] Executing document_scanner_migration.sql (UP)...');
    const upSql = fs.readFileSync(path.join(__dirname, '..', 'database', 'document_scanner_migration.sql'), 'utf8');
    await testClient.query(upSql);
    console.log('[TEST-MIGRATE] ✓ UP migration executed successfully.');

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
    const orgRes = await testClient.query(`INSERT INTO organizations (name) VALUES ('Test Org') RETURNING id`);
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
