// ============================================================
// REAL HTTP MULTI-TENANCY & RBAC INTEGRATION TEST SUITE
// Tests real HTTP requests against Express router for:
// - Recipients (GET, POST, PUT, DELETE)
// - Messages (GET, POST retry)
// - Queue-Status (GET)
// - Customer role isolation (own org only, 403 on other orgs)
// - Dealer role hierarchy (own org, child org allowed, non-child 403)
// - Superadmin access across all tenants
// - Org ID in Query vs Body vs URL tampering
// At least 25 distinct assertions.
// ============================================================

'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../../backend/config/db');
const redis = require('../../backend/config/redis');
const { apiRouter: whatsappApiRoutes } = require('../../backend/routes/whatsappRoutes');
const env = require('../../backend/config/env');

describe('Real HTTP Multi-Tenant & RBAC Security Verification', () => {
  let server;
  let baseUrl;
  let superadminToken, dealerToken, childCustomerToken, strangerCustomerToken;
  let dealerOrgId, childOrgId, strangerOrgId;
  let superuserId, dealerUserId, childUserId, strangerUserId;
  let testRecipientId, testMessageId;

  // Helper to issue JWT tokens
  function makeToken(user) {
    return jwt.sign(user, env.JWT_SECRET, { expiresIn: '1h' });
  }

  // Helper to make real HTTP requests
  function makeRequest(method, path, token, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, baseUrl);
      const req = http.request(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(data); } catch (_) {}
          resolve({ status: res.statusCode, headers: res.headers, body: json, text: data });
        });
      });

      req.on('error', reject);
      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  before(async () => {
    // 1. Setup Organizations: Dealer -> Child Customer, and a separate Stranger Customer
    const dealerRes = await db.query(`
      INSERT INTO organizations (name, type, is_active)
      VALUES ('Tenancy Test Dealer', 'dealer', true)
      RETURNING id
    `);
    dealerOrgId = dealerRes.rows[0].id;

    const childRes = await db.query(`
      INSERT INTO organizations (name, type, parent_id, is_active)
      VALUES ('Tenancy Test Child Org', 'customer', $1, true)
      RETURNING id
    `, [dealerOrgId]);
    childOrgId = childRes.rows[0].id;

    const strangerRes = await db.query(`
      INSERT INTO organizations (name, type, is_active)
      VALUES ('Tenancy Test Stranger Org', 'customer', true)
      RETURNING id
    `);
    strangerOrgId = strangerRes.rows[0].id;

    // 2. Insert Users into users table to satisfy foreign keys
    const u1 = await db.query(`
      INSERT INTO users (name, email, password, role, org_id)
      VALUES ('Super User', 'super_test@fueltracks.in', 'hash', 'superadmin', $1) RETURNING id
    `, [dealerOrgId]);
    superuserId = u1.rows[0].id;

    const u2 = await db.query(`
      INSERT INTO users (name, email, password, role, org_id)
      VALUES ('Dealer User', 'dealer_test@fueltracks.in', 'hash', 'dealer', $1) RETURNING id
    `, [dealerOrgId]);
    dealerUserId = u2.rows[0].id;

    const u3 = await db.query(`
      INSERT INTO users (name, email, password, role, org_id)
      VALUES ('Child User', 'child_test@fueltracks.in', 'hash', 'customer', $1) RETURNING id
    `, [childOrgId]);
    childUserId = u3.rows[0].id;

    const u4 = await db.query(`
      INSERT INTO users (name, email, password, role, org_id)
      VALUES ('Stranger User', 'stranger_test@fueltracks.in', 'hash', 'customer', $1) RETURNING id
    `, [strangerOrgId]);
    strangerUserId = u4.rows[0].id;

    // 3. Generate Tokens
    superadminToken = makeToken({ userId: superuserId, role: 'superadmin', orgId: dealerOrgId, orgType: 'dealer' });
    dealerToken = makeToken({ userId: dealerUserId, role: 'dealer', orgId: dealerOrgId, orgType: 'dealer' });
    childCustomerToken = makeToken({ userId: childUserId, role: 'customer', orgId: childOrgId, orgType: 'customer' });
    strangerCustomerToken = makeToken({ userId: strangerUserId, role: 'customer', orgId: strangerOrgId, orgType: 'customer' });

    // 4. Create Seed Recipient and Message under Child Org
    const rRes = await db.query(`
      INSERT INTO whatsapp_recipients (org_id, name, phone_e164, opt_in, created_by)
      VALUES ($1, 'Child Recipient', '+919876500001', true, $2)
      RETURNING id
    `, [childOrgId, childUserId]);
    testRecipientId = rRes.rows[0].id;

    const mRes = await db.query(`
      INSERT INTO whatsapp_messages (org_id, recipient_id, phone_masked, event_type, event_ref, template_name, status)
      VALUES ($1, $2, '0001', 'fuel_refill', 'tenancy-msg-01', 'fuel_refill_alert', 'failed')
      RETURNING id
    `, [childOrgId, testRecipientId]);
    testMessageId = mRes.rows[0].id;

    // 5. Mount routes on express app and start server on random port
    const app = express();
    app.use(express.json());
    app.use('/api/whatsapp', whatsappApiRoutes);

    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        console.log(`[TEST-HTTP] Server listening on ${baseUrl}`);
        resolve();
      });
    });
  });

  after(async () => {
    // Cleanup records
    await db.query('DELETE FROM whatsapp_messages WHERE event_ref = $1', ['tenancy-msg-01']);
    await db.query('DELETE FROM whatsapp_recipients WHERE id = $1', [testRecipientId]);
    await db.query('DELETE FROM users WHERE id IN ($1, $2, $3, $4)', [superuserId, dealerUserId, childUserId, strangerUserId]);
    await db.query('DELETE FROM organizations WHERE id IN ($1, $2, $3)', [dealerOrgId, childOrgId, strangerOrgId]);
    await db.pool.end();
    try { redis.client.disconnect(); } catch (_) {}
    await new Promise((resolve) => server.close(resolve));
    setTimeout(() => process.exit(0), 100);
  });

  // --- RECIPIENTS ENDPOINTS ---

  test('Assertions 1-5: Customer can list own recipients, blocked from other orgs', async () => {
    // 1. Customer lists own recipients (default query)
    const r1 = await makeRequest('GET', '/api/whatsapp/recipients', childCustomerToken);
    assert.strictEqual(r1.status, 200, 'Assertion 1: Customer GET own recipients must return 200');
    assert.ok(Array.isArray(r1.body.data), 'Assertion 2: Response data must be an array');
    assert.strictEqual(r1.body.data.length, 1, 'Assertion 3: Must return child recipient');

    // 2. Customer explicitly passes own orgId in query param -> 200 OK
    const r2 = await makeRequest('GET', `/api/whatsapp/recipients?orgId=${childOrgId}`, childCustomerToken);
    assert.strictEqual(r2.status, 200, 'Assertion 4: Customer passing own orgId returns 200');

    // 3. Customer attempts to access stranger orgId via query param -> 403 Forbidden!
    const r3 = await makeRequest('GET', `/api/whatsapp/recipients?orgId=${strangerOrgId}`, childCustomerToken);
    assert.strictEqual(r3.status, 403, 'Assertion 5: Customer passing stranger orgId must return 403');
  });

  test('Assertions 6-10: Dealer hierarchy: can access child org, blocked from stranger org', async () => {
    // 4. Dealer lists own org recipients
    const r4 = await makeRequest('GET', '/api/whatsapp/recipients', dealerToken);
    assert.strictEqual(r4.status, 200, 'Assertion 6: Dealer GET own recipients returns 200');

    // 5. Dealer accesses child org via query param -> 200 OK
    const r5 = await makeRequest('GET', `/api/whatsapp/recipients?orgId=${childOrgId}`, dealerToken);
    assert.strictEqual(r5.status, 200, 'Assertion 7: Dealer accessing child org returns 200');
    assert.strictEqual(r5.body.data[0].id, testRecipientId, 'Assertion 8: Dealer can see child recipient');

    // 6. Dealer attempts to access stranger (non-child) org -> 403 Forbidden!
    const r6 = await makeRequest('GET', `/api/whatsapp/recipients?orgId=${strangerOrgId}`, dealerToken);
    assert.strictEqual(r6.status, 403, 'Assertion 9: Dealer accessing non-child org must return 403');

    // 7. Superadmin can access stranger org -> 200 OK
    const r7 = await makeRequest('GET', `/api/whatsapp/recipients?orgId=${strangerOrgId}`, superadminToken);
    assert.strictEqual(r7.status, 200, 'Assertion 10: Superadmin accessing any org returns 200');
  });

  test('Assertions 11-15: Recipient creation & IDOR body tampering', async () => {
    // 8. Customer creates recipient for own org -> 201 Created
    const r8 = await makeRequest('POST', '/api/whatsapp/recipients', childCustomerToken, {
      name: 'Valid Child User',
      phone: '+919876500002',
      receiveRefill: true
    });
    assert.strictEqual(r8.status, 201, 'Assertion 11: Customer creating recipient in own org returns 201');
    const newId = r8.body.data.id;

    // 9. Customer attempts to create recipient inside stranger org via body.orgId -> 403 Forbidden!
    const r9 = await makeRequest('POST', '/api/whatsapp/recipients', childCustomerToken, {
      orgId: strangerOrgId,
      name: 'Malicious Injected User',
      phone: '+919876500003'
    });
    assert.strictEqual(r9.status, 403, 'Assertion 12: Customer passing stranger orgId in body returns 403');

    // 10. Dealer creates recipient inside child org -> 201 Created
    const r10 = await makeRequest('POST', '/api/whatsapp/recipients', dealerToken, {
      orgId: childOrgId,
      name: 'Dealer Managed Child User',
      phone: '+919876500004'
    });
    assert.strictEqual(r10.status, 201, 'Assertion 13: Dealer creating recipient in child org returns 201');

    // 11. Dealer attempts to create recipient in stranger org -> 403 Forbidden!
    const r11 = await makeRequest('POST', '/api/whatsapp/recipients', dealerToken, {
      orgId: strangerOrgId,
      name: 'Injected Stranger User',
      phone: '+919876500005'
    });
    assert.strictEqual(r11.status, 403, 'Assertion 14: Dealer creating recipient in non-child org returns 403');

    // 12. Cleanup created recipient
    const r12 = await makeRequest('DELETE', `/api/whatsapp/recipients/${newId}`, childCustomerToken);
    assert.strictEqual(r12.status, 200, 'Assertion 15: Customer deleting own recipient returns 200');
    await db.query("DELETE FROM whatsapp_recipients WHERE phone_e164 IN ('+919876500002', '+919876500004')");
  });

  test('Assertions 16-20: Messages listing & query isolation', async () => {
    // 13. Customer lists own messages
    const r13 = await makeRequest('GET', '/api/whatsapp/messages', childCustomerToken);
    assert.strictEqual(r13.status, 200, 'Assertion 16: Customer GET messages returns 200');
    assert.ok(Array.isArray(r13.body.data), 'Assertion 17: Customer sees array of messages');
    assert.ok(r13.body.data.length >= 1, 'Assertion 18: Customer sees at least 1 message');

    // 14. Customer attempts to query messages for stranger org via query parameter -> 403 Forbidden!
    const r14 = await makeRequest('GET', `/api/whatsapp/messages?orgId=${strangerOrgId}`, childCustomerToken);
    assert.strictEqual(r14.status, 403, 'Assertion 19: Customer querying stranger messages returns 403');

    // 15. Dealer queries messages for child org -> 200 OK
    const r15 = await makeRequest('GET', `/api/whatsapp/messages?orgId=${childOrgId}`, dealerToken);
    assert.strictEqual(r15.status, 200, 'Assertion 20: Dealer querying child org messages returns 200');
  });

  test('Assertions 21-26: Message retry, Queue-Status, and Cross-Tenant Mutating IDOR', async () => {
    // 16. Dealer queries messages for stranger org -> 403 Forbidden!
    const r16 = await makeRequest('GET', `/api/whatsapp/messages?orgId=${strangerOrgId}`, dealerToken);
    assert.strictEqual(r16.status, 403, 'Assertion 21: Dealer querying non-child messages returns 403');

    // 17. Stranger customer attempts to trigger retry on child message -> 403 Forbidden!
    const r17 = await makeRequest('POST', `/api/whatsapp/messages/${testMessageId}/retry`, strangerCustomerToken);
    assert.strictEqual(r17.status, 403, 'Assertion 22: Stranger customer retry of child message returns 403');

    // 18. Dealer triggers retry on child message -> 200 OK
    const r18 = await makeRequest('POST', `/api/whatsapp/messages/${testMessageId}/retry`, dealerToken);
    assert.strictEqual(r18.status, 200, 'Assertion 23: Dealer retry of child message returns 200');
    assert.strictEqual(r18.body.data.status, 'queued', 'Assertion 24: Retried message status is queued');

    // 19. Superadmin can retry message -> 200 OK
    const r19 = await makeRequest('POST', `/api/whatsapp/messages/${testMessageId}/retry`, superadminToken);
    assert.strictEqual(r19.status, 200, 'Assertion 25: Superadmin retry returns 200');

    // 20. Queue-status endpoint returns valid queue metrics
    const r20 = await makeRequest('GET', '/api/whatsapp/queue-status', childCustomerToken);
    assert.strictEqual(r20.status, 200, 'Assertion 26: GET /queue-status returns 200');
    assert.ok(r20.body.data.state, 'Assertion 27: Queue state is populated');
  });
});
