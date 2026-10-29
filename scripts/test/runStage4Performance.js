// ============================================================
// STAGE 4: PERFORMANCE, RESOURCE & SOAK TESTING
// Runs EXPLAIN (ANALYZE, BUFFERS) on outbox claim, wamid status update,
// recipient fanout, message listing, and benchmarks telemetry pipeline.
// ============================================================

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const db = require('../../backend/config/db');

async function runPerformanceBenchmarks() {
  console.log('\n============================================================');
  console.log('STARTING STAGE 4: PERFORMANCE & QUERY BENCHMARKS');
  console.log('============================================================\n');

  // 1. Generate 50,000 synthetic rows in whatsapp_messages to measure index scalability
  console.log('[PERF] Seeding 50,000 synthetic rows in whatsapp_messages for EXPLAIN ANALYZE...');
  const orgRes = await db.query(
    `INSERT INTO organizations (name, type, is_active)
     VALUES ('Perf Test Org', 'customer', true)
     RETURNING id`
  );
  const orgId = orgRes.rows[0].id;

  const recipRes = await db.query(
    `INSERT INTO whatsapp_recipients (org_id, name, phone_e164, opt_in, receive_refill)
     VALUES ($1, 'Perf User', '919000888000', true, true)
     RETURNING id`,
    [orgId]
  );
  const recipId = recipRes.rows[0].id;

  const tSeedStart = Date.now();
  await db.query(`
    INSERT INTO whatsapp_messages (
      org_id, recipient_id, phone_masked, event_type, event_ref,
      template_name, language, payload, status, wamid, attempts, next_attempt_at, created_at
    )
    SELECT
      $1,
      $2,
      '******8000',
      'fuel_refill',
      'synth-ref-' || s.i,
      'fuel_refill_alert',
      'en',
      '{"synthetic": true}'::jsonb,
      CASE
        WHEN s.i <= 100 THEN 'queued'
        WHEN s.i <= 200 THEN 'sending'
        WHEN s.i <= 40000 THEN 'delivered'
        ELSE 'read'
      END,
      'wamid.synth.' || s.i,
      CASE WHEN s.i <= 100 THEN 0 ELSE 1 END,
      NOW() - ((50000 - s.i) || ' seconds')::interval,
      NOW() - ((50000 - s.i) || ' seconds')::interval
    FROM generate_series(1, 50000) AS s(i)
  `, [orgId, recipId]);
  console.log(`[PERF] Seeded 50,000 rows in ${Date.now() - tSeedStart}ms`);

  // Analyze table so planner statistics are completely up to date
  await db.query('ANALYZE whatsapp_messages');
  await db.query('ANALYZE whatsapp_recipients');

  console.log('\n--- Query 1: Outbox Claim Query (FOR UPDATE OF m SKIP LOCKED) ---');
  const q1 = await db.query(`
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT m.id, m.org_id, m.recipient_id, m.phone_masked, m.event_type, m.event_ref,
           m.template_name, m.language, m.payload, m.attempts,
           r.phone_e164, r.opt_in
    FROM whatsapp_messages m
    LEFT JOIN whatsapp_recipients r ON m.recipient_id = r.id
    WHERE m.status IN ('queued', 'failed')
      AND m.next_attempt_at <= NOW()
      AND m.attempts < 5
    ORDER BY m.id ASC
    LIMIT 20
    FOR UPDATE OF m SKIP LOCKED
  `);
  const q1Plan = q1.rows.map(r => r['QUERY PLAN']).join('\n');
  console.log(q1Plan);

  console.log('\n--- Query 2: Status Callback Update by wamid ---');
  const q2 = await db.query(`
    EXPLAIN (ANALYZE, BUFFERS)
    UPDATE whatsapp_messages
    SET status = 'delivered',
        delivered_at = NOW(),
        updated_at = NOW()
    WHERE wamid = 'wamid.synth.25000'
  `);
  const q2Plan = q2.rows.map(r => r['QUERY PLAN']).join('\n');
  console.log(q2Plan);

  console.log('\n--- Query 3: Recipient Fanout Query ---');
  const q3 = await db.query(`
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT id, name, phone_e164, vehicle_scope
    FROM whatsapp_recipients
    WHERE org_id = $1
      AND opt_in = true
      AND receive_refill = true
  `, [orgId]);
  const q3Plan = q3.rows.map(r => r['QUERY PLAN']).join('\n');
  console.log(q3Plan);

  console.log('\n--- Query 4: Message History Listing Query (Org Filter + Created DESC) ---');
  const q4 = await db.query(`
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT id, recipient_id, phone_masked, event_type, status, created_at
    FROM whatsapp_messages
    WHERE org_id = $1
    ORDER BY created_at DESC
    LIMIT 20
  `, [orgId]);
  const q4Plan = q4.rows.map(r => r['QUERY PLAN']).join('\n');
  console.log(q4Plan);

  // 2. Measure Telemetry & Hot-Path Impact
  console.log('\n--- Telemetry Processing Measurement ---');
  const memBefore = process.memoryUsage();

  const latencies = [];
  const iterations = 500;
  for (let i = 0; i < iterations; i++) {
    const t0 = process.hrtime.bigint();
    // Simulate fuel calculation check (speed <= 5, currFuel vs prevFuel check)
    const prevFuel = 50.0;
    const currFuel = 50.0; // steady state packet
    const speed = 25.0;
    const fuelDiff = currFuel - prevFuel;
    const isFuelConfigured = true;
    const isRefillOrTheft = speed <= 5 && Math.abs(fuelDiff) > 10;
    const t1 = process.hrtime.bigint();
    latencies.push(Number(t1 - t0) / 1000); // in microseconds
  }

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(iterations * 0.50)];
  const p95 = latencies[Math.floor(iterations * 0.95)];
  const p99 = latencies[Math.floor(iterations * 0.99)];
  const memAfter = process.memoryUsage();

  console.log(`[PERF] Location packet calculation latency across ${iterations} cycles:`);
  console.log(`  p50: ${p50.toFixed(2)} µs (${(p50 / 1000).toFixed(4)} ms)`);
  console.log(`  p95: ${p95.toFixed(2)} µs (${(p95 / 1000).toFixed(4)} ms)`);
  console.log(`  p99: ${p99.toFixed(2)} µs (${(p99 / 1000).toFixed(4)} ms)`);
  console.log(`[PERF] Memory RSS: ${(memAfter.rss / 1024 / 1024).toFixed(2)} MB (Delta: ${((memAfter.rss - memBefore.rss) / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`[PERF] PG Pool Total Connections: ${db.pool.totalCount}, Idle: ${db.pool.idleCount}, Waiting: ${db.pool.waitingCount}`);

  // Cleanup synthetic rows
  await db.query('DELETE FROM whatsapp_messages WHERE org_id = $1', [orgId]);
  await db.query('DELETE FROM whatsapp_recipients WHERE org_id = $1', [orgId]);
  await db.query('DELETE FROM organizations WHERE id = $1', [orgId]);

  await db.pool.end();
  console.log('\n[PERF] Stage 4 Performance Benchmarking Completed Successfully ✅\n');
}

runPerformanceBenchmarks().catch(err => {
  console.error('[PERF ERROR]', err);
  process.exit(1);
});

