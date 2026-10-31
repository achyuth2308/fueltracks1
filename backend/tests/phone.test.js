const { test, describe } = require('node:test');
const assert = require('node:assert');
const { normalizePhone, maskPhone } = require('../utils/phone');

describe('Phone Number Normalizer & Masker', () => {
  test('normalizes 10-digit Indian mobile number', () => {
    assert.strictEqual(normalizePhone('9000666914'), '919000666914');
  });

  test('normalizes 11-digit Indian number with leading 0', () => {
    assert.strictEqual(normalizePhone('09000666914'), '919000666914');
  });

  test('normalizes number with +91 and spaces', () => {
    assert.strictEqual(normalizePhone('+91 90006 66914'), '919000666914');
  });

  test('normalizes number with dashes and parentheses', () => {
    assert.strictEqual(normalizePhone('+91-90006-66914'), '919000666914');
  });

  test('handles already normalized 91 prefix', () => {
    assert.strictEqual(normalizePhone('919000666914'), '919000666914');
  });

  test('normalizes international number with +', () => {
    assert.strictEqual(normalizePhone('+1 (555) 234-5678'), '15552345678');
  });

  test('returns null for invalid numbers', () => {
    assert.strictEqual(normalizePhone(''), null);
    assert.strictEqual(normalizePhone(null), null);
    assert.strictEqual(normalizePhone('123'), null);
    assert.strictEqual(normalizePhone('abcdefghij'), null);
    assert.strictEqual(normalizePhone('1234567890'), null); // starts with 1 in India without +
  });

  test('masks phone number showing only last 4 digits', () => {
    assert.strictEqual(maskPhone('919000666914'), '********6914');
    assert.strictEqual(maskPhone('+91 90006 66914'), '********6914');
    assert.strictEqual(maskPhone('1234'), '****');
    assert.strictEqual(maskPhone(null), '****');
  });
});

