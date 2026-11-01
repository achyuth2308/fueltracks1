const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const {
  luhnCheck,
  normalizeRegistrationNo,
  normalizeImei,
  normalizeSim,
  normalizeSerialNumber,
  normalizeDate,
  normalizePhone,
  cleanFieldValue,
  validateAadhaar,
  sanitizeAadhaar
} = require('../services/documentScanner/validationService');

const { verhoeffCheck } = require('../services/documentScanner/privacyService');
const { validateImageHeader } = require('../services/documentScanner/imagePreprocessor');

describe('Document Scanner Unit Tests - Validators & Normalizers', () => {
  test('Verhoeff algorithm validates correct Aadhaar checksums', () => {
    // Valid Verhoeff numbers
    assert.strictEqual(verhoeffCheck('234567890124'), true);
    // Invalid
    assert.strictEqual(verhoeffCheck('234567890125'), false);
    assert.strictEqual(verhoeffCheck('123456789012'), false);
  });

  test('validateAadhaar rejects numbers starting with 0 or 1', () => {
    const res0 = validateAadhaar('012345678912');
    assert.strictEqual(res0.valid, false);
    const res1 = validateAadhaar('123456789012');
    assert.strictEqual(res1.valid, false);
  });

  test('Luhn check validates valid IMEI and ICCID checksums', () => {
    // Real Luhn valid IMEI
    assert.strictEqual(luhnCheck('861329085344688'), true);
    // Invalid IMEI
    assert.strictEqual(luhnCheck('861329085344689'), false);
    // Sample IMEI
    assert.strictEqual(luhnCheck('880000000000001'), false);
  });

  test('normalizeImei rejects non-15 digit and letter-containing values', () => {
    const letterImei = normalizeImei('86132908534468A');
    assert.strictEqual(letterImei.validated, false);
    assert.strictEqual(letterImei.warnings.includes('IMEI_CONTAINS_LETTERS'), true);

    const shortImei = normalizeImei('1234567890');
    assert.strictEqual(shortImei.validated, false);

    const validImei = normalizeImei('861329085344688');
    assert.strictEqual(validImei.validated, true);
    assert.strictEqual(validImei.value, '861329085344688');

    // Warning on Luhn failure for sample data, but still validated
    const sampleImei = normalizeImei('880000000000001');
    assert.strictEqual(sampleImei.validated, true);
    assert.strictEqual(sampleImei.warnings.some(w => w.includes('LUHN')), true);
  });

  test('normalizeSim preserves leading zeros and accepts 10-20 digits', () => {
    const dataSim = normalizeSim('05752000690537');
    assert.strictEqual(dataSim.value, '05752000690537');
    assert.strictEqual(dataSim.validated, true);

    const iccid = normalizeSim('89911012000032045120');
    assert.strictEqual(iccid.value, '89911012000032045120');
    assert.strictEqual(iccid.validated, true);

    const shortSim = normalizeSim('12345');
    assert.strictEqual(shortSim.warnings.some(w => w.includes('SIM_LENGTH_WARNING')), true);
  });

  test('normalizeSerialNumber preserves exact characters without substitution and warns on ambiguous chars', () => {
    // PDF text source: no warning
    const pdfSerial = normalizeSerialNumber('VLY2N2I052685344688', 'pdf_text');
    assert.strictEqual(pdfSerial.value, 'VLY2N2I052685344688');
    assert.strictEqual(pdfSerial.confidenceModifier, 0);
    assert.strictEqual(pdfSerial.warnings.length, 0);

    // OCR source: flags ambiguous characters
    const ocrSerial = normalizeSerialNumber('VLY2N2I052685344688', 'ocr');
    assert.strictEqual(ocrSerial.value, 'VLY2N2I052685344688'); // NEVER altered
    assert.strictEqual(ocrSerial.confidenceModifier, -0.15);
    assert.strictEqual(ocrSerial.warnings.some(w => w.includes('SERIAL_AMBIGUOUS_CHARS')), true);
  });

  test('normalizeRegistrationNo handles standard, BH-series, and conditional OCR fixes', () => {
    // Standard plates
    const ka = normalizeRegistrationNo('KA-05-LT-0001', 'pdf_text');
    assert.strictEqual(ka.value, 'KA05LT0001');
    assert.strictEqual(ka.validated, true);

    const tn = normalizeRegistrationNo('TN 33 AY 2490', 'pdf_text');
    assert.strictEqual(tn.value, 'TN33AY2490');
    assert.strictEqual(tn.validated, true);

    // BH Series
    const bh = normalizeRegistrationNo('22 BH 1234 AA', 'pdf_text');
    assert.strictEqual(bh.value, '22BH1234AA');
    assert.strictEqual(bh.validated, true);

    // OCR confusion fixes applied ONLY on OCR source
    // In OCR: 'KAO5LTOOO1' (O instead of 0)
    const ocrFixed = normalizeRegistrationNo('KAO5LTOOO1', 'ocr');
    assert.strictEqual(ocrFixed.value, 'KA05LT0001');
    assert.strictEqual(ocrFixed.validated, true);

    // Never fix text from pdf_text
    const pdfUntouched = normalizeRegistrationNo('KAO5LTOOO1', 'pdf_text');
    assert.strictEqual(pdfUntouched.value, 'KAO5LTOOO1');
    assert.strictEqual(pdfUntouched.validated, false);
  });

  test('normalizeDate converts all three separators to ISO-8601 and rejects invalid dates', () => {
    assert.strictEqual(normalizeDate('01/11/2026').value, '2026-11-01');
    assert.strictEqual(normalizeDate('01-11-2026').value, '2026-11-01');
    assert.strictEqual(normalizeDate('01.11.2026').value, '2026-11-01');

    // Leap year check
    assert.strictEqual(normalizeDate('29/02/2024').validated, true);
    assert.strictEqual(normalizeDate('29/02/2023').validated, false); // Not a leap year

    // Impossible dates
    assert.strictEqual(normalizeDate('32/01/2026').validated, false);
    assert.strictEqual(normalizeDate('15/13/2026').validated, false);
  });

  test('cleanFieldValue turns placeholders into null', () => {
    assert.strictEqual(cleanFieldValue('N/A'), null);
    assert.strictEqual(cleanFieldValue('na'), null);
    assert.strictEqual(cleanFieldValue('-'), null);
    assert.strictEqual(cleanFieldValue('NONE'), null);
    assert.strictEqual(cleanFieldValue(''), null);
    assert.strictEqual(cleanFieldValue('Volty'), 'Volty');
  });

  test('normalizePhone normalizes 10-digit Indian numbers and strips +91 and 0', () => {
    assert.strictEqual(normalizePhone('+91 73374 33352').value, '7337433352');
    assert.strictEqual(normalizePhone('07337433352').value, '7337433352');
    assert.strictEqual(normalizePhone('7337433352').value, '7337433352');
    assert.strictEqual(normalizePhone('1234567890').validated, false); // does not start with 6-9
  });
});
