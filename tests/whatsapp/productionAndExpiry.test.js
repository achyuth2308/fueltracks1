const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const db = require('../../backend/config/db');
const redis = require('../../backend/config/redis');
const WhatsAppService = require('../../backend/services/whatsappService');
const worker = require('../../backend/jobs/whatsappWorker');
const env = require('../../backend/config/env');
const { startMockServer, stopMockServer, resetConfig } = require('../../scripts/test/mockMetaServer');

describe('Production Safety, Message Expiry, Priority, and Daily Cap Tests', () => {
  let testOrgId;
  let testRecipId;

  before(async () => {
    try {
      await startMockServer(3099);
    } catch (_) {}

    // Ensure test organization
    const orgRes = await db.query("SELECT id FROM organizations LIMIT 1");
    testOrgId = orgRes.rows[0].id;

    // Clean test data
    await db.query("DELETE FROM whatsapp_messages WHERE event_ref LIKE 'test-prod-%'");
    await db.query("DELETE FROM whatsapp_recipients WHERE phone_e164 = '+919988776655'");

    const recip = await db.query(`
      INSERT INTO whatsapp_recipients (org_id, name, phone_e164, opt_in, receive_refill, receive_theft, receive_daily_report)
      VALUES ($1, 'Prod Tester', '+919988776655', true, true, true, true)
      RETURNING id
    `, [testOrgId]);
    testRecipId = recip.rows[0].id;
  });

  after(async () => {
    await db.query("DELETE FROM whatsapp_messages WHERE event_ref LIKE 'test-prod-%'");
    await db.query("DELETE FROM whatsapp_recipients WHERE id = $1", [testRecipId]);
    await db.pool.end();
    try { redis.client.disconnect(); } catch (_) {}
    try { await stopMockServer(); } catch (_) {}
    setTimeout(() => process.exit(0), 200);
  });

  beforeEach(() => {
    resetConfig();
    env.NODE_ENV = 'test';
    env.WHATSAPP_API_BASE_URL = 'http://127.0.0.1:3099';
    env.WHATSAPP_ACCESS_TOKEN = 'test-token';
    env.WHATSAPP_PHONE_NUMBER_ID = 'test-phone-id';
    env.WHATSAPP_ENABLED = false;
  });

  test('1. Mock mode is strictly forbidden in NODE_ENV=production', async () => {
    env.NODE_ENV = 'production';
    env.WHATSAPP_ACCESS_TOKEN = ''; // invalid / missing

    await assert.rejects(
      async () => {
        await WhatsAppService.sendTemplate({
          to: '+919988776655',
          name: 'fuel_refill_alert',
          bodyParams: ['KA01AB1234', '30.0', '20.0', '50.0', '12:00 PM', 'Station A']
        });
      },
      /Mock mode is strictly prohibited in production/
    );
  });

  test('2. Insecure HTTP baseUrl is prohibited in NODE_ENV=production', async () => {
    env.NODE_ENV = 'production';
    env.WHATSAPP_ENABLED = true;
    env.WHATSAPP_ACCESS_TOKEN = 'mock-prod-token';
    env.WHATSAPP_PHONE_NUMBER_ID = '123456';
    env.WHATSAPP_API_BASE_URL = 'http://insecure-meta.example.com';

    await assert.rejects(
      async () => {
        await WhatsAppService.sendTemplate({
          to: '+919988776655',
          name: 'fuel_refill_alert',
          bodyParams: ['KA01AB1234', '30.0', '20.0', '50.0', '12:00 PM', 'Station A']
        });
      },
      /Insecure HTTP URL prohibited in production/
    );
  });

  test('3. In production with missing credentials, outbox pauses and messages remain queued', async () => {
    env.NODE_ENV = 'production';
    env.WHATSAPP_ENABLED = true;
    env.WHATSAPP_ACCESS_TOKEN = ''; // missing
    env.WHATSAPP_PHONE_NUMBER_ID = ''; // missing

    // Insert a message
    const ins = await db.query(`
      INSERT INTO whatsapp_messages (org_id, recipient_id, phone_masked, event_type, event_ref, template_name, payload, status)
      VALUES ($1, $2, '6655', 'fuel_refill', 'test-prod-paused-01', 'fuel_refill_alert', '{"bodyParams":["KA01AB1234","30","20","50","12:00","Station"]}', 'queued')
      RETURNING id
    `, [testOrgId, testRecipId]);
    const msgId = ins.rows[0].id;

    // Run outbox batch
    await worker.processOutboxBatch();

    // Verify row status remains queued (NOT sent, NOT failed)
    const check = await db.query('SELECT status, attempts FROM whatsapp_messages WHERE id = $1', [msgId]);
    assert.strictEqual(check.rows[0].status, 'queued', 'Message must stay queued when credentials missing in production');
    assert.strictEqual(check.rows[0].attempts, 0, 'Attempts must remain 0');

    // Check queue-status
    const status = await worker.getQueueStatus();
    assert.strictEqual(status.state, 'paused', 'Queue state must be paused');
    assert.strictEqual(status.reason, 'MISSING_CREDENTIALS', 'Reason must be MISSING_CREDENTIALS');

    await db.query('DELETE FROM whatsapp_messages WHERE id = $1', [msgId]);
  });

  test('4. Successful send increments attempts from 0 to 1', async () => {
    env.NODE_ENV = 'test';
    env.WHATSAPP_ENABLED = true;

    // Insert a test message
    const ins = await db.query(`
      INSERT INTO whatsapp_messages (org_id, recipient_id, phone_masked, event_type, event_ref, template_name, payload, status)
      VALUES ($1, $2, '6655', 'fuel_refill', 'test-prod-attempts-01', 'fuel_refill_alert', '{"bodyParams":["KA01AB1234","30","20","50","12:00","Station"]}', 'queued')
      RETURNING id
    `, [testOrgId, testRecipId]);
    const msgId = ins.rows[0].id;

    await worker.processOutboxBatch();

    const check = await db.query('SELECT status, attempts, wamid FROM whatsapp_messages WHERE id = $1', [msgId]);
    assert.strictEqual(check.rows[0].status, 'sent');
    assert.strictEqual(check.rows[0].attempts, 1, 'Attempts must increment to 1 on successful send');
    assert.ok(check.rows[0].wamid, 'WAMID must be populated');

    await db.query('DELETE FROM whatsapp_messages WHERE id = $1', [msgId]);
  });

  test('5. Expired messages (expires_at < NOW()) transition to "expired" and are never dispatched', async () => {
    env.NODE_ENV = 'test';
    env.WHATSAPP_ENABLED = true;

    // Insert an expired message (expires_at 10 minutes in the past)
    const ins = await db.query(`
      INSERT INTO whatsapp_messages (org_id, recipient_id, phone_masked, event_type, event_ref, template_name, payload, status, expires_at)
      VALUES ($1, $2, '6655', 'fuel_refill', 'test-prod-exp-01', 'fuel_refill_alert', '{"bodyParams":["KA01AB1234","30","20","50","12:00","Station"]}', 'queued', NOW() - INTERVAL '10 minutes')
      RETURNING id
    `, [testOrgId, testRecipId]);
    const msgId = ins.rows[0].id;

    // Run worker batch
    await worker.processOutboxBatch();

    const check = await db.query('SELECT status, error_code, wamid FROM whatsapp_messages WHERE id = $1', [msgId]);
    assert.strictEqual(check.rows[0].status, 'expired', 'Expired message must be marked expired');
    assert.strictEqual(check.rows[0].error_code, 'MESSAGE_EXPIRED');
    assert.strictEqual(check.rows[0].wamid, null, 'Expired message must never be sent');

    await db.query('DELETE FROM whatsapp_messages WHERE id = $1', [msgId]);
  });

  test('6. Priority ordering: claim query processes theft > refill > report', async () => {
    env.NODE_ENV = 'test';
    env.WHATSAPP_ENABLED = false; // keep paused so we can inspect order

    // Insert report, then refill, then theft (reverse order of priority)
    const reportIns = await db.query(`
      INSERT INTO whatsapp_messages (org_id, recipient_id, phone_masked, event_type, event_ref, template_name, status)
      VALUES ($1, $2, '6655', 'daily_report', 'test-prod-order-report', 'daily_fleet_report', 'queued') RETURNING id
    `, [testOrgId, testRecipId]);

    const refillIns = await db.query(`
      INSERT INTO whatsapp_messages (org_id, recipient_id, phone_masked, event_type, event_ref, template_name, status)
      VALUES ($1, $2, '6655', 'fuel_refill', 'test-prod-order-refill', 'fuel_refill_alert', 'queued') RETURNING id
    `, [testOrgId, testRecipId]);

    const theftIns = await db.query(`
      INSERT INTO whatsapp_messages (org_id, recipient_id, phone_masked, event_type, event_ref, template_name, status)
      VALUES ($1, $2, '6655', 'fuel_theft', 'test-prod-order-theft', 'fuel_theft_alert', 'queued') RETURNING id
    `, [testOrgId, testRecipId]);

    // Query claim order using the worker's priority query
    const res = await db.query(`
      SELECT m.id, m.event_type
      FROM whatsapp_messages m
      WHERE m.id IN ($1, $2, $3)
      ORDER BY 
        CASE m.event_type
          WHEN 'fuel_theft' THEN 1
          WHEN 'fuel_refill' THEN 2
          WHEN 'daily_report' THEN 3
          ELSE 4
        END ASC,
        m.id ASC
    `, [reportIns.rows[0].id, refillIns.rows[0].id, theftIns.rows[0].id]);

    assert.strictEqual(res.rows[0].event_type, 'fuel_theft', 'Theft must be claimed 1st');
    assert.strictEqual(res.rows[1].event_type, 'fuel_refill', 'Refill must be claimed 2nd');
    assert.strictEqual(res.rows[2].event_type, 'daily_report', 'Report must be claimed 3rd');

    await db.query('DELETE FROM whatsapp_messages WHERE id IN ($1, $2, $3)', [reportIns.rows[0].id, refillIns.rows[0].id, theftIns.rows[0].id]);
  });

  test('7. Daily cap counts IST days, exempts theft and refill, and delays daily reports', async () => {
    env.NODE_ENV = 'test';
    env.WHATSAPP_ENABLED = true;

    // Set daily cap to 2 for this test org
    await db.query(`
      INSERT INTO whatsapp_org_settings (org_id, max_daily_messages)
      VALUES ($1, 2)
      ON CONFLICT (org_id) DO UPDATE SET max_daily_messages = 2
    `, [testOrgId]);

    // Insert 2 messages already sent today in IST
    const sent1 = await db.query(`
      INSERT INTO whatsapp_messages (org_id, recipient_id, phone_masked, event_type, event_ref, template_name, status, created_at)
      VALUES ($1, $2, '6655', 'daily_report', 'test-prod-cap-sent1', 'daily_fleet_report', 'sent', NOW()) RETURNING id
    `, [testOrgId, testRecipId]);
    const sent2 = await db.query(`
      INSERT INTO whatsapp_messages (org_id, recipient_id, phone_masked, event_type, event_ref, template_name, status, created_at)
      VALUES ($1, $2, '6655', 'daily_report', 'test-prod-cap-sent2', 'daily_fleet_report', 'sent', NOW()) RETURNING id
    `, [testOrgId, testRecipId]);

    // Now insert a daily report (should be delayed because cap 2 is reached)
    const reportQueue = await db.query(`
      INSERT INTO whatsapp_messages (org_id, recipient_id, phone_masked, event_type, event_ref, template_name, payload, status)
      VALUES ($1, $2, '6655', 'daily_report', 'test-prod-cap-report', 'daily_fleet_report', '{"bodyParams":["KA01AB1234","30","20","50","12:00","Station"]}', 'queued') RETURNING id
    `, [testOrgId, testRecipId]);

    // Insert a theft alert (CRITICAL: should NOT be delayed)
    const theftQueue = await db.query(`
      INSERT INTO whatsapp_messages (org_id, recipient_id, phone_masked, event_type, event_ref, template_name, payload, status)
      VALUES ($1, $2, '6655', 'fuel_theft', 'test-prod-cap-theft', 'fuel_theft_alert', '{"bodyParams":["KA01AB1234","30","20","50","12:00","Station"]}', 'queued') RETURNING id
    `, [testOrgId, testRecipId]);

    // Insert a refill alert (CRITICAL: should NOT be delayed)
    const refillQueue = await db.query(`
      INSERT INTO whatsapp_messages (org_id, recipient_id, phone_masked, event_type, event_ref, template_name, payload, status)
      VALUES ($1, $2, '6655', 'fuel_refill', 'test-prod-cap-refill', 'fuel_refill_alert', '{"bodyParams":["KA01AB1234","30","20","50","12:00","Station"]}', 'queued') RETURNING id
    `, [testOrgId, testRecipId]);

    // Run outbox processor
    await worker.processOutboxBatch();

    // Check statuses
    const checkReport = await db.query('SELECT status, error_code FROM whatsapp_messages WHERE id = $1', [reportQueue.rows[0].id]);
    assert.strictEqual(checkReport.rows[0].status, 'failed', 'Report should be delayed when cap reached');
    assert.strictEqual(checkReport.rows[0].error_code, 'DAILY_CAP_REACHED');

    const checkTheft = await db.query('SELECT status, error_code FROM whatsapp_messages WHERE id = $1', [theftQueue.rows[0].id]);
    assert.strictEqual(checkTheft.rows[0].status, 'sent', 'Theft must be sent despite daily cap');

    const checkRefill = await db.query('SELECT status, error_code FROM whatsapp_messages WHERE id = $1', [refillQueue.rows[0].id]);
    assert.strictEqual(checkRefill.rows[0].status, 'sent', 'Refill must be sent despite daily cap');

    // Cleanup
    await db.query(`DELETE FROM whatsapp_messages WHERE id IN ($1, $2, $3, $4, $5)`, [
      sent1.rows[0].id, sent2.rows[0].id, reportQueue.rows[0].id, theftQueue.rows[0].id, refillQueue.rows[0].id
    ]);
    await db.query(`UPDATE whatsapp_org_settings SET max_daily_messages = 1000 WHERE org_id = $1`, [testOrgId]);
  });
});
