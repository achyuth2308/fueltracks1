const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const { extractPdfTextLayer } = require('../services/documentScanner/pdfTextExtractor');
const fieldExtractor = require('../services/documentScanner/fieldExtractor');
const templateRegistry = require('../services/documentScanner/templateRegistry');

describe('Golden Test 2: Real Volty Fitment Certificate (PDF Text Layer with ZERO OCR)', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'volty_sample.pdf');

  test('extracts all expected fields from real Volty PDF fixture with 0 OCR calls', async (t) => {
    if (!fs.existsSync(fixturePath)) {
      t.skip('Skipping Golden Test 2: Real fixture backend/tests/fixtures/volty_sample.pdf is absent in this environment.');
      return;
    }

    // 1. Extract PDF text layer directly
    const pdfRes = await extractPdfTextLayer(fixturePath);
    assert.strictEqual(pdfRes.hasTextLayer, true, 'Volty PDF must have an embedded text layer');
    assert.strictEqual(pdfRes.pageCount, 1, 'Volty PDF must be 1 page');

    // 2. Classify document
    const classification = templateRegistry.classify(pdfRes.fullText);
    assert.strictEqual(classification.templateId, 'volty', 'Template must be classified as "volty"');
    assert.strictEqual(classification.documentType, 'fitment_certificate');

    // 3. Extract fields (using source = 'pdf_text')
    const result = fieldExtractor.extractFields({
      lines: pdfRes.lines,
      fullText: pdfRes.fullText,
      source: 'pdf_text',
      templateId: 'volty'
    });

    const f = result.fields;

    // Verify all exact golden values:
    assert.strictEqual(f['certificate_number'].value, 'VFC-00038');
    assert.strictEqual(f['issued_date'].value, '2026-11-01');
    assert.strictEqual(f['installation_date'].value, '2026-11-01');
    assert.strictEqual(f['expiry_date'].value, '2027-11-01');

    assert.strictEqual(f['vehicle_registration_no'].value, 'TN33AY2490');
    assert.strictEqual(f['vehicle_type'].value, 'LORRY');
    assert.strictEqual(f['make_model'].value, 'AICO 3/10-142 WB TIPPER');
    assert.strictEqual(f['chassis_number'].value, 'PWE529906');
    assert.strictEqual(f['engine_number'].value, 'PWE395227');
    assert.strictEqual(f['owner_name'].value, 'GOWRI M');

    // Device details (PRIORITY)
    assert.strictEqual(f['device_name'].value, 'Volty');
    assert.strictEqual(f['imei_number'].value, '861329085344688');
    assert.strictEqual(f['imei_number'].validated, true);
    assert.strictEqual(f['sim_number'].value, '5752000690537');
    assert.strictEqual(f['serial_number'].value, 'VLY2N2I052685344688');

    // Installer details (strictly kept separate from customer)
    assert.strictEqual(f['installer_name'].value, 'BALAJI');
    assert.strictEqual(f['installer_contact_number'].value, '7337433352');
    assert.strictEqual(f['customer_phone'].value, null, 'Installer phone must NEVER be mixed into customer_phone');

    // Source must be pdf_text for all fields (0 OCR calls)
    for (const [key, field] of Object.entries(f)) {
      if (field.value !== null) {
        assert.strictEqual(field.source, 'pdf_text', `Field ${key} source must be "pdf_text"`);
      }
    }

    console.log('>>> GOLDEN TEST 2 (VOLTY) PASSED ALL ASSERTIONS WITH ZERO OCR CALLS! <<<');
  });
});

