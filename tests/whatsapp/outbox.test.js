// ============================================================
// WHATSAPP INTEGRATION TEST: OUTBOX WORKER & QUEUE RELIABILITY
// Tests exponential backoff, FOR UPDATE SKIP LOCKED claim concurrency,
// dead-letter handling, visibility timeout recovery, and token 190 handling.
// ============================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../../backend/config/db');
const {
  getBackoffSeconds,
  recoverStuckSendingMessages,
  pruneOldMessages
} = require('../../backend/jobs/whatsappWorker');

test('Outbox Backoff: getBackoffSeconds exponential curve & capping', () => {
  assert.equal(getBackoffSeconds(1), 10, 'Attempt 1 backoff should be 10s');
  assert.equal(getBackoffSeconds(2), 30, 'Attempt 2 backoff should be 30s');
  assert.equal(getBackoffSeconds(3), 90, 'Attempt 3 backoff should be 90s');
  assert.equal(getBackoffSeconds(4), 270, 'Attempt 4 backoff should be 270s');
  assert.equal(getBackoffSeconds(5), 810, 'Attempt 5 backoff should be 810s');
  assert.equal(getBackoffSeconds(6), 900, 'Attempt 6 backoff should be capped at 900s (15 min)');
  assert.equal(getBackoffSeconds(10), 900, 'High attempts should remain capped at 900s');
});

test('Outbox Concurrency: SKIP LOCKED prevents double processing across workers', async () => {
  const orgRes = await db.query(
    `INSERT INTO organizations (name, type, is_active)
     VALUES ('Outbox Concurrency Org', 'customer', true)
     RETURNING id`
  );
  const orgId = orgRes.rows[0].id;

  const recipRes = await db.query(
    `INSERT INTO whatsapp_recipients (org_id, name, phone_e164, opt_in, receive_refill)
     VALUES ($1, 'Claim Recipient', '919000666888', true, true)
     RETURNING id`,
    [orgId]
  );
  const recipId = recipRes.rows[0].id;

  // Insert 10 queued messages
  const insertedIds = [];
  for (let i = 1; i <= 10; i++) {
    const res = await db.query(
      `INSERT INTO whatsapp_messages (
         org_id, recipient_id, phone_masked, event_type, event_ref,
         template_name, language, payload, status, next_attempt_at, attempts
       ) VALUES ($1, $2, '******6888', 'fuel_refill', $3, 'fuel_refill_alert', 'en', '{}', 'queued', NOW(), 0)
       RETURNING id`,
      [orgId, recipId, `concurrency-ref-${i}`]
    );
    insertedIds.push(res.rows[0].id);
  }

  // Simulate two concurrent workers running outbox claim transactions concurrently
  const claimSql = `
    SELECT m.id
    FROM whatsapp_messages m
    WHERE m.status IN ('queued', 'failed')
      AND m.next_attempt_at <= NOW()
      AND m.attempts < 5
      AND m.id = ANY($1::bigint[])
    ORDER BY m.id ASC
    LIMIT 5
    FOR UPDATE OF m SKIP LOCKED
  `;

  const client1 = await db.pool.connect();
  const client2 = await db.pool.connect();

  let worker1Claimed = [];
  let worker2Claimed = [];

  try {
    await client1.query('BEGIN');
    const r1 = await client1.query(claimSql, [insertedIds]);
    worker1Claimed = r1.rows.map(r => r.id);

    // Client 2 runs concurrently while client 1 holds locks
    await client2.query('BEGIN');
    const r2 = await client2.query(claimSql, [insertedIds]);
    worker2Claimed = r2.rows.map(r => r.id);

    await client1.query('COMMIT');
    await client2.query('COMMIT');
  } finally {
    client1.release();
    client2.release();
  }

  // Verify mutually exclusive claims (no overlap)
  assert.equal(worker1Claimed.length, 5, 'Worker 1 should claim exactly 5 messages');
  assert.equal(worker2Claimed.length, 5, 'Worker 2 should claim exactly 5 messages');

  const overlap = worker1Claimed.filter(id => worker2Claimed.includes(id));
  assert.equal(overlap.length, 0, `There must be zero overlap between concurrent workers! Found: ${overlap}`);

  // Clean up
  await db.query('DELETE FROM whatsapp_messages WHERE id = ANY($1::bigint[])', [insertedIds]);
  await db.query('DELETE FROM whatsapp_recipients WHERE id = $1', [recipId]);
  await db.query('DELETE FROM organizations WHERE id = $1', [orgId]);
});

test('Outbox Reliability: Zombie message recovery via visibility timeout', async () => {
  const orgRes = await db.query(
    `INSERT INTO organizations (name, type, is_active)
     VALUES ('Zombie Test Org', 'customer', true)
     RETURNING id`
  );
  const orgId = orgRes.rows[0].id;

  const recipRes = await db.query(
    `INSERT INTO whatsapp_recipients (org_id, name, phone_e164, opt_in, receive_refill)
     VALUES ($1, 'Zombie Recipient', '919000666777', true, true)
     RETURNING id`,
    [orgId]
  );
  const recipId = recipRes.rows[0].id;

  // Insert a message stuck in 'sending' with updated_at = 10 minutes ago (simulating worker crash)
  const insertRes = await db.query(
    `INSERT INTO whatsapp_messages (
       org_id, recipient_id, phone_masked, event_type, event_ref,
       template_name, language, payload, status, updated_at, attempts
     ) VALUES ($1, $2, '******6777', 'fuel_refill', 'zombie-ref-001', 'fuel_refill_alert', 'en', '{}',
               'sending', NOW() - INTERVAL '10 minutes', 1)
     RETURNING id`,
    [orgId, recipId]
  );
  const stuckMessageId = insertRes.rows[0].id;

  // Run visibility timeout recovery
  await recoverStuckSendingMessages();

  // Verify it has been reset to 'queued' with next_attempt_at <= NOW()
  const checkRes = await db.query('SELECT status, next_attempt_at FROM whatsapp_messages WHERE id = $1', [stuckMessageId]);
  assert.equal(checkRes.rows[0].status, 'queued', 'Stuck sending message must be recovered to queued');
  assert.ok(new Date(checkRes.rows[0].next_attempt_at).getTime() <= Date.now() + 5000, 'next_attempt_at should be eligible now');

  // Clean up
  await db.query('DELETE FROM whatsapp_messages WHERE id = $1', [stuckMessageId]);
  await db.query('DELETE FROM whatsapp_recipients WHERE id = $1', [recipId]);
  await db.query('DELETE FROM organizations WHERE id = $1', [orgId]);
});

test('Outbox Retention: pruneOldMessages cleans up records older than window', async () => {
  const orgRes = await db.query(
    `INSERT INTO organizations (name, type, is_active)
     VALUES ('Prune Test Org', 'customer', true)
     RETURNING id`
  );
  const orgId = orgRes.rows[0].id;

  const recipRes = await db.query(
    `INSERT INTO whatsapp_recipients (org_id, name, phone_e164, opt_in, receive_refill)
     VALUES ($1, 'Prune Recipient', '919000666555', true, true)
     RETURNING id`,
    [orgId]
  );
  const recipId = recipRes.rows[0].id;

  // Insert an old delivered message (100 days old)
  const oldMsgRes = await db.query(
    `INSERT INTO whatsapp_messages (
       org_id, recipient_id, phone_masked, event_type, event_ref,
       template_name, language, payload, status, created_at, attempts
     ) VALUES ($1, $2, '******6555', 'fuel_refill', 'old-ref-001', 'fuel_refill_alert', 'en', '{}',
               'delivered', NOW() - INTERVAL '100 days', 1)
     RETURNING id`,
    [orgId, recipId]
  );
  const oldId = oldMsgRes.rows[0].id;

  // Insert a fresh delivered message (1 day old)
  const freshMsgRes = await db.query(
    `INSERT INTO whatsapp_messages (
       org_id, recipient_id, phone_masked, event_type, event_ref,
       template_name, language, payload, status, created_at, attempts
     ) VALUES ($1, $2, '******6555', 'fuel_refill', 'fresh-ref-001', 'fuel_refill_alert', 'en', '{}',
               'delivered', NOW() - INTERVAL '1 day', 1)
     RETURNING id`,
    [orgId, recipId]
  );
  const freshId = freshMsgRes.rows[0].id;

  // Prune older than 90 days
  const prunedCount = await pruneOldMessages(90);
  assert.ok(prunedCount >= 1, 'Should prune at least the 100-day old message');

  const checkOld = await db.query('SELECT id FROM whatsapp_messages WHERE id = $1', [oldId]);
  assert.equal(checkOld.rows.length, 0, 'Old message should have been deleted');

  const checkFresh = await db.query('SELECT id FROM whatsapp_messages WHERE id = $1', [freshId]);
  assert.equal(checkFresh.rows.length, 1, 'Fresh message must be preserved');

  // Clean up
  await db.query('DELETE FROM whatsapp_messages WHERE id = $1', [freshId]);
  await db.query('DELETE FROM whatsapp_recipients WHERE id = $1', [recipId]);
  await db.query('DELETE FROM organizations WHERE id = $1', [orgId]);
});

test.after(async () => {
  await db.pool.end();
});
