// ============================================================
// WHATSAPP INTEGRATION TEST: WEBHOOK SECURITY & EVENT HANDLING
// Tests HMAC verification, challenge handshake, status updates,
// out-of-order idempotency, and STOP/START opt-in/opt-out commands.
// ============================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { WhatsAppWebhookController, verifySignature } = require('../../backend/controllers/whatsappWebhookController');
const db = require('../../backend/config/db');

const TEST_SECRET = 'test_webhook_app_secret_1234567890';
const TEST_VERIFY_TOKEN = 'test_hub_verify_token_xyz987';

function signBody(bodyStr, secret = TEST_SECRET) {
  const hmac = crypto.createHmac('sha256', secret).update(Buffer.from(bodyStr)).digest('hex');
  return `sha256=${hmac}`;
}

test('Webhook Security: verifySignature - HMAC-SHA256 validation', () => {
  const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });

  // 1. Valid signature
  const validReq = {
    headers: { 'x-hub-signature-256': signBody(payload, TEST_SECRET) },
    rawBody: Buffer.from(payload),
    body: JSON.parse(payload)
  };
  assert.equal(verifySignature(validReq, TEST_SECRET), true, 'Valid signature should pass');

  // 2. Tampered payload
  const tamperedReq = {
    headers: { 'x-hub-signature-256': signBody(payload, TEST_SECRET) },
    rawBody: Buffer.from(payload + '{"tampered":true}'),
    body: JSON.parse(payload)
  };
  assert.equal(verifySignature(tamperedReq, TEST_SECRET), false, 'Tampered body should fail');

  // 3. Tampered signature header
  const badSigReq = {
    headers: { 'x-hub-signature-256': 'sha256=abcdef1234567890abcdef1234567890' },
    rawBody: Buffer.from(payload),
    body: JSON.parse(payload)
  };
  assert.equal(verifySignature(badSigReq, TEST_SECRET), false, 'Invalid signature hex should fail');

  // 4. Missing signature header
  const noHeaderReq = {
    headers: {},
    rawBody: Buffer.from(payload),
    body: JSON.parse(payload)
  };
  assert.equal(verifySignature(noHeaderReq, TEST_SECRET), false, 'Missing header should fail');

  // 5. Malformed header (missing sha256= prefix)
  const malformedReq = {
    headers: { 'x-hub-signature-256': 'badformat_without_prefix' },
    rawBody: Buffer.from(payload),
    body: JSON.parse(payload)
  };
  assert.equal(verifySignature(malformedReq, TEST_SECRET), false, 'Malformed header should fail');

  // 6. Security Rule: Missing app secret must unconditionally REJECT
  assert.equal(verifySignature(validReq, ''), false, 'Empty secret must reject');
  assert.equal(verifySignature(validReq, null), false, 'Null secret must reject');
});

test('Webhook Verification: GET challenge echo handshake', () => {
  process.env.WHATSAPP_VERIFY_TOKEN = TEST_VERIFY_TOKEN;

  // 1. Valid handshake
  let statusSent = null;
  let bodySent = null;
  const mockResValid = {
    status(code) { statusSent = code; return this; },
    send(data) { bodySent = data; return this; }
  };
  const validReq = {
    query: {
      'hub.mode': 'subscribe',
      'hub.verify_token': TEST_VERIFY_TOKEN,
      'hub.challenge': 'CHALLENGE_ACCEPTED_12345'
    }
  };
  WhatsAppWebhookController.verify(validReq, mockResValid);
  assert.equal(statusSent, 200);
  assert.equal(bodySent, 'CHALLENGE_ACCEPTED_12345');

  // 2. Token mismatch
  const mismatchReq = {
    query: {
      'hub.mode': 'subscribe',
      'hub.verify_token': 'WRONG_TOKEN',
      'hub.challenge': 'CHALLENGE_ACCEPTED_12345'
    }
  };
  WhatsAppWebhookController.verify(mismatchReq, mockResValid);
  assert.equal(statusSent, 403);
  assert.equal(bodySent, 'Forbidden');

  // 3. Mode mismatch
  const badModeReq = {
    query: {
      'hub.mode': 'unsubscribe',
      'hub.verify_token': TEST_VERIFY_TOKEN,
      'hub.challenge': 'CHALLENGE_ACCEPTED_12345'
    }
  };
  WhatsAppWebhookController.verify(badModeReq, mockResValid);
  assert.equal(statusSent, 403);
});

test('Webhook Ingestion: Monotonic Status Updates & Out-of-Order Delivery Protection', async () => {
  // Set up test organization and recipient
  const orgRes = await db.query(
    `INSERT INTO organizations (name, type, is_active)
     VALUES ('Webhook Test Org', 'customer', true)
     RETURNING id`
  );
  const orgId = orgRes.rows[0].id;

  const recipRes = await db.query(
    `INSERT INTO whatsapp_recipients (org_id, name, phone_e164, opt_in, receive_refill)
     VALUES ($1, 'Test Recipient', '919000666999', true, true)
     RETURNING id`,
    [orgId]
  );
  const recipId = recipRes.rows[0].id;

  const testWamid = `wamid.test.${Date.now()}`;
  await db.query(
    `INSERT INTO whatsapp_messages (
       org_id, recipient_id, phone_masked, event_type, event_ref,
       template_name, language, payload, status, wamid, attempts
     ) VALUES ($1, $2, '******6999', 'fuel_refill', 'ref-001', 'fuel_refill_alert', 'en', '{}', 'sent', $3, 1)`,
    [orgId, recipId, testWamid]
  );

  process.env.WHATSAPP_APP_SECRET = TEST_SECRET;

  const mockRes = {
    status() { return this; },
    send() { return this; },
    json() { return this; }
  };

  // Step 1: Simulate Meta 'read' status callback arriving FIRST (e.g. read receipt)
  const readEvent = {
    object: 'whatsapp_business_account',
    entry: [{
      changes: [{
        value: {
          statuses: [{
            id: testWamid,
            status: 'read',
            timestamp: Math.floor(Date.now() / 1000).toString()
          }]
        }
      }]
    }]
  };

  const rawRead = JSON.stringify(readEvent);
  await WhatsAppWebhookController.handleEvent({
    headers: { 'x-hub-signature-256': signBody(rawRead, TEST_SECRET) },
    rawBody: Buffer.from(rawRead),
    body: readEvent
  }, mockRes);

  const checkRead = await db.query('SELECT status, read_at, delivered_at FROM whatsapp_messages WHERE wamid = $1', [testWamid]);
  assert.equal(checkRead.rows[0].status, 'read', 'Status should be read');
  assert.ok(checkRead.rows[0].read_at, 'read_at should be set');

  // Step 2: Simulate delayed 'delivered' status arriving AFTER 'read'
  const delayedDeliveredEvent = {
    object: 'whatsapp_business_account',
    entry: [{
      changes: [{
        value: {
          statuses: [{
            id: testWamid,
            status: 'delivered',
            timestamp: Math.floor(Date.now() / 1000).toString()
          }]
        }
      }]
    }]
  };

  const rawDelivered = JSON.stringify(delayedDeliveredEvent);
  await WhatsAppWebhookController.handleEvent({
    headers: { 'x-hub-signature-256': signBody(rawDelivered, TEST_SECRET) },
    rawBody: Buffer.from(rawDelivered),
    body: delayedDeliveredEvent
  }, mockRes);

  // Status must REMAIN 'read', must NOT regress to 'delivered'!
  const checkMonotonic = await db.query('SELECT status FROM whatsapp_messages WHERE wamid = $1', [testWamid]);
  assert.equal(checkMonotonic.rows[0].status, 'read', 'Out-of-order delivered must NOT overwrite read status');

  // Clean up
  await db.query('DELETE FROM whatsapp_messages WHERE wamid = $1', [testWamid]);
  await db.query('DELETE FROM whatsapp_recipients WHERE id = $1', [recipId]);
  await db.query('DELETE FROM organizations WHERE id = $1', [orgId]);
});

test('Webhook Ingestion: Inbound STOP and START Keyword Opt-in/Opt-out Handling', async () => {
  const orgRes = await db.query(
    `INSERT INTO organizations (name, type, is_active)
     VALUES ('Opt-out Org Test', 'customer', true)
     RETURNING id`
  );
  const orgId = orgRes.rows[0].id;

  const testPhone = '919876540001';
  const recipRes = await db.query(
    `INSERT INTO whatsapp_recipients (org_id, name, phone_e164, opt_in, receive_refill)
     VALUES ($1, 'Opt Test User', $2, true, true)
     RETURNING id`,
    [orgId, testPhone]
  );
  const recipId = recipRes.rows[0].id;

  process.env.WHATSAPP_APP_SECRET = TEST_SECRET;
  const mockRes = {
    status() { return this; },
    send() { return this; },
    json() { return this; }
  };

  // 1. Send inbound "STOP" command
  const stopEvent = {
    object: 'whatsapp_business_account',
    entry: [{
      changes: [{
        value: {
          messages: [{
            from: testPhone,
            type: 'text',
            text: { body: 'STOP' }
          }]
        }
      }]
    }]
  };

  const rawStop = JSON.stringify(stopEvent);
  await WhatsAppWebhookController.handleEvent({
    headers: { 'x-hub-signature-256': signBody(rawStop, TEST_SECRET) },
    rawBody: Buffer.from(rawStop),
    body: stopEvent
  }, mockRes);

  const checkOptOut = await db.query('SELECT opt_in, opt_out_at FROM whatsapp_recipients WHERE id = $1', [recipId]);
  assert.equal(checkOptOut.rows[0].opt_in, false, 'Recipient should be opted out');
  assert.ok(checkOptOut.rows[0].opt_out_at, 'opt_out_at timestamp must be recorded');

  // 2. Send inbound "START" command
  const startEvent = {
    object: 'whatsapp_business_account',
    entry: [{
      changes: [{
        value: {
          messages: [{
            from: testPhone,
            type: 'text',
            text: { body: 'START' }
          }]
        }
      }]
    }]
  };

  const rawStart = JSON.stringify(startEvent);
  await WhatsAppWebhookController.handleEvent({
    headers: { 'x-hub-signature-256': signBody(rawStart, TEST_SECRET) },
    rawBody: Buffer.from(rawStart),
    body: startEvent
  }, mockRes);

  const checkOptIn = await db.query('SELECT opt_in, opt_in_source, opt_out_at FROM whatsapp_recipients WHERE id = $1', [recipId]);
  assert.equal(checkOptIn.rows[0].opt_in, true, 'Recipient should be opted back in');
  assert.equal(checkOptIn.rows[0].opt_in_source, 'inbound_reply');
  assert.equal(checkOptIn.rows[0].opt_out_at, null, 'opt_out_at must be cleared');

  // Clean up
  await db.query('DELETE FROM whatsapp_recipients WHERE id = $1', [recipId]);
  await db.query('DELETE FROM organizations WHERE id = $1', [orgId]);
});

test.after(async () => {
  await db.pool.end();
});

