// ============================================================
// WHATSAPP INTEGRATION TEST: MULTI-TENANCY & RBAC AUTHORIZATION
// Tests customer, dealer (child and non-child org), and superadmin
// against recipients and messages APIs.
// ============================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../../backend/config/db');
const WhatsAppRecipientController = require('../../backend/controllers/whatsappRecipientController');
const WhatsAppMessageController = require('../../backend/controllers/whatsappMessageController');

function createMockResponse() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return res;
}

test('Tenancy & RBAC: Customer, Dealer (Child/Non-Child), and Superadmin permissions', async () => {
  // Set up Org Hierarchy:
  // Dealer 1
  //   ├── Child Customer 1A
  // Dealer 2
  //   ├── Child Customer 2A

  const d1Res = await db.query(`INSERT INTO organizations (name, type, is_active) VALUES ('Dealer One', 'dealer', true) RETURNING id`);
  const dealer1Id = d1Res.rows[0].id;

  const d2Res = await db.query(`INSERT INTO organizations (name, type, is_active) VALUES ('Dealer Two', 'dealer', true) RETURNING id`);
  const dealer2Id = d2Res.rows[0].id;

  const c1aRes = await db.query(
    `INSERT INTO organizations (name, type, parent_id, is_active) VALUES ('Customer 1A', 'customer', $1, true) RETURNING id`,
    [dealer1Id]
  );
  const child1aId = c1aRes.rows[0].id;

  const c2aRes = await db.query(
    `INSERT INTO organizations (name, type, parent_id, is_active) VALUES ('Customer 2A', 'customer', $1, true) RETURNING id`,
    [dealer2Id]
  );
  const child2aId = c2aRes.rows[0].id;

  // Add Recipients for 1A and 2A
  const r1aRes = await db.query(
    `INSERT INTO whatsapp_recipients (org_id, name, phone_e164, opt_in) VALUES ($1, 'Recip 1A', '919000111111', true) RETURNING id`,
    [child1aId]
  );
  const r1aId = r1aRes.rows[0].id;

  const r2aRes = await db.query(
    `INSERT INTO whatsapp_recipients (org_id, name, phone_e164, opt_in) VALUES ($1, 'Recip 2A', '919000222222', true) RETURNING id`,
    [child2aId]
  );
  const r2aId = r2aRes.rows[0].id;

  // Add Messages for 1A and 2A
  const m1aRes = await db.query(
    `INSERT INTO whatsapp_messages (org_id, recipient_id, phone_masked, event_type, event_ref, template_name, status)
     VALUES ($1, $2, '******1111', 'fuel_refill', 'ref-1a', 'fuel_refill_alert', 'failed') RETURNING id`,
    [child1aId, r1aId]
  );
  const m1aId = m1aRes.rows[0].id;

  const m2aRes = await db.query(
    `INSERT INTO whatsapp_messages (org_id, recipient_id, phone_masked, event_type, event_ref, template_name, status)
     VALUES ($1, $2, '******2222', 'fuel_refill', 'ref-2a', 'fuel_refill_alert', 'failed') RETURNING id`,
    [child2aId, r2aId]
  );
  const m2aId = m2aRes.rows[0].id;

  // -------------------------------------------------------------
  // Test 1: Customer User Permissions
  // -------------------------------------------------------------
  const customer1aReq = { user: { role: 'customer', orgId: child1aId } };

  // 1a. Customer queries own org recipients -> 200 OK
  {
    const req = { ...customer1aReq, query: { orgId: child1aId } };
    const res = createMockResponse();
    await WhatsAppRecipientController.getRecipients(req, res, () => {});
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
  }

  // 1b. Customer queries another org recipients -> 403 Forbidden!
  {
    const req = { ...customer1aReq, query: { orgId: child2aId } };
    const res = createMockResponse();
    await WhatsAppRecipientController.getRecipients(req, res, () => {});
    assert.equal(res.statusCode, 403, 'Customer must be blocked with 403 when requesting external org');
  }

  // 1c. Customer retries message in another org -> 403 Forbidden!
  {
    const req = { ...customer1aReq, params: { id: m2aId } };
    const res = createMockResponse();
    await WhatsAppMessageController.retryMessage(req, res, () => {});
    assert.equal(res.statusCode, 403, 'Customer must be blocked with 403 when retrying external message');
  }

  // -------------------------------------------------------------
  // Test 2: Dealer User Permissions (Child vs Non-Child)
  // -------------------------------------------------------------
  const dealer1Req = { user: { role: 'dealer', orgId: dealer1Id } };

  // 2a. Dealer queries own dealer org -> 200 OK
  {
    const req = { ...dealer1Req, query: { orgId: dealer1Id } };
    const res = createMockResponse();
    await WhatsAppRecipientController.getRecipients(req, res, () => {});
    assert.equal(res.statusCode, 200);
  }

  // 2b. Dealer queries CHILD customer org (Customer 1A) -> 200 OK!
  {
    const req = { ...dealer1Req, query: { orgId: child1aId } };
    const res = createMockResponse();
    await WhatsAppRecipientController.getRecipients(req, res, () => {});
    assert.equal(res.statusCode, 200, 'Dealer MUST be allowed to manage child customer recipients');
    assert.equal(res.body.data.length, 1);
  }

  // 2c. Dealer queries NON-CHILD customer org (Customer 2A) -> 403 Forbidden!
  {
    const req = { ...dealer1Req, query: { orgId: child2aId } };
    const res = createMockResponse();
    await WhatsAppRecipientController.getRecipients(req, res, () => {});
    assert.equal(res.statusCode, 403, 'Dealer MUST be blocked with 403 from non-child customer org');
  }

  // 2d. Dealer updates recipient in child customer org -> 200 OK!
  {
    const req = {
      ...dealer1Req,
      params: { id: r1aId },
      body: { name: 'Updated 1A by Dealer 1' }
    };
    const res = createMockResponse();
    await WhatsAppRecipientController.updateRecipient(req, res, () => {});
    assert.equal(res.statusCode, 200, 'Dealer should be able to update child recipient');
  }

  // 2e. Dealer updates recipient in non-child customer org -> 403 Forbidden!
  {
    const req = {
      ...dealer1Req,
      params: { id: r2aId },
      body: { name: 'Hacked 2A by Dealer 1' }
    };
    const res = createMockResponse();
    await WhatsAppRecipientController.updateRecipient(req, res, () => {});
    assert.equal(res.statusCode, 403, 'Dealer must be blocked with 403 from updating non-child recipient');
  }

  // 2f. Dealer retries message in child customer org -> 200 OK!
  {
    const req = { ...dealer1Req, params: { id: m1aId } };
    const res = createMockResponse();
    await WhatsAppMessageController.retryMessage(req, res, () => {});
    assert.equal(res.statusCode, 200, 'Dealer should be able to retry child customer message');
  }

  // 2g. Dealer retries message in non-child customer org -> 403 Forbidden!
  {
    const req = { ...dealer1Req, params: { id: m2aId } };
    const res = createMockResponse();
    await WhatsAppMessageController.retryMessage(req, res, () => {});
    assert.equal(res.statusCode, 403, 'Dealer must be blocked with 403 from retrying non-child message');
  }

  // -------------------------------------------------------------
  // Test 3: Superadmin Permissions
  // -------------------------------------------------------------
  const superadminReq = { user: { role: 'superadmin', orgId: dealer1Id } };

  // 3a. Superadmin can access child 1A -> 200 OK
  {
    const req = { ...superadminReq, query: { orgId: child1aId } };
    const res = createMockResponse();
    await WhatsAppRecipientController.getRecipients(req, res, () => {});
    assert.equal(res.statusCode, 200);
  }

  // 3b. Superadmin can access child 2A -> 200 OK
  {
    const req = { ...superadminReq, query: { orgId: child2aId } };
    const res = createMockResponse();
    await WhatsAppRecipientController.getRecipients(req, res, () => {});
    assert.equal(res.statusCode, 200);
  }

  // 3c. Superadmin can retry message in any org -> 200 OK
  {
    const req = { ...superadminReq, params: { id: m2aId } };
    const res = createMockResponse();
    await WhatsAppMessageController.retryMessage(req, res, () => {});
    assert.equal(res.statusCode, 200);
  }

  // Cleanup
  await db.query('DELETE FROM whatsapp_messages WHERE id IN ($1, $2)', [m1aId, m2aId]);
  await db.query('DELETE FROM whatsapp_recipients WHERE id IN ($1, $2)', [r1aId, r2aId]);
  await db.query('DELETE FROM organizations WHERE id IN ($1, $2, $3, $4)', [child1aId, child2aId, dealer1Id, dealer2Id]);
});

test.after(async () => {
  await new Promise(r => setTimeout(r, 150));
  await db.pool.end();
});
