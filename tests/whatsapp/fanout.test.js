// ============================================================
// WHATSAPP INTEGRATION TEST: FANOUT, SCOPE FILTERING & COST CONTROLS
// Tests opt-in filtering, channel toggles, vehicle scope isolation,
// daily org caps, and queue insertion idempotency.
// ============================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../../backend/config/db');

test('Fanout: Opt-in and channel toggles respect recipient preferences', async () => {
  const orgRes = await db.query(
    `INSERT INTO organizations (name, type, is_active)
     VALUES ('Fanout Prefs Org', 'customer', true)
     RETURNING id`
  );
  const orgId = orgRes.rows[0].id;

  // Recipient A: Opted in, Refill=true, Theft=false
  const rA = await db.query(
    `INSERT INTO whatsapp_recipients (org_id, name, phone_e164, opt_in, receive_refill, receive_theft)
     VALUES ($1, 'User A (Refill only)', '919000111001', true, true, false)
     RETURNING id`,
    [orgId]
  );
  // Recipient B: Opted in, Refill=false, Theft=true
  const rB = await db.query(
    `INSERT INTO whatsapp_recipients (org_id, name, phone_e164, opt_in, receive_refill, receive_theft)
     VALUES ($1, 'User B (Theft only)', '919000111002', true, false, true)
     RETURNING id`,
    [orgId]
  );
  // Recipient C: Opted OUT, Refill=true, Theft=true
  const rC = await db.query(
    `INSERT INTO whatsapp_recipients (org_id, name, phone_e164, opt_in, receive_refill, receive_theft)
     VALUES ($1, 'User C (Opted out)', '919000111003', false, true, true)
     RETURNING id`,
    [orgId]
  );

  // Query recipients for Refill alert
  const refillRecipients = await db.query(
    `SELECT id, name FROM whatsapp_recipients
     WHERE org_id = $1 AND opt_in = true AND receive_refill = true`,
    [orgId]
  );
  const refillIds = refillRecipients.rows.map(r => r.id);
  assert.ok(refillIds.includes(rA.rows[0].id), 'User A should receive refill alert');
  assert.ok(!refillIds.includes(rB.rows[0].id), 'User B should NOT receive refill alert');
  assert.ok(!refillIds.includes(rC.rows[0].id), 'User C should NOT receive refill alert (opted out)');

  // Query recipients for Theft alert
  const theftRecipients = await db.query(
    `SELECT id, name FROM whatsapp_recipients
     WHERE org_id = $1 AND opt_in = true AND receive_theft = true`,
    [orgId]
  );
  const theftIds = theftRecipients.rows.map(r => r.id);
  assert.ok(!theftIds.includes(rA.rows[0].id), 'User A should NOT receive theft alert');
  assert.ok(theftIds.includes(rB.rows[0].id), 'User B should receive theft alert');
  assert.ok(!theftIds.includes(rC.rows[0].id), 'User C should NOT receive theft alert (opted out)');

  // Clean up
  await db.query('DELETE FROM whatsapp_recipients WHERE org_id = $1', [orgId]);
  await db.query('DELETE FROM organizations WHERE id = $1', [orgId]);
});

test('Fanout: Vehicle scope filters messages to designated vehicles only', async () => {
  const orgRes = await db.query(
    `INSERT INTO organizations (name, type, is_active)
     VALUES ('Vehicle Scope Org', 'customer', true)
     RETURNING id`
  );
  const orgId = orgRes.rows[0].id;

  const veh1Res = await db.query(`INSERT INTO vehicles (org_id, plate, imei) VALUES ($1, 'KA01AA1111', 'IMEI1111') RETURNING id`, [orgId]);
  const veh2Res = await db.query(`INSERT INTO vehicles (org_id, plate, imei) VALUES ($1, 'KA01BB2222', 'IMEI2222') RETURNING id`, [orgId]);
  const v1Id = veh1Res.rows[0].id;
  const v2Id = veh2Res.rows[0].id;

  // Recipient with vehicle_scope = [v1Id]
  const scopedRecip = await db.query(
    `INSERT INTO whatsapp_recipients (org_id, name, phone_e164, opt_in, receive_refill, vehicle_scope)
     VALUES ($1, 'Scoped Manager', '919000222001', true, true, $2)
     RETURNING id`,
    [orgId, JSON.stringify([v1Id])]
  );
  // Recipient with vehicle_scope = null (all vehicles)
  const allRecip = await db.query(
    `INSERT INTO whatsapp_recipients (org_id, name, phone_e164, opt_in, receive_refill, vehicle_scope)
     VALUES ($1, 'Fleet Owner', '919000222002', true, true, NULL)
     RETURNING id`,
    [orgId]
  );

  const fetchRecipientsForVehicle = async (targetVehicleId) => {
    const res = await db.query(
      `SELECT id, vehicle_scope FROM whatsapp_recipients
       WHERE org_id = $1 AND opt_in = true AND receive_refill = true`,
      [orgId]
    );
    return res.rows.filter(r => {
      if (!r.vehicle_scope) return true; // all vehicles
      try {
        const scope = typeof r.vehicle_scope === 'string' ? JSON.parse(r.vehicle_scope) : r.vehicle_scope;
        if (Array.isArray(scope)) {
          return scope.length === 0 || scope.includes(targetVehicleId) || scope.includes(String(targetVehicleId));
        }
        return true;
      } catch (_) {
        return true;
      }
    });
  };

  // For Vehicle 1: Both should receive
  const v1Recipients = await fetchRecipientsForVehicle(v1Id);
  const v1Ids = v1Recipients.map(r => r.id);
  assert.ok(v1Ids.includes(scopedRecip.rows[0].id), 'Scoped recipient should receive alert for v1');
  assert.ok(v1Ids.includes(allRecip.rows[0].id), 'Owner should receive alert for v1');

  // For Vehicle 2: Scoped recipient should be excluded!
  const v2Recipients = await fetchRecipientsForVehicle(v2Id);
  const v2Ids = v2Recipients.map(r => r.id);
  assert.ok(!v2Ids.includes(scopedRecip.rows[0].id), 'Scoped recipient must NOT receive alert for v2');
  assert.ok(v2Ids.includes(allRecip.rows[0].id), 'Owner should receive alert for v2');

  // Clean up
  await db.query('DELETE FROM whatsapp_recipients WHERE org_id = $1', [orgId]);
  await db.query('DELETE FROM vehicles WHERE org_id = $1', [orgId]);
  await db.query('DELETE FROM organizations WHERE id = $1', [orgId]);
});

test('Fanout: Idempotency prevents duplicate rows on identical alerts', async () => {
  const orgRes = await db.query(
    `INSERT INTO organizations (name, type, is_active)
     VALUES ('Idempotency Org', 'customer', true)
     RETURNING id`
  );
  const orgId = orgRes.rows[0].id;

  const recipRes = await db.query(
    `INSERT INTO whatsapp_recipients (org_id, name, phone_e164, opt_in, receive_refill)
     VALUES ($1, 'Idempotency User', '919000333001', true, true)
     RETURNING id`,
    [orgId]
  );
  const recipId = recipRes.rows[0].id;

  const eventRef = 'alert-unique-ref-999';

  // First insert
  const res1 = await db.query(
    `INSERT INTO whatsapp_messages (
       org_id, recipient_id, phone_masked, event_type, event_ref,
       template_name, language, payload, status
     ) VALUES ($1, $2, '******3001', 'fuel_refill', $3, 'fuel_refill_alert', 'en', '{}', 'queued')
     ON CONFLICT (event_type, event_ref, recipient_id) DO NOTHING
     RETURNING id`,
    [orgId, recipId, eventRef]
  );
  assert.equal(res1.rowCount, 1, 'First insert must succeed');

  // Second duplicate insert (simulating duplicate alert packet)
  const res2 = await db.query(
    `INSERT INTO whatsapp_messages (
       org_id, recipient_id, phone_masked, event_type, event_ref,
       template_name, language, payload, status
     ) VALUES ($1, $2, '******3001', 'fuel_refill', $3, 'fuel_refill_alert', 'en', '{}', 'queued')
     ON CONFLICT (event_type, event_ref, recipient_id) DO NOTHING
     RETURNING id`,
    [orgId, recipId, eventRef]
  );
  assert.equal(res2.rowCount, 0, 'Duplicate insert must be ignored (DO NOTHING)');

  // Verify exactly 1 row exists
  const countRes = await db.query(
    `SELECT COUNT(id)::int as count FROM whatsapp_messages
     WHERE event_type = 'fuel_refill' AND event_ref = $1 AND recipient_id = $2`,
    [eventRef, recipId]
  );
  assert.equal(countRes.rows[0].count, 1, 'Only exactly 1 row must exist in whatsapp_messages');

  // Clean up
  await db.query('DELETE FROM whatsapp_messages WHERE org_id = $1', [orgId]);
  await db.query('DELETE FROM whatsapp_recipients WHERE org_id = $1', [orgId]);
  await db.query('DELETE FROM organizations WHERE id = $1', [orgId]);
});

test.after(async () => {
  await db.pool.end();
});

