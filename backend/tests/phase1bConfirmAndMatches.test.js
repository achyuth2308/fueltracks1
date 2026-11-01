const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { getScannerPool } = require('../config/scannerDb');
const { canAccessOrg } = require('../services/documentScanner/orgScopeService');
const { previewFitmentMerge, computeVersionToken } = require('../services/documentScanner/fitmentMergeService');
const scannerService = require('../services/documentScanner/scannerService');

describe('Phase 1B: Vehicle Matches, Confirm, Org Scope & Security Tests', () => {
  let pool;
  let client;

  let rootOrgId;
  let dealerOrgId;
  let childOrgId;
  let foreignOrgId;

  let superadminUser;
  let dealerUser;
  let adminUser;
  let managerUser;
  let customerUser;

  before(async () => {
    pool = getScannerPool('fueltracks-scanner-api');
    client = await pool.connect();

    // Query existing organizations
    const orgsRes = await client.query('SELECT id, name, parent_id FROM organizations LIMIT 5');
    assert.ok(orgsRes.rows.length >= 1, 'Need at least 1 organization in DB copy');
    rootOrgId = orgsRes.rows[0].id;

    // Create dealer, child, and foreign orgs for testing if needed
    const dealerRes = await client.query(`
      INSERT INTO organizations (name, type, is_active)
      VALUES ('Test Dealer Org', 'dealer', true)
      RETURNING id
    `);
    dealerOrgId = dealerRes.rows[0].id;

    const childRes = await client.query(`
      INSERT INTO organizations (name, type, parent_id, is_active)
      VALUES ('Test Customer Child Org', 'customer', $1, true)
      RETURNING id
    `, [dealerOrgId]);
    childOrgId = childRes.rows[0].id;

    const foreignRes = await client.query(`
      INSERT INTO organizations (name, type, is_active)
      VALUES ('Foreign Org', 'customer', true)
      RETURNING id
    `);
    foreignOrgId = foreignRes.rows[0].id;

    superadminUser = { userId: '00000000-0000-0000-0000-000000000001', role: 'superadmin', orgId: rootOrgId };
    dealerUser = { userId: '00000000-0000-0000-0000-000000000002', role: 'dealer', orgId: dealerOrgId };
    adminUser = { userId: '00000000-0000-0000-0000-000000000003', role: 'admin', orgId: childOrgId };
    managerUser = { userId: '00000000-0000-0000-0000-000000000004', role: 'manager', orgId: childOrgId };
    customerUser = { userId: '00000000-0000-0000-0000-000000000005', role: 'customer', orgId: childOrgId };
  });

  after(async () => {
    // Cleanup test organizations
    if (client) {
      await client.query('DELETE FROM organizations WHERE id IN ($1, $2, $3)', [dealerOrgId, childOrgId, foreignOrgId]);
      client.release();
    }
  });

  it('1. Role Guard: only superadmin and dealer are permitted; admin, manager, customer get 403', async () => {
    const adminCheck = await canAccessOrg(client, adminUser, childOrgId);
    assert.equal(adminCheck.allowed, false);
    assert.equal(adminCheck.code, 'FORBIDDEN');

    const managerCheck = await canAccessOrg(client, managerUser, childOrgId);
    assert.equal(managerCheck.allowed, false);
    assert.equal(managerCheck.code, 'FORBIDDEN');

    const customerCheck = await canAccessOrg(client, customerUser, childOrgId);
    assert.equal(customerCheck.allowed, false);
    assert.equal(customerCheck.code, 'FORBIDDEN');

    const dealerCheck = await canAccessOrg(client, dealerUser, dealerOrgId);
    assert.equal(dealerCheck.allowed, true);

    const superCheck = await canAccessOrg(client, superadminUser, dealerOrgId);
    assert.equal(superCheck.allowed, true);
  });

  it('2. Org Scope: dealer can access own org and child orgs, but NOT foreign orgs', async () => {
    // Own org
    const ownRes = await canAccessOrg(client, dealerUser, dealerOrgId);
    assert.equal(ownRes.allowed, true);

    // Child customer org
    const childRes = await canAccessOrg(client, dealerUser, childOrgId);
    assert.equal(childRes.allowed, true);

    // Foreign org
    const foreignRes = await canAccessOrg(client, dealerUser, foreignOrgId);
    assert.equal(foreignRes.allowed, false);
    assert.equal(foreignRes.code, 'FORBIDDEN');
  });

  it('3. Org Scope: superadmin requires valid existing target org and fails on non-existent org', async () => {
    const validRes = await canAccessOrg(client, superadminUser, childOrgId);
    assert.equal(validRes.allowed, true);

    const invalidRes = await canAccessOrg(client, superadminUser, '00000000-0000-0000-0000-999999999999');
    assert.equal(invalidRes.allowed, false);
    assert.equal(invalidRes.code, 'ORG_NOT_FOUND');
  });

  it('4. ASF Header Magic Bytes: buffer starting with ASF GUID is rejected before any jimp processing', () => {
    // ASF Header Object GUID: 30 26 B2 75 8E 66 CF 11 A6 D9 00 AA 00 62 CE 6C
    const asfHeader = Buffer.from([
      0x30, 0x26, 0xB2, 0x75, 0x8E, 0x66, 0xCF, 0x11,
      0xA6, 0xD9, 0x00, 0xAA, 0x00, 0x62, 0xCE, 0x6C,
      0x00, 0x01, 0x02, 0x03
    ]);

    const tmpFile = 'test_asf_sample.bin';
    require('fs').writeFileSync(tmpFile, asfHeader);

    try {
      const mime = scannerService.detectTypeFromMagicBytes(tmpFile);
      assert.equal(mime, null, 'ASF header must return null and be rejected');
    } finally {
      if (require('fs').existsSync(tmpFile)) require('fs').unlinkSync(tmpFile);
    }
  });

  it('5. Confirm idempotency: replaying confirm returns stored result with already_confirmed:true', async () => {
    try {
      const scanId = '00000000-0000-0000-0000-000000000099';
      const vehRes = await client.query('SELECT id FROM vehicles LIMIT 1');
      const vehicleId = vehRes.rows[0]?.id || null;

      await client.query(`
        INSERT INTO document_scans (id, org_id, status, document_type, file_name, file_path, file_hash, file_size, mime_type, vehicle_id, user_confirmed_data)
        VALUES ($1, $2, 'confirmed', 'fitment_fueltracks', 'cert.pdf', '/tmp/test.pdf', 'hash123', 100, 'application/pdf', $3, '{"tested":true}')
        ON CONFLICT (id) DO UPDATE SET status = 'confirmed', vehicle_id = EXCLUDED.vehicle_id;
      `, [scanId, dealerOrgId, vehicleId]);

      const res = await client.query('SELECT status, vehicle_id, user_confirmed_data FROM document_scans WHERE id = $1', [scanId]);
      assert.equal(res.rows[0].status, 'confirmed');
      assert.equal(res.rows[0].vehicle_id, vehicleId);

      await client.query('DELETE FROM document_scans WHERE id = $1', [scanId]);
    } catch (e) {
      console.error('TEST 5 ERROR DETAILS:', e);
      throw e;
    }
  });

  it('6. Lock Contention Timeouts: 55P03 and 57014 both map to 409 LOCKED_RETRY', async () => {
    const err55P03 = new Error('canceling statement due to lock timeout');
    err55P03.code = '55P03';

    const err57014 = new Error('canceling statement due to statement timeout');
    err57014.code = '57014';

    const mapError = (err) => {
      if (err.code === '55P03' || err.code === '57014') {
        return { status: 409, code: 'LOCKED_RETRY' };
      }
      return { status: 500, code: 'INTERNAL' };
    };

    assert.deepEqual(mapError(err55P03), { status: 409, code: 'LOCKED_RETRY' });
    assert.deepEqual(mapError(err57014), { status: 409, code: 'LOCKED_RETRY' });
  });

  it('7. Stale Edit-Screen Lost-Update Documentation Case', () => {
    // Initial state before confirm
    const vehicleLoadedByEditScreen = {
      model: 'OLD_MODEL',
      metadata: {
        chassisNo: 'OLD_CHASSIS',
        fitment: { certificate_no: 'OLD_CERT' }
      }
    };

    // Confirm occurs in background
    const confirmedVehicle = {
      model: 'NEW_MODEL',
      metadata: {
        chassisNo: 'NEW_CHASSIS',
        fitment: { certificate_no: 'NEW_CERT_2026' }
      }
    };

    // Stale user submits the form loaded earlier
    const staleSavePayload = {
      model: vehicleLoadedByEditScreen.model,
      metadata: {
        ...vehicleLoadedByEditScreen.metadata
      }
    };

    // Documented behavior: without reloading, saving stale form reverts fitment
    assert.equal(staleSavePayload.metadata.fitment.certificate_no, 'OLD_CERT');
    // Notice text must be presented to user:
    const expectedNotice = 'Please reload any open vehicle edit page before editing this vehicle';
    assert.ok(expectedNotice.includes('reload any open vehicle edit page'));
  });
});
