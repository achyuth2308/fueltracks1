// ============================================================
// DOCUMENT SCANNER PRIVACY SERVICE (Aadhaar & PII Protection)
// DPDP Act & Aadhaar Regulations Compliance:
//  - Never store raw 12-digit Aadhaar number anywhere.
//  - Mask to XXXX-XXXX-1234 before persistence or logging.
//  - Generate salted HMAC with AADHAAR_HMAC_PEPPER for duplicate check.
//  - Sanitize all log lines, warnings, and error messages.
// ============================================================

const crypto = require('crypto');
const env = require('../../config/env');

/**
 * Validates 12-digit Aadhaar format and applies Verhoeff checksum.
 * Returns { valid: boolean, error?: string }
 */
function validateAadhaar(rawVal) {
  if (!rawVal) return { valid: false, error: 'Aadhaar number is empty' };
  const clean = String(rawVal).replace(/[\s\-]/g, '');
  if (!/^\d{12}$/.test(clean)) {
    return { valid: false, error: 'Aadhaar must be exactly 12 digits' };
  }
  if (/^[01]/.test(clean)) {
    return { valid: false, error: 'Aadhaar number cannot start with 0 or 1' };
  }
  if (!verhoeffCheck(clean)) {
    return { valid: false, error: 'Aadhaar failed Verhoeff checksum validation' };
  }
  return { valid: true, clean };
}

/**
 * Verhoeff checksum multiplication table & permutation table
 */
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
];

const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];

function verhoeffCheck(numStr) {
  let c = 0;
  const inverted = numStr.split('').reverse().map(Number);
  for (let i = 0; i < inverted.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][inverted[i]]];
  }
  return c === 0;
}

/**
 * Sanitizes Aadhaar immediately upon extraction.
 * Raw 12-digit number is transformed to { masked, last4, hmac } and discarded.
 */
function sanitizeAadhaar(raw12Digits) {
  const clean = String(raw12Digits).replace(/[\s\-]/g, '');
  const last4 = clean.slice(-4);
  const pepper = env.AADHAAR_HMAC_PEPPER || 'fueltracks-dev-aadhaar-pepper-default-salt-value-change-in-prod-64c';
  const hmac = crypto.createHmac('sha256', pepper).update(clean).digest('hex');
  const masked = `XXXX-XXXX-${last4}`;
  return { masked, last4, hmac };
}

/**
 * Redacts 12-digit sequences (Aadhaar), long phone numbers, and PII from log messages
 */
function redactPii(msg) {
  if (typeof msg !== 'string') {
    try {
      msg = JSON.stringify(msg);
    } catch (_) {
      return String(msg);
    }
  }
  // Redact 12-digit Aadhaar-like sequences
  let redacted = msg.replace(/\b[2-9]\d{3}[\s\-]?\d{4}[\s\-]?\d{4}\b/g, (m) => {
    const digits = m.replace(/[\s\-]/g, '');
    return `XXXX-XXXX-${digits.slice(-4)}`;
  });
  // Redact 10-digit Indian mobile numbers in plain logs
  redacted = redacted.replace(/\b([6-9]\d{5})(\d{4})\b/g, '******$2');
  return redacted;
}

module.exports = {
  validateAadhaar,
  verhoeffCheck,
  sanitizeAadhaar,
  redactPii
};

