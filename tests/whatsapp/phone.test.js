// ============================================================
// WHATSAPP INTEGRATION TEST: PHONE NORMALIZATION & MASKING
// Comprehensive suite with 45+ inputs testing E.164 conversion
// ============================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePhone, maskPhone } = require('../../backend/utils/phone');

test('Phone Utilities: normalizePhone - Standard Indian 10-digit mobile numbers', () => {
  const cases = [
    { input: '9876543210', expected: '919876543210' },
    { input: '8765432109', expected: '918765432109' },
    { input: '7654321098', expected: '917654321098' },
    { input: '6543210987', expected: '916543210987' },
    { input: '9000666914', expected: '919000666914' },
    { input: 9876543210,   expected: '919876543210' }, // numeric input
  ];

  for (const { input, expected } of cases) {
    assert.equal(normalizePhone(input), expected, `Failed for input: ${input}`);
  }
});

test('Phone Utilities: normalizePhone - 11-digit numbers with leading zero', () => {
  const cases = [
    { input: '09876543210', expected: '919876543210' },
    { input: '08765432109', expected: '918765432109' },
    { input: '07654321098', expected: '917654321098' },
    { input: '06543210987', expected: '916543210987' },
    { input: '09000666914', expected: '919000666914' },
  ];

  for (const { input, expected } of cases) {
    assert.equal(normalizePhone(input), expected, `Failed for input: ${input}`);
  }
});

test('Phone Utilities: normalizePhone - Numbers with +91 country prefix and formatting', () => {
  const cases = [
    { input: '+919876543210',     expected: '919876543210' },
    { input: '+91 98765 43210',   expected: '919876543210' },
    { input: '+91-98765-43210',   expected: '919876543210' },
    { input: '+91.98765.43210',   expected: '919876543210' },
    { input: '+91 (98765) 43210', expected: '919876543210' },
    { input: '+91-90006-66914',   expected: '919000666914' },
    { input: ' +91 9876543210 ',  expected: '919876543210' }, // whitespace padded
  ];

  for (const { input, expected } of cases) {
    assert.equal(normalizePhone(input), expected, `Failed for input: ${input}`);
  }
});

test('Phone Utilities: normalizePhone - Already normalized 12-digit numbers', () => {
  const cases = [
    { input: '919876543210', expected: '919876543210' },
    { input: '918765432109', expected: '918765432109' },
    { input: '917654321098', expected: '917654321098' },
    { input: '916543210987', expected: '916543210987' },
    { input: '919000666914', expected: '919000666914' },
  ];

  for (const { input, expected } of cases) {
    assert.equal(normalizePhone(input), expected, `Failed for input: ${input}`);
  }
});

test('Phone Utilities: normalizePhone - Valid international numbers with leading +', () => {
  const cases = [
    { input: '+1 415 555 2671',     expected: '14155552671' },    // US
    { input: '+44 7911 123456',     expected: '447911123456' },   // UK
    { input: '+971 50 123 4567',    expected: '971501234567' },   // UAE
    { input: '+65 9123 4567',       expected: '6591234567' },     // Singapore
    { input: '+61 412 345 678',     expected: '61412345678' },    // Australia
    { input: '+49 151 12345678',    expected: '4915112345678' },  // Germany
  ];

  for (const { input, expected } of cases) {
    assert.equal(normalizePhone(input), expected, `Failed for input: ${input}`);
  }
});

test('Phone Utilities: normalizePhone - Invalid inputs return null', () => {
  const invalidCases = [
    null,
    undefined,
    '',
    '   ',
    '12345',                       // Too short
    '98765',                       // Too short
    '1234567890',                  // Invalid starting digit (1) for India
    '2345678901',                  // Invalid starting digit (2) for India
    '5555555555',                  // Invalid starting digit (5) for India
    '0000000000',                  // All zeros
    '+91 0000000000',              // Invalid 10-digit after country code
    'abcdefghij',                  // Alphabetic
    '+91-abcdefghij',              // Alpha with country code
    '!@#$%^&*()',                  // Special symbols only
    '९८७६५४३२१०',                  // Devanagari numerals
    '987654321',                   // 9 digits (too short)
    '91987654321',                 // 11 digits without 0 prefix
    '+12345678901234567890',       // 20 digits (too long)
    {},                            // Object
    [],                            // Array
    false,                         // Boolean
  ];

  for (const input of invalidCases) {
    assert.equal(normalizePhone(input), null, `Expected null for input: ${JSON.stringify(input)}`);
  }
});

test('Phone Utilities: maskPhone - Privacy masking tests', () => {
  const cases = [
    { input: '919000666914',   expected: '********6914' },
    { input: '+91 98765 43210', expected: '********3210' },
    { input: '9876543210',     expected: '******3210' },
    { input: '1234',           expected: '****' },
    { input: '12',             expected: '****' },
    { input: '',               expected: '****' },
    { input: null,             expected: '****' },
    { input: undefined,        expected: '****' },
  ];

  for (const { input, expected } of cases) {
    assert.equal(maskPhone(input), expected, `Failed for input: ${input}`);
  }
});

