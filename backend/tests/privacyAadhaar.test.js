const { test, describe, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { getScannerPool } = require('../config/db');
const scannerService = require('../services/documentScanner/scannerService');
const { redactPii, sanitizeAadhaar } = require('../services/documentScanner/privacyService');

describe('Privacy & DPDP Aadhaar Compliance Tests', () => {
  const fakeAadhaar = '234567890124'; // Valid Verhoeff test number
  const testDir = path.join(__dirname, '..', 'storage', 'test_uploads');

  after(async () => {
    try {
      const pool = getScannerPool();
      await pool.end();
    } catch (_) {}
  });

  test('redactPii scrubs 12-digit Aadhaar sequences from logs', () => {
    const rawLog = `Processing Aadhaar ${fakeAadhaar} for user Ramesh`;
    const cleaned = redactPii(rawLog);
    assert.strictEqual(cleaned.includes(fakeAadhaar), false, 'Raw 12-digit Aadhaar must NOT appear in log');
    assert.strictEqual(cleaned.includes('XXXX-XXXX-0124'), true, 'Log should contain masked Aadhaar');
  });

  test('sanitizeAadhaar returns masked representation and salted HMAC without raw number', () => {
    const res = sanitizeAadhaar(fakeAadhaar);
    assert.strictEqual(res.masked, 'XXXX-XXXX-0124');
    assert.strictEqual(res.last4, '0124');
    assert.strictEqual(typeof res.hmac, 'string');
    assert.strictEqual(res.hmac.length, 64);
  });

  test('Aadhaar processing without consent unlinks file immediately and fails with AADHAAR_CONSENT_REQUIRED', async () => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    const dummyFile = path.join(testDir, `unconsented_aadhaar_${Date.now()}.png`);
    // Valid 1x1 PNG base64
    fs.writeFileSync(dummyFile, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAA=', 'base64'));

    const fakeJob = {
      id: '00000000-0000-0000-0000-000000000001',
      org_id: '00000000-0000-0000-0000-000000000001',
      file_path: dummyFile,
      declared_doc_type: 'aadhaar',
      aadhaar_consent: false // NO CONSENT
    };

    let caughtError = null;
    try {
      await scannerService.processScanJob(fakeJob, 'test-worker');
    } catch (err) {
      caughtError = err;
    }

    assert.strictEqual(fs.existsSync(dummyFile), false, 'Unconsented Aadhaar file must be deleted from disk immediately');
    assert.ok(caughtError, 'Should throw an error');
    assert.strictEqual(caughtError.code, 'AADHAAR_CONSENT_REQUIRED');
  });
});
