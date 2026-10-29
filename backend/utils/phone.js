// ============================================================
// PHONE NUMBER UTILITIES
// Normalizes and masks phone numbers for WhatsApp Cloud API
// ============================================================

'use strict';

/**
 * Normalizes phone numbers to standard E.164 format digits (without leading '+')
 * Default country is 'IN' (India, +91).
 *
 * Examples:
 *   9000666914        -> '919000666914'
 *   09000666914       -> '919000666914'
 *   +91 90006 66914   -> '919000666914'
 *   +91-90006-66914   -> '919000666914'
 *   919000666914      -> '919000666914'
 *   +1 (555) 234-5678 -> '15552345678'
 *   invalid / empty   -> null
 *
 * @param {string|number} raw
 * @param {string} [defaultCountry='IN']
 * @returns {string|null} E.164 formatted digits string or null if invalid
 */
function normalizePhone(raw, defaultCountry = 'IN') {
  if (!raw) return null;

  const rawStr = String(raw).trim();
  if (!rawStr) return null;

  const hasLeadingPlus = rawStr.startsWith('+');
  // Strip all non-digit characters
  const digits = rawStr.replace(/\D/g, '');
  if (!digits) return null;

  // Indian country code normalization
  if (defaultCountry === 'IN') {
    if (hasLeadingPlus) {
      // If explicit +91 was given, validate that the 10 subscriber digits start with 6-9
      if (digits.startsWith('91')) {
        return /^91[6-9]\d{9}$/.test(digits) ? digits : null;
      }
      // Explicit international number (non-+91) with leading +
      if (digits.length >= 8 && digits.length <= 15) {
        return digits;
      }
      return null;
    }

    // Without leading +: local Indian numbers
    // 10 digits starting with 6, 7, 8, or 9
    if (/^[6-9]\d{9}$/.test(digits)) {
      return `91${digits}`;
    }

    // 11 digits starting with 0 followed by 6-9
    if (/^0[6-9]\d{9}$/.test(digits)) {
      return `91${digits.slice(1)}`;
    }

    // 12 digits starting with 91 followed by 6-9
    if (/^91[6-9]\d{9}$/.test(digits)) {
      return digits;
    }

    return null;
  }

  // Non-IN defaultCountry fallback
  if (hasLeadingPlus && digits.length >= 8 && digits.length <= 15) {
    return digits;
  }

  return null;
}

/**
 * Masks phone number to show only the last 4 digits for privacy and logs.
 * Example: '919000666914' -> '******6914'
 *
 * @param {string} phone
 * @returns {string}
 */
function maskPhone(phone) {
  if (!phone) return '****';
  const clean = String(phone).replace(/\D/g, '');
  if (clean.length <= 4) {
    return '****';
  }
  const visible = clean.slice(-4);
  const maskedCount = Math.max(4, clean.length - 4);
  return `${'*'.repeat(maskedCount)}${visible}`;
}

module.exports = {
  normalizePhone,
  maskPhone,
};
