const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const { extractPdfTextLayer } = require('../services/documentScanner/pdfTextExtractor');
const fieldExtractor = require('../services/documentScanner/fieldExtractor');
const templateRegistry = require('../services/documentScanner/templateRegistry');

describe('Golden Test 1: FuelTracks Fitment Certificate Extraction', () => {
  const samplePdfPath = path.join(__dirname, '..', '..', 'templates', 'fitment_certificate_sample.pdf');

  test('extracts FuelTracks fitment certificate fields accurately from PDF text layer', async () => {
    assert.strictEqual(fs.existsSync(samplePdfPath), true, 'fitment_certificate_sample.pdf must exist');

    const pdfRes = await extractPdfTextLayer(samplePdfPath);
    assert.strictEqual(pdfRes.hasTextLayer, true);

    const classification = templateRegistry.classify(pdfRes.fullText);
    assert.strictEqual(classification.templateId, 'fueltracks');
    assert.strictEqual(classification.documentType, 'fitment_certificate');

    const result = fieldExtractor.extractFields({
      lines: pdfRes.lines,
      fullText: pdfRes.fullText,
      source: 'pdf_text',
      templateId: 'fueltracks'
    });

    const f = result.fields;

    assert.strictEqual(f['certificate_number'].value, 'FT-GPS-2026-87570');
    assert.strictEqual(f['vehicle_registration_no'].value, 'TS07UJ1278');
    assert.strictEqual(f['make_model'].value, 'Tata Motors - Prima 4028.S');
    assert.strictEqual(f['chassis_number'].value, 'MB1H3LHD26578201');
    assert.strictEqual(f['engine_number'].value, 'NMHZ6578201');
    assert.strictEqual(f['owner_name'].value, 'Ramesh Kumar Yadav');
    assert.strictEqual(f['device_name'].value, 'Volty GPS Tracker (Voltsys)');
    assert.strictEqual(f['imei_number'].value, '861329086570201');
    assert.strictEqual(f['sim_operator'].value, 'Airtel IoT (M2M Data APN)');
    assert.strictEqual(f['seal_number'].value, 'FT-SEAL-894102');
    assert.strictEqual(f['installation_date'].value, '2026-10-27');
    assert.strictEqual(f['expiry_date'].value, '2027-10-26');
    assert.strictEqual(f['verification_code'].value, 'FT-VERIFY-0038-8758-CB2E');
  });

  test('enforces header phone isolation and N/A nulling per Golden Test 1 prompt spec', () => {
    // Exact text structure from Golden Test 1 specification where fields are N/A and header contains FuelTracks phone
    const golden1Text = `
FuelTracks Technologies Pvt. Ltd.
H.NO 17-1-382/2/2, 2nd Floor, Govt. Press Colony, Kharmanghat, R.R. Dist. - 500079
Phone: 9000666914 | Web: www.fueltracks.in | Email: info@fueltracks.in
SCAN TO VERIFY
CERTIFICATE OF GPS FITMENT
GPS Tracking Device Installation
CERTIFICATE NUMBER
FT-GPS-2026-00001
This is to certify that a GPS tracking device has been fitted in the vehicle described below.
1. VEHICLE DETAILS
VEHICLE REGISTRATION NO.
KA05LT0001
MAKE & MODEL
N/A
CHASSIS NUMBER
N/A
ENGINE NUMBER
N/A
2. CUSTOMER DETAILS
CUSTOMER NAME
N/A
CUSTOMER PHONE NUMBER
N/A
CUSTOMER FULL ADDRESS
N/A
3. GPS DEVICE DETAILS
DEVICE MODEL
Volty GPS Tracker
IMEI NUMBER
880000000000001
GPS SIM 1 NUMBER
N/A
SIM OPERATOR
Airtel IoT (M2M Data APN)
FITMENT LOCATION IN VEHICLE
Co-driver Dashboard
SEAL NUMBER (IF USED)
FT-SEAL-000001
4. INSTALLATION CHECKS
All Hardware Pre-Checks PASS
5. INSTALLATION & VALIDITY
INSTALLATION DATE (DD/MM/YYYY)
01/11/2026
CERTIFICATE ISSUE DATE (DD/MM/YYYY)
01/11/2026
SERVICE / VALIDITY EXPIRY DATE (DD/MM/YYYY)
31/10/2027
VERIFICATION CODE:
FT-VERIFY-1A1D-481F-481F
`;

    const lines = golden1Text.trim().split('\n').map(l => ({ text: l.trim(), items: [] }));

    const classification = templateRegistry.classify(golden1Text);
    assert.strictEqual(classification.templateId, 'fueltracks');

    const result = fieldExtractor.extractFields({
      lines,
      fullText: golden1Text,
      source: 'pdf_text',
      templateId: 'fueltracks'
    });

    const f = result.fields;

    assert.strictEqual(f['certificate_number'].value, 'FT-GPS-2026-00001');
    assert.strictEqual(f['vehicle_registration_no'].value, 'KA05LT0001');
    assert.strictEqual(f['device_name'].value, 'Volty GPS Tracker');
    assert.strictEqual(f['imei_number'].value, '880000000000001');
    assert.strictEqual(f['sim_number'].value, null, 'sim_number must be null for N/A');
    assert.strictEqual(f['sim_operator'].value, 'Airtel IoT (M2M Data APN)');
    assert.strictEqual(f['seal_number'].value, 'FT-SEAL-000001');
    assert.strictEqual(f['installation_date'].value, '2026-11-01');
    assert.strictEqual(f['expiry_date'].value, '2027-10-31');
    assert.strictEqual(f['verification_code'].value, 'FT-VERIFY-1A1D-481F-481F');

    // N/A fields must be null, never data
    assert.strictEqual(f['chassis_number'].value, null);
    assert.strictEqual(f['engine_number'].value, null);
    assert.strictEqual(f['customer_address'].value, null);

    // CRITICAL REQUIREMENT: Header phone "Phone: 9000666914" must NEVER be read as customer_phone
    assert.strictEqual(f['customer_phone'].value, null, 'Customer phone must be null when section 2 is N/A; header phone must never leak into customer_phone');

    console.log('>>> GOLDEN TEST 1 (FUELTRACKS) PASSED ALL ASSERTIONS! <<<');
  });
});
