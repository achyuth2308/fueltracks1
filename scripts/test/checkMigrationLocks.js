// ============================================================
// DDL MIGRATION LOCK BENCHMARK (1M ROWS)
// Proves lock acquisition duration and concurrency during migration
// ============================================================

'use strict';

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433', 10),
  database: process.env.DB_NAME || 'fueltracks',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'fuel',
  max: 10
});

async function run() {
  console.log('[DDL-LOCK] Starting DDL lock duration benchmark on 1,000,000 rows...');

  const client1 = await pool.connect();
  const client2 = await pool.connect();

  try {
    // 1. Setup a test table with 1,000,000 rows mimicking alerts table
    console.log('[DDL-LOCK] Creating benchmark table ddl_lock_test_1m with 1,000,000 rows...');
    await client1.query(`
      DROP TABLE IF EXISTS ddl_lock_test_1m CASCADE;
      CREATE TABLE ddl_lock_test_1m (
        id BIGSERIAL PRIMARY KEY,
        vehicle_id UUID NOT NULL DEFAULT gen_random_uuid(),
        alert_type VARCHAR(50) NOT NULL,
        alert_text TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client1.query(`
      INSERT INTO ddl_lock_test_1m (alert_type, alert_text, created_at)
      SELECT
        CASE WHEN (i % 2 = 0) THEN 'fuel_theft' ELSE 'fuel_refill' END,
        'Alert test message number ' || i,
        NOW() - (i || ' seconds')::interval
      FROM generate_series(1, 1000000) AS i;
    `);

    const countRes = await client1.query('SELECT COUNT(*) FROM ddl_lock_test_1m');
    console.log(`[DDL-LOCK] Seeded ${countRes.rows[0].count} rows.`);

    // 2. Measure Lock Duration for:
    // A) ALTER TABLE ADD COLUMN IF NOT EXISTS (Postgres 11+ metadata-only update)
    console.log('\n--- Test A: ALTER TABLE ADD COLUMN is_read BOOLEAN DEFAULT false ---');
    let lockSamplesA = [];
    let samplingA = true;

    const samplerPromiseA = (async () => {
      while (samplingA) {
        const res = await client2.query(`
          SELECT locktype, mode, granted
          FROM pg_locks
          WHERE relation = 'ddl_lock_test_1m'::regclass;
        `);
        if (res.rows.length > 0) {
          lockSamplesA.push(...res.rows);
        }
        await new Promise(r => setTimeout(r, 5));
      }
    })();

    const startA = process.hrtime.bigint();
    await client1.query('ALTER TABLE ddl_lock_test_1m ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;');
    const elapsedA_ms = Number(process.hrtime.bigint() - startA) / 1e6;
    samplingA = false;
    await samplerPromiseA;

    console.log(`[DDL-LOCK] ALTER TABLE completed in: ${elapsedA_ms.toFixed(2)} ms`);
    console.log(`[DDL-LOCK] Observed locks during ALTER:`, lockSamplesA.map(l => l.mode));

    // B) CREATE INDEX ON 1M ROWS
    console.log('\n--- Test B: CREATE INDEX ON 1M ROWS ---');
    let lockSamplesB = [];
    let samplingB = true;

    const samplerPromiseB = (async () => {
      while (samplingB) {
        const res = await client2.query(`
          SELECT locktype, mode, granted
          FROM pg_locks
          WHERE relation = 'ddl_lock_test_1m'::regclass;
        `);
        if (res.rows.length > 0) {
          lockSamplesB.push(...res.rows);
        }
        await new Promise(r => setTimeout(r, 10));
      }
    })();

    // Concurrent read verification during index creation
    let concurrentReads = 0;
    let readErrors = 0;
    let reading = true;
    const readerPromise = (async () => {
      while (reading) {
        try {
          await client2.query('SELECT id FROM ddl_lock_test_1m WHERE id = $1', [Math.floor(Math.random() * 1000000) + 1]);
          concurrentReads++;
        } catch (e) {
          readErrors++;
        }
        await new Promise(r => setTimeout(r, 10));
      }
    })();

    const startB = process.hrtime.bigint();
    await client1.query('CREATE INDEX IF NOT EXISTS idx_ddl_test_unread ON ddl_lock_test_1m (vehicle_id) WHERE is_read IS NOT TRUE;');
    const elapsedB_ms = Number(process.hrtime.bigint() - startB) / 1e6;
    samplingB = false;
    reading = false;
    await samplerPromiseB;
    await readerPromise;

    console.log(`[DDL-LOCK] CREATE INDEX completed in: ${elapsedB_ms.toFixed(2)} ms`);
    console.log(`[DDL-LOCK] Concurrent SELECT queries served during CREATE INDEX: ${concurrentReads}`);
    console.log(`[DDL-LOCK] Concurrent SELECT errors: ${readErrors}`);
    console.log(`[DDL-LOCK] Observed lock modes during index build:`, Array.from(new Set(lockSamplesB.map(l => l.mode))));

    // C) Test whatsapp_messages schema lock check
    console.log('\n--- Test C: whatsapp_messages migration DDL lock check ---');
    const startC = process.hrtime.bigint();
    await client1.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_messages_lock_test (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        recipient_phone VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'queued',
        attempts INT NOT NULL DEFAULT 0,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_wmlt_claim ON whatsapp_messages_lock_test (status, created_at);
      CREATE INDEX IF NOT EXISTS idx_wmlt_expires ON whatsapp_messages_lock_test (expires_at) WHERE status IN ('queued', 'failed');
    `);
    const elapsedC_ms = Number(process.hrtime.bigint() - startC) / 1e6;
    console.log(`[DDL-LOCK] whatsapp_messages DDL execution time: ${elapsedC_ms.toFixed(2)} ms`);

    // Clean up
    await client1.query('DROP TABLE IF EXISTS ddl_lock_test_1m CASCADE; DROP TABLE IF EXISTS whatsapp_messages_lock_test CASCADE;');
    console.log('\n[DDL-LOCK] SUCCESS: DDL Lock Benchmark complete. Cleaned up temporary test tables.');
  } finally {
    client1.release();
    client2.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('[DDL-LOCK] FATAL:', err);
  process.exit(1);
});
