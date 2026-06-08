// ============================================================
// PACKET ROUTER
// Detects packet type ($10 or $11) and routes to correct parser
// ============================================================

const { parseNormalPacket } = require('./normalParser');
const { parseAlertPacket } = require('./alertParser');
const {
  parseAis140NormalPacket,
  parseAis140AlertPacket,
  parseAis140EmergencyPacket,
  parseAis140LoginPacket,
  parseAis140HealthPacket
} = require('./ais140Parser');

/**
 * Parse a raw packet string (BSTPL-17 or AIS140)
 * Detects type and delegates to the correct parser
 * @param {string} raw - Raw packet (e.g. "$10,..." or "$NRM,...")
 * @returns {object|null} Parsed data or null if unrecognized
 */
function parsePacket(raw) {
  const trimmed = raw.trim();

  // BSTPL-17
  if (trimmed.startsWith('$10')) {
    return parseNormalPacket(trimmed);
  }
  if (trimmed.startsWith('$11')) {
    return parseAlertPacket(trimmed);
  }

  // AIS140
  if (trimmed.startsWith('$NRM')) {
    return parseAis140NormalPacket(trimmed);
  }
  if (trimmed.startsWith('$ALT')) {
    return parseAis140AlertPacket(trimmed);
  }
  if (trimmed.startsWith('$EPB')) {
    return parseAis140EmergencyPacket(trimmed);
  }
  if (trimmed.startsWith('$LGN')) {
    return parseAis140LoginPacket(trimmed);
  }
  if (trimmed.startsWith('$HLM')) {
    return parseAis140HealthPacket(trimmed);
  }

  // Unknown packet type
  console.warn(`[PARSER] Unknown packet type: ${trimmed.substring(0, 10)}...`);
  return null;
}

module.exports = { parsePacket };
