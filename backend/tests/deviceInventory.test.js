const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../config/db');
const DeviceInventoryController = require('../controllers/DeviceInventoryController');

describe('Device Inventory Master (Production-Safe) Unit Tests', () => {
  let client;
  const testImei1 = '861329082393712';
  const testImei2 = '869999082393713';
  let testOrgId;

  before(async () => {
    client = await db.getClient();
    const orgRes = await client.query('SELECT id FROM organizations LIMIT 1');
    testOrgId = orgRes.rows[0]?.id || '00000000-0000-0000-0000-000000000001';

    // Clean up test records
    await client.query('DELETE FROM device_inventory WHERE imei IN ($1, $2)', [testImei1, testImei2]);
  });

  after(async () => {
    if (client) {
      await client.query('DELETE FROM device_inventory WHERE imei IN ($1, $2)', [testImei1, testImei2]);
      client.release();
    }
  });

  it('1. Bulk import rejects oversized batches > 25000 records for memory safety', async () => {
    const hugeBatch = new Array(25005).fill({ imei: '861329082393712' });
    let statusCode = 0;
    let responseBody = null;

    const req = {
      body: { records: hugeBatch },
      user: { role: 'dealer', orgId: testOrgId }
    };
    const res = {
      status(code) { statusCode = code; return this; },
      json(data) { responseBody = data; return this; }
    };

    await DeviceInventoryController.bulkImport(req, res);
    assert.equal(statusCode, 400);
    assert.equal(responseBody.success, false);
    assert.ok(responseBody.error.includes('safety limit of 25,000'));
  });

  it('2. Bulk import upserts APM and Volty hardware records and auto-resolves manufacturer', async () => {
    const records = [
      {
        imei: testImei1,
        serialNo: 'APM1K2I102690315456',
        iccid: '8991430008117572979F',
        model: '1819001A',
        simProvider: 'Technojacks'
      },
      {
        imei: testImei2,
        serialNo: 'VOL1K2I998877665544',
        iccid: '8991430009999999999F',
        model: 'VOLTY-AIS140',
        simProvider: 'Airtel'
      }
    ];

    let statusCode = 200;
    let responseBody = null;

    const req = {
      body: { records, batchName: 'TestBatch_2026' },
      user: { role: 'dealer', orgId: testOrgId }
    };
    const res = {
      status(code) { statusCode = code; return this; },
      json(data) { responseBody = data; return this; }
    };

    await DeviceInventoryController.bulkImport(req, res);
    assert.equal(statusCode, 200);
    assert.equal(responseBody.success, true);
    assert.equal(responseBody.importedCount, 2);
  });

  it('3. Lookup by IMEI fetches accurate hardware profile with auto-resolved manufacturer', async () => {
    let statusCode = 200;
    let responseBody = null;

    const req = {
      query: { imei: testImei1 }
    };
    const res = {
      status(code) { statusCode = code; return this; },
      json(data) { responseBody = data; return this; }
    };

    await DeviceInventoryController.lookupByImei(req, res);
    assert.equal(statusCode, 200);
    assert.equal(responseBody.success, true);
    assert.ok(responseBody.data, 'Data should not be null');
    assert.equal(responseBody.data.imei, testImei1);
    assert.equal(responseBody.data.serial_no, 'APM1K2I102690315456');
    assert.equal(responseBody.data.iccid, '8991430008117572979F');
    assert.equal(responseBody.data.manufacturer, 'APM KINGSTRACK PRIVATE LIMITED');
  });

  it('4. Repeated lookup for same IMEI is served instantly from LRU cache (0 DB queries)', async () => {
    let statusCode = 200;
    let responseBody = null;

    const req = {
      query: { imei: testImei1 }
    };
    const res = {
      status(code) { statusCode = code; return this; },
      json(data) { responseBody = data; return this; }
    };

    await DeviceInventoryController.lookupByImei(req, res);
    assert.equal(statusCode, 200);
    assert.equal(responseBody.success, true);
    assert.equal(responseBody.fromCache, true, 'Subsequent lookup must come from in-memory cache');
  });

  it('5. Lookup for Volty device returns VOLTY IOT SOLUTIONS PRIVATE LIMITED', async () => {
    let statusCode = 200;
    let responseBody = null;

    const req = {
      query: { imei: testImei2 }
    };
    const res = {
      status(code) { statusCode = code; return this; },
      json(data) { responseBody = data; return this; }
    };

    await DeviceInventoryController.lookupByImei(req, res);
    assert.equal(statusCode, 200);
    assert.equal(responseBody.success, true);
    assert.equal(responseBody.data.manufacturer, 'VOLTY IOT SOLUTIONS PRIVATE LIMITED');
    assert.equal(responseBody.data.serial_no, 'VOL1K2I998877665544');
    assert.equal(responseBody.data.iccid, '8991430009999999999F');
  });

  it('6. List inventory returns paginated devices with LIMIT and OFFSET protection', async () => {
    let statusCode = 200;
    let responseBody = null;

    const req = {
      query: { page: 1, limit: 10, q: testImei1 },
      user: { role: 'superadmin', orgId: testOrgId }
    };
    const res = {
      status(code) { statusCode = code; return this; },
      json(data) { responseBody = data; return this; }
    };

    await DeviceInventoryController.listInventory(req, res);
    assert.equal(statusCode, 200);
    assert.equal(responseBody.success, true);
    assert.ok(Array.isArray(responseBody.data));
    assert.ok(responseBody.pagination);
    assert.equal(responseBody.data.length, 1);
    assert.equal(responseBody.data[0].imei, testImei1);
  });
});
