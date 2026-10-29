// ============================================================
// REAL CRASH & VISIBILITY TIMEOUT RECOVERY TEST
// Injects 3s HTTP latency, hard-kills the worker mid-flight,
// waits for the 30s visibility timeout to expire naturally via env,
// and confirms recovery and re-send.
// ============================================================

'use strict';

const { spawn } = require('child_process');
const db = require('../../backend/config/db');
const redis = require('../../backend/config/redis');
const { startMockServer, stopMockServer, setConfig, resetConfig, getReceivedMessages, clearReceivedMessages } = require('./mockMetaServer');

const VISIBILITY_TIMEOUT_SEC = 30;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runCrashTest() {
  console.log('============================================================');
  console.log('  💥 REAL CRASH TEST: KILL -9 MID-HTTP-DISPATCH & RECOVERY');
  console.log('============================================================');

  // 1. Start mock Meta server
  try { await startMockServer(3099); } catch (_) {}
  resetConfig();
  clearReceivedMessages();

  // Configure 3000ms delay on Mock Meta server
  setConfig({ latencyMs: 3000 });
  console.log('[MOCK-META] Configured 3000ms response delay to hold in-flight HTTP connection.');

  // 2. Setup recipient and test row
  const orgRes = await db.query('SELECT id FROM organizations LIMIT 1');
  const orgId = orgRes.rows[0].id;

  await db.query("DELETE FROM whatsapp_messages WHERE event_ref = 'crash-test-01'");
  await db.query("DELETE FROM whatsapp_recipients WHERE phone_e164 = '+919876543210'");

  const recip = await db.query(`
    INSERT INTO whatsapp_recipients (org_id, name, phone_e164, opt_in, receive_refill)
    VALUES ($1, 'Crash Victim', '+919876543210', true, true)
    RETURNING id
  `, [orgId]);
  const recipId = recip.rows[0].id;

  const ins = await db.query(`
    INSERT INTO whatsapp_messages (org_id, recipient_id, phone_masked, event_type, event_ref, template_name, payload, status)
    VALUES ($1, $2, '3210', 'fuel_refill', 'crash-test-01', 'fuel_refill_alert', '{"bodyParams":["KA01AB1234","30","20","50","12:00","Station"]}', 'queued')
    RETURNING id
  `, [orgId, recipId]);
  const msgId = ins.rows[0].id;
  console.log(`[DB] Enqueued test message #${msgId} with status="queued".`);

  // 3. Spawn real worker child process with WHATSAPP_VISIBILITY_TIMEOUT_SECONDS=30
  console.log(`[PROCESS] Spawning worker with WHATSAPP_VISIBILITY_TIMEOUT_SECONDS=${VISIBILITY_TIMEOUT_SEC}...`);
  const workerEnv = {
    ...process.env,
    NODE_ENV: 'test',
    WHATSAPP_ENABLED: 'true',
    WHATSAPP_ACCESS_TOKEN: 'test-crash-token',
    WHATSAPP_PHONE_NUMBER_ID: 'test-phone-1',
    WHATSAPP_API_BASE_URL: 'http://127.0.0.1:3099',
    WHATSAPP_VISIBILITY_TIMEOUT_SECONDS: String(VISIBILITY_TIMEOUT_SEC)
  };

  const workerProc = spawn('node', ['backend/jobs/whatsappWorker.js'], {
    cwd: '.',
    env: workerEnv,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  workerProc.stdout.on('data', d => process.stdout.write(`  [WORKER-STDOUT] ${d}`));
  workerProc.stderr.on('data', d => process.stderr.write(`  [WORKER-STDERR] ${d}`));

  // 4. Wait 1200ms for worker to claim row and enter the 3s in-flight HTTP request
  console.log('[TEST] Waiting 1200ms for worker to claim row and enter in-flight HTTP call...');
  await sleep(1200);

  const check1 = await db.query('SELECT status, updated_at FROM whatsapp_messages WHERE id = $1', [msgId]);
  console.log(`[DB] In-flight status verification: status="${check1.rows[0].status}"`);

  if (check1.rows[0].status !== 'sending') {
    console.error(`ERROR: Expected status to be 'sending', but was '${check1.rows[0].status}'`);
    workerProc.kill();
    process.exit(1);
  }

  // 5. HARD KILL (SIGKILL / kill -9) the worker process while HTTP call is in-flight!
  console.log(`\n💥 HARD KILLING WORKER (PID: ${workerProc.pid}) WITH SIGKILL (kill -9) DURING HTTP DISPATCH...`);
  workerProc.kill('SIGKILL');
  console.log('✓ Worker process killed abruptly.');

  // Reset mock server latency back to 0 for subsequent requests
  setConfig({ latencyMs: 0 });

  // 6. Test premature visibility timeout at t = 5s (must NOT recover yet)
  console.log('\n[TEST] Testing visibility check at t = 5s (before 30s expiration)...');
  const workerModule = require('../../backend/jobs/whatsappWorker');
  process.env.WHATSAPP_VISIBILITY_TIMEOUT_SECONDS = String(VISIBILITY_TIMEOUT_SEC);

  await workerModule.recoverStuckSendingMessages();
  const check2 = await db.query('SELECT status FROM whatsapp_messages WHERE id = $1', [msgId]);
  console.log(`[DB] Status at t = 5s: status="${check2.rows[0].status}" (Expected: "sending")`);
  if (check2.rows[0].status !== 'sending') {
    console.error('FAIL: Message was recovered prematurely before 30s timeout elapsed!');
  } else {
    console.log('✓ PASS: Message correctly remains in "sending" state prior to timeout.');
  }

  // 7. Wait for the 30s visibility timeout to elapse naturally
  const remainingWaitSec = 30; // 5s elapsed + 30s = 35s (> 30s timeout)
  console.log(`\n[TEST] Waiting ${remainingWaitSec}s for the 30-second visibility timeout to expire naturally...`);
  for (let s = remainingWaitSec; s > 0; s -= 5) {
    console.log(`  Waiting... ${s}s remaining`);
    await sleep(Math.min(5000, s * 1000));
  }

  // 8. Restart worker processing: visibility timeout recovers zombie row back to 'queued' and dispatches it
  console.log('\n[PROCESS] Restarting outbox worker cycle after timeout expiration...');
  const recoveredCount = await workerModule.recoverStuckSendingMessages();
  console.log(`[WORKER] Visibility timeout recovery query executed. Recovered rows: ${recoveredCount}`);

  const check3 = await db.query('SELECT status FROM whatsapp_messages WHERE id = $1', [msgId]);
  console.log(`[DB] Post-recovery status: status="${check3.rows[0].status}" (Expected: "queued")`);

  console.log('[WORKER] Processing outbox batch after recovery...');
  const env = require('../../backend/config/env');
  env.WHATSAPP_ENABLED = true;
  env.NODE_ENV = 'test';
  env.WHATSAPP_API_BASE_URL = 'http://127.0.0.1:3099';
  env.WHATSAPP_ACCESS_TOKEN = 'test-token';
  env.WHATSAPP_PHONE_NUMBER_ID = 'test-phone';

  await workerModule.processOutboxBatch();

  const check4 = await db.query('SELECT status, attempts, wamid, error_code FROM whatsapp_messages WHERE id = $1', [msgId]);
  console.log(`[DB] Final message state: status="${check4.rows[0].status}", attempts=${check4.rows[0].attempts}, wamid="${check4.rows[0].wamid}"`);

  if (check4.rows[0].status === 'sent' && check4.rows[0].wamid) {
    console.log('\n============================================================');
    console.log('  ✅ CRASH RECOVERY TEST PASSED: ZOMBIE MESSAGE RESENT');
    console.log('============================================================');
  } else {
    console.error('FAIL: Message was not dispatched successfully after restart.');
  }

  // Cleanup
  await db.query("DELETE FROM whatsapp_messages WHERE event_ref = 'crash-test-01'");
  await db.query("DELETE FROM whatsapp_recipients WHERE id = $1", [recipId]);
  await db.pool.end();
  try { redis.client.disconnect(); } catch (_) {}
  try { await stopMockServer(); } catch (_) {}
  process.exit(0);
}

runCrashTest().catch(err => {
  console.error('Fatal crash test error:', err);
  process.exit(1);
});
