// ============================================================
// PACKET ROUTER
// Detects packet type ($10 or $11) and routes to correct parser
// ============================================================

const { parseNormalPacket } = require('./normalParser');
const { parseAlertPacket } = require('./alertParser');

/**
 * Parse a raw BSTPL-17 packet string
 * Detects type and delegates to the correct parser
 * @param {string} raw - Raw packet (e.g. "$10,865006...,A,...#")
 * @returns {object|null} Parsed data or null if unrecognized
 */
function parsePacket(raw) {
  const trimmed = raw.trim();

  if (trimmed.startsWith('$10')) {
    return parseNormalPacket(trimmed);
  }

  if (trimmed.startsWith('$11')) {
    return parseAlertPacket(trimmed);
  }

  // Unknown packet type
  console.warn(`[PARSER] Unknown packet type: ${trimmed.substring(0, 10)}...`);
  return null;
}

module.exports = { parsePacket };
