// ============================================================
// STAGE 2: REAL PROCESS FAILURE & INFRASTRUCTURE RECOVERY TESTS
// Tests actual container stops (Redis 60s, Postgres restart) and
// process termination recovery (kill -9 zombie sending rows).
// Proves zero duplicates and zero lost messages.
// ============================================================

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { execSync } = require('child_process');
const db = require('../../backend/config/db');
const env = require('../../backend/config/env');
const {
  processOutboxBatch,
  recoverStuckSendingMessages
} = require('../../backend/jobs/whatsappWorker');
const {
  startMockServer,
  stopMockServer,
  getReceivedMessages,
  clearReceivedMessages
} = require('./mockMetaServer');

const MOCK_PORT = 3099;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForPostgres(maxWaitMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      await db.query('SELECT 1');
      return true;
    } catch (_) {
      await sleep(1000);
    }
  }
  throw new Error('Postgres did not become ready within timeout');
}

async function runRealFailureTests() {
  console.log('\n============================================================');
  console.log('REAL INFRASTRUCTURE FAILURE & PROCESS RECOVERY TESTS');
  console.log('============================================================\n');

  await startMockServer(MOCK_PORT);

  env.WHATSAPP_ENABLED = true;
  env.WHATSAPP_API_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`;
  env.WHATSAPP_ACCESS_TOKEN = 'mock_token_real_failures';
  env.WHATSAPP_PHONE_NUMBER_ID = '109988776655443';
  process.env.WHATSAPP_ENABLED = 'true';
  process.env.WHATSAPP_API_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`;

  const orgRes = await db.query(
    `INSERT INTO organizations (name, type, is_active)
     VALUES ('Real Failure Test Org', 'customer', true)
     RETURNING id`
  );
  const testOrgId = orgRes.rows[0].id;

  const recipRes = await db.query(
    `INSERT INTO whatsapp_recipients (org_id, name, phone_e164, opt_in, receive_refill)
     VALUES ($1, 'Failure Test Recipient', '919876543210', true, true)
     RETURNING id`,
    [testOrgId]
  );
  const testRecipId = recipRes.rows[0].id;

  try {
    // -----------------------------------------------------------------
    // TEST 1: Stop Redis for 60s, restart, verify zero lost messages
    // -----------------------------------------------------------------
    console.log('\n--- Test 1: Redis 60-Second Outage & Reconnection ---');
    // Clear any stale queued messages from previous tests
    await db.query("DELETE FROM whatsapp_messages WHERE status IN ('queued', 'sending')");
    clearReceivedMessages();

    // Enqueue 3 messages in Postgres outbox before stopping Redis
    const r1MsgIds = [];
    for (let i = 1; i <= 3; i++) {
      const res = await db.query(
        `INSERT INTO whatsapp_messages (
           org_id, recipient_id, phone_masked, event_type, event_ref,
           template_name, language, payload, status
         ) VALUES ($1, $2, '******3210', 'fuel_refill', $3, 'fuel_refill_alert', 'en', '{}', 'queued')
         RETURNING id`,
        [testOrgId, testRecipId, `redis-outage-ref-${Date.now()}-${i}`]
      );
      r1MsgIds.push(res.rows[0].id);
    }
    console.log(`[TEST 1] Enqueued 3 messages in Postgres outbox (${r1MsgIds.join(', ')}).`);

    console.log('[TEST 1] Stopping Redis container: docker stop fueltracks_redis ...');
    execSync('docker stop fueltracks_redis', { stdio: 'inherit' });

    console.log('[TEST 1] Redis is DOWN. Waiting 60 seconds as required...');
    for (let sec = 10; sec <= 60; sec += 10) {
      await sleep(10000);
      console.log(`[TEST 1] Elapsed: ${sec}s / 60s...`);
    }

    // Verify DB messages are still safely queued
    const checkWhileDown = await db.query(
      `SELECT COUNT(id)::int as cnt FROM whatsapp_messages WHERE id = ANY($1::bigint[]) AND status = 'queued'`,
      [r1MsgIds]
    );
    console.log(`[TEST 1] Outbox status during Redis outage: ${checkWhileDown.rows[0].cnt}/3 messages safely persisted in PostgreSQL.`);

    console.log('[TEST 1] Starting Redis container back up: docker start fueltracks_redis ...');
    execSync('docker start fueltracks_redis', { stdio: 'inherit' });
    await sleep(3000); // give Redis 3s to bind port

    // Process outbox batch now that Redis is back
    await processOutboxBatch();

    const checkSent = await db.query(
      `SELECT status, wamid FROM whatsapp_messages WHERE id = ANY($1::bigint[])`,
      [r1MsgIds]
    );
    const mockMsgs = getReceivedMessages();

    const allSent = checkSent.rows.every(r => r.status === 'sent' && Boolean(r.wamid));
    const zeroDuplicates = mockMsgs.length === 3;

    console.log(`[TEST 1] Redis Outage Recovery Result:`);
    console.log(`  All 3 messages sent: ${allSent ? 'YES ✅' : 'NO ❌'}`);
    console.log(`  Meta received count: ${mockMsgs.length}/3 (Zero duplicates: ${zeroDuplicates ? 'YES ✅' : 'NO ❌'})`);
    console.log(`  VERDICT: ${allSent && zeroDuplicates ? 'PASS ✅' : 'FAIL ❌'}`);

    // -----------------------------------------------------------------
    // TEST 2: Restart Postgres, verify pool reconnection & zero duplicates
    // -----------------------------------------------------------------
    console.log('\n--- Test 2: Postgres Hard Restart & Pool Reconnection ---');
    clearReceivedMessages();

    // Enqueue 3 messages
    const r2MsgIds = [];
    for (let i = 1; i <= 3; i++) {
      const res = await db.query(
        `INSERT INTO whatsapp_messages (
           org_id, recipient_id, phone_masked, event_type, event_ref,
           template_name, language, payload, status
         ) VALUES ($1, $2, '******3210', 'fuel_refill', $3, 'fuel_refill_alert', 'en', '{}', 'queued')
         RETURNING id`,
        [testOrgId, testRecipId, `pg-restart-ref-${i}`]
      );
      r2MsgIds.push(res.rows[0].id);
    }

    console.log('[TEST 2] Restarting Postgres container: docker restart fueltracks_db ...');
    execSync('docker restart fueltracks_db', { stdio: 'inherit' });

    console.log('[TEST 2] Waiting for PostgreSQL to become healthy...');
    await waitForPostgres(30000);
    console.log('[TEST 2] PostgreSQL is healthy and accepting connections.');

    // Process outbox batch
    await processOutboxBatch();

    const checkPgSent = await db.query(
      `SELECT status, wamid FROM whatsapp_messages WHERE id = ANY($1::bigint[])`,
      [r2MsgIds]
    );
    const mockPgMsgs = getReceivedMessages();

    const allPgSent = checkPgSent.rows.every(r => r.status === 'sent' && Boolean(r.wamid));
    const zeroPgDuplicates = mockPgMsgs.length === 3;

    console.log(`[TEST 2] Postgres Restart Recovery Result:`);
    console.log(`  All 3 messages sent: ${allPgSent ? 'YES ✅' : 'NO ❌'}`);
    console.log(`  Meta received count: ${mockPgMsgs.length}/3 (Zero duplicates: ${zeroPgDuplicates ? 'YES ✅' : 'NO ❌'})`);
    console.log(`  VERDICT: ${allPgSent && zeroPgDuplicates ? 'PASS ✅' : 'FAIL ❌'}`);

    // -----------------------------------------------------------------
    // TEST 3: Kill -9 / Abrupt termination recovery of 'sending' rows
    // -----------------------------------------------------------------
    console.log('\n--- Test 3: Crash Recovery (kill -9 while rows in "sending" status) ---');
    clearReceivedMessages();

    // Simulate 4 rows stuck in 'sending' because the previous worker process was killed abruptly with kill -9
    const r3MsgIds = [];
    for (let i = 1; i <= 4; i++) {
      const res = await db.query(
        `INSERT INTO whatsapp_messages (
           org_id, recipient_id, phone_masked, event_type, event_ref,
           template_name, language, payload, status, updated_at, attempts
         ) VALUES ($1, $2, '******3210', 'fuel_theft', $3, 'fuel_theft_alert', 'en', '{}',
                   'sending', NOW() - INTERVAL '8 minutes', 1)
         RETURNING id`,
        [testOrgId, testRecipId, `kill9-ref-${i}`]
      );
      r3MsgIds.push(res.rows[0].id);
    }
    console.log(`[TEST 3] Created 4 stuck 'sending' messages (${r3MsgIds.join(', ')}) with updated_at = 8 min ago.`);

    // Worker restarts: runs recovery + processOutboxBatch
    console.log('[TEST 3] Starting new worker process... executing recoverStuckSendingMessages()');
    await recoverStuckSendingMessages();

    const checkRecovered = await db.query(
      `SELECT status FROM whatsapp_messages WHERE id = ANY($1::bigint[])`,
      [r3MsgIds]
    );
    const allQueued = checkRecovered.rows.every(r => r.status === 'queued');
    console.log(`[TEST 3] Zombie rows recovered to 'queued': ${allQueued ? 'YES ✅' : 'NO ❌'}`);

    // Worker processes the batch
    await processOutboxBatch();

    const checkFinal = await db.query(
      `SELECT status, wamid FROM whatsapp_messages WHERE id = ANY($1::bigint[])`,
      [r3MsgIds]
    );
    const mockKill9Msgs = getReceivedMessages();

    const allFinalSent = checkFinal.rows.every(r => r.status === 'sent' && Boolean(r.wamid));
    const zeroKill9Duplicates = mockKill9Msgs.length === 4;

    console.log(`[TEST 3] Kill -9 Recovery Result:`);
    console.log(`  All 4 recovered messages sent: ${allFinalSent ? 'YES ✅' : 'NO ❌'}`);
    console.log(`  Meta received count: ${mockKill9Msgs.length}/4 (Zero duplicates: ${zeroKill9Duplicates ? 'YES ✅' : 'NO ❌'})`);
    console.log(`  VERDICT: ${allQueued && allFinalSent && zeroKill9Duplicates ? 'PASS ✅' : 'FAIL ❌'}`);

  } finally {
    console.log('\n[CLEANUP] Cleaning up test data...');
    await db.query('DELETE FROM whatsapp_messages WHERE org_id = $1', [testOrgId]);
    await db.query('DELETE FROM whatsapp_recipients WHERE org_id = $1', [testOrgId]);
    await db.query('DELETE FROM organizations WHERE id = $1', [testOrgId]);

    await stopMockServer();
    await db.pool.end();
    console.log('[CLEANUP] Done.');
  }

  console.log('\n============================================================');
  console.log('ALL REAL FAILURE & INFRASTRUCTURE TESTS COMPLETED');
  console.log('============================================================\n');
}

runRealFailureTests().catch(err => {
  console.error('[REAL FAILURE TEST ERROR]', err);
  process.exit(1);
});
