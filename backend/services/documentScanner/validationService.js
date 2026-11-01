// ============================================================
// DOCUMENT SCANNER VALIDATION & NORMALIZATION SERVICE
// Strict production validation rules:
//  - Vehicle Reg No (standard + BH series) + Indian state codes
//  - Conditional OCR-only character substitution in expected slots
//  - 15-digit IMEI with Luhn check (warning only)
//  - 10-20 digit SIM string with ICCID Luhn check (warning only)
//  - Raw Serial Number preservation (NO substitution, ambiguity warning)
//  - Date parsing (DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY) to ISO-8601
//  - 10-digit Indian phones (stripped +91/0)
// ============================================================

const { validateAadhaar, sanitizeAadhaar } = require('./privacyService');

// Official Indian State and Union Territory 2-letter RTO codes
const INDIAN_STATE_CODES = new Set([
  'AN', 'AP', 'AR', 'AS', 'BR', 'CH', 'CG', 'DD', 'DL', 'DN',
  'GA', 'GJ', 'HP', 'HR', 'JH', 'JK', 'KA', 'KL', 'LA', 'LD',
  'MH', 'ML', 'MN', 'MP', 'MZ', 'NL', 'OD', 'OR', 'PB', 'PY',
  'RJ', 'SK', 'TN', 'TR', 'TS', 'UK', 'UA', 'UP', 'WB'
]);

/**
 * Standard Luhn checksum calculation (used for IMEI and ICCID)
 */
function luhnCheck(numStr) {
  if (!numStr || !/^\d+$/.test(numStr)) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = numStr.length - 1; i >= 0; i--) {
    let digit = parseInt(numStr.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

/**
 * Normalizes vehicle registration number with selective OCR-confusion fixes
 */
function normalizeRegistrationNo(val, source = 'pdf_text') {
  if (!val) return { value: null, validated: false, warnings: [] };
  let str = String(val).replace(/[\s\-\.]/g, '').toUpperCase();
  const warnings = [];

  // Check BH series: YYBHNNNNA (e.g. 22BH1234AA)
  const bhMatch = str.match(/^(\d{2})BH(\d{4})([A-Z]{1,2})$/);
  if (bhMatch) {
    return { value: str, validated: true, warnings: [] };
  }

  // Apply OCR character repairs ONLY when source is OCR or LLM
  if (source === 'ocr' || source === 'llm') {
    // If first 2 chars have digits that look like letters, or last digits have letters
    // E.g. T0 -> TO, O5 -> 05
    str = repairRegistrationOcrConfusions(str);
  }

  // Standard Indian Vehicle Plate Regex: ^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$
  const stdMatch = str.match(/^([A-Z]{2})([0-9]{1,2})([A-Z]{0,3})([0-9]{4})$/);
  if (!stdMatch) {
    // Also check 1-4 trailing digits
    const looseMatch = str.match(/^([A-Z]{2})([0-9]{1,2})([A-Z]{0,3})([0-9]{1,4})$/);
    if (looseMatch) {
      const state = looseMatch[1];
      if (!INDIAN_STATE_CODES.has(state)) {
        warnings.push(`UNKNOWN_STATE_CODE: State code "${state}" is not in official Indian RTO list`);
      }
      return { value: str, validated: false, warnings: [...warnings, 'MALFORMED_PLATE_FORMAT'] };
    }
    return { value: str, validated: false, warnings: ['INVALID_REGISTRATION_NUMBER_FORMAT'] };
  }

  const state = stdMatch[1];
  if (!INDIAN_STATE_CODES.has(state)) {
    warnings.push(`UNKNOWN_STATE_CODE: State code "${state}" is not in official Indian RTO list`);
  }

  return { value: str, validated: true, warnings };
}

function repairRegistrationOcrConfusions(raw) {
  let chars = raw.split('');
  if (chars.length < 6) return raw;

  // Helper to map letter confusions to digits
  const toDigit = (c) => {
    if (c === 'O' || c === 'o' || c === 'Q') return '0';
    if (c === 'I' || c === 'l' || c === 'i') return '1';
    if (c === 'S' || c === 's') return '5';
    if (c === 'B' || c === 'b') return '8';
    if (c === 'Z' || c === 'z') return '2';
    return c;
  };

  // Position 0 & 1 must be letters
  for (let i = 0; i < 2; i++) {
    if (chars[i] === '0') chars[i] = 'O';
    else if (chars[i] === '1') chars[i] = 'I';
    else if (chars[i] === '5') chars[i] = 'S';
    else if (chars[i] === '8') chars[i] = 'B';
    else if (chars[i] === '2') chars[i] = 'Z';
  }

  // Position 2 is always a digit in standard Indian plates
  chars[2] = toDigit(chars[2]);

  // Position 3 is a digit if plate is 9+ chars or if char 3 is followed by letters
  const len = chars.length;
  if (len >= 9 || (len >= 8 && /[A-Z]/.test(chars[4] || ''))) {
    chars[3] = toDigit(chars[3]);
  }

  // Last 4 characters must be digits
  for (let i = len - 4; i < len; i++) {
    chars[i] = toDigit(chars[i]);
  }

  return chars.join('');
}

/**
 * Normalizes 15-digit IMEI number
 */
function normalizeImei(val) {
  if (!val) return { value: null, validated: false, warnings: [] };
  const str = String(val).replace(/[\s\-\.]/g, '');
  const warnings = [];

  if (/[a-zA-Z]/.test(str)) {
    return { value: null, validated: false, warnings: ['IMEI_CONTAINS_LETTERS'] };
  }

  if (!/^\d{15}$/.test(str)) {
    return { value: str, validated: false, warnings: [`INVALID_IMEI_LENGTH: Expected 15 digits, found ${str.length}`] };
  }

  if (!luhnCheck(str)) {
    warnings.push('LUHN_CHECKSUM_WARNING: IMEI failed Luhn check (sample/test data may be valid)');
  }

  return { value: str, validated: true, warnings };
}

/**
 * Normalizes SIM number (10-20 digits preserved as string)
 */
function normalizeSim(val) {
  if (!val) return { value: null, validated: false, warnings: [] };
  let str = String(val).replace(/[\s\-\.]/g, '');
  if (str.startsWith('+91')) str = str.slice(3);
  else if (str.startsWith('+')) str = str.slice(1);
  const warnings = [];

  if (!/^\d+$/.test(str)) {
    return { value: str, validated: false, warnings: ['SIM_NON_NUMERIC'] };
  }

  if (str.length < 10 || str.length > 20) {
    warnings.push(`SIM_LENGTH_WARNING: SIM number length ${str.length} outside standard 10-20 range`);
  }

  // If 19-20 digits and starts with 89 (Telecom ICCID)
  if ((str.length === 19 || str.length === 20) && str.startsWith('89')) {
    if (!luhnCheck(str)) {
      warnings.push('ICCID_LUHN_WARNING: SIM ICCID failed Luhn check (sample data may be valid)');
    }
  }

  return { value: str, validated: true, warnings };
}

/**
 * Normalizes Device Serial Number (strictly keeps verbatim; flags ambiguity)
 */
function normalizeSerialNumber(val, source = 'pdf_text') {
  if (!val) return { value: null, validated: false, warnings: [], confidenceModifier: 0 };
  const str = String(val).trim().toUpperCase();
  const warnings = [];
  let confidenceModifier = 0;

  // If source is OCR/LLM and serial contains ambiguous characters, warn and adjust confidence
  if (source === 'ocr' || source === 'llm') {
    if (/[0O1IS5B8]/.test(str)) {
      confidenceModifier = -0.15;
      warnings.push('SERIAL_AMBIGUOUS_CHARS: Serial number contains ambiguous characters (0/O, 1/I, S/5, B/8)');
    }
  }

  return { value: str, validated: true, warnings, confidenceModifier };
}

/**
 * Normalizes dates (DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY) to ISO-8601 (YYYY-MM-DD)
 */
function normalizeDate(val) {
  if (!val) return { value: null, validated: false, warnings: [] };
  const str = String(val).trim().replace(/[\.\-]/g, '/');
  const parts = str.split('/');

  if (parts.length !== 3) {
    // Check if already ISO YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
      return { value: val.trim(), validated: true, warnings: [] };
    }
    return { value: val, validated: false, warnings: ['INVALID_DATE_FORMAT'] };
  }

  let day = parseInt(parts[0], 10);
  let month = parseInt(parts[1], 10);
  let year = parseInt(parts[2], 10);

  if (year < 100) {
    year = year > 50 ? 1900 + year : 2000 + year;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { value: val, validated: false, warnings: ['IMPOSSIBLE_CALENDAR_DATE'] };
  }

  // Days in month check
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) {
    return { value: val, validated: false, warnings: [`INVALID_DAY_FOR_MONTH: ${day} exceeds max ${daysInMonth}`] };
  }

  const isoStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { value: isoStr, validated: true, warnings: [] };
}

/**
 * Normalizes Indian 10-digit mobile phone numbers
 */
function normalizePhone(val) {
  if (!val) return { value: null, validated: false, warnings: [] };
  let str = String(val).replace(/[\s\-\.\(\)]/g, '');
  if (str.startsWith('+91')) str = str.slice(3);
  else if (str.startsWith('91') && str.length === 12) str = str.slice(2);
  else if (str.startsWith('0') && str.length === 11) str = str.slice(1);

  if (/^[6-9]\d{9}$/.test(str)) {
    return { value: str, validated: true, warnings: [] };
  }

  return { value: str, validated: false, warnings: ['INVALID_INDIAN_PHONE_NUMBER'] };
}

/**
 * Filters out literal placeholders ("N/A", "NA", "-", "NONE", "NIL", "NULL")
 */
function cleanFieldValue(val) {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (str === '' || /^(N\/?A|NA|\-|NIL|NONE|NULL|\.)$/i.test(str)) {
    return null;
  }
  return str;
}

module.exports = {
  INDIAN_STATE_CODES,
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
};
