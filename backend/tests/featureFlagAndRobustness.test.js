const { test, describe, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const env = require('../config/env');
const { getScannerPool } = require('../config/db');
const scannerService = require('../services/documentScanner/scannerService');
const ocrProvider = require('../services/documentScanner/ocrProvider');

describe('Feature Flag & Error Robustness Tests', () => {
  const testDir = path.join(__dirname, '..', 'storage', 'test_uploads');

  after(async () => {
    try {
      const pool = getScannerPool();
      await pool.end();
    } catch (_) {}
  });

  test('idle / flag-off worker holds zero Tesseract workers', () => {
    // Verify Tesseract worker has not been initialized
    assert.strictEqual(ocrProvider.worker, null, 'OcrProvider must hold zero active workers when idle or flag is off');
  });

  test('magic bytes detection rejects corrupted / non-document binaries', () => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    const corruptFile = path.join(testDir, `corrupt_${Date.now()}.bin`);
    fs.writeFileSync(corruptFile, Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]));

    const detected = scannerService.detectTypeFromMagicBytes(corruptFile);
    assert.strictEqual(detected, null, 'Corrupted binary must return null for mime type');

    try { fs.unlinkSync(corruptFile); } catch (_) {}
  });

  test('scanned PDF without text layer fails permanently with SCANNED_PDF_NOT_SUPPORTED', async () => {
    // Synthetic empty PDF with no text layer
    const emptyPdfPath = path.join(testDir, `empty_scanned_${Date.now()}.pdf`);
    // Minimal valid PDF structure with no font/text stream
    const minimalPdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] >> endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
trailer << /Size 4 /Root 1 0 R >>
startxref
195
%%EOF`;
    fs.writeFileSync(emptyPdfPath, minimalPdf);

    const fakeJob = {
      id: '00000000-0000-0000-0000-000000000002',
      org_id: '00000000-0000-0000-0000-000000000001',
      file_path: emptyPdfPath
    };

    let caughtErr = null;
    try {
      await scannerService.processScanJob(fakeJob, 'test-worker');
    } catch (err) {
      caughtErr = err;
    }

    assert.ok(caughtErr, 'Scanned PDF without text layer must throw');
    assert.strictEqual(caughtErr.code, 'SCANNED_PDF_NOT_SUPPORTED', 'Error code must be SCANNED_PDF_NOT_SUPPORTED');
    assert.strictEqual(caughtErr.permanent, true, 'Scanned PDF error must be flagged as permanent (0 retries)');

    try { fs.unlinkSync(emptyPdfPath); } catch (_) {}
  });
});
