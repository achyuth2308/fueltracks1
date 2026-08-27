// ============================================================
// PACKET ROUTER
// Detects packet type and routes to the correct parser.
// Supported protocols:
//   - BSTPL-17   ($10 / $11)
//   - AIS140 V1  ($NRM / $ALT / $EPB / $LGN / $HLM)
//   - AIS140 V2  ($,10 / $,200 / $,101 / $,EPB / $,PC / $,500 / ACTVR / HCHKR / $VehicleNo$IMEI...)
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
const {
  parseAis140V2Packet,
  isV2LoginPacket,
} = require('./ais140V2Parser');
const { parseVoltyPacket } = require('./voltyParser');

/**
 * Parse a raw packet string and delegate to the correct protocol parser.
 * @param {string} raw - Raw packet string received from the device
 * @returns {object|null} Parsed data or null if unrecognized
 */
function parsePacket(raw) {
  const trimmed = raw.trim();

  // ---- VOLTY PROTOCOL (Identified by VLT1 / Volty vendor signature or Volty headers) ----
  if (trimmed.includes('VLT1') || trimmed.includes('Volty') || trimmed.startsWith('$PVT') || trimmed.startsWith('$HEL') || trimmed.startsWith('$SET') || trimmed.startsWith('$DOD') || trimmed.startsWith('$VLT')) {
    try {
      const voltyParsed = parseVoltyPacket(trimmed);
      if (voltyParsed) return voltyParsed;
    } catch (e) {
      console.warn(`[PARSER - VOLTY] Error parsing Volty packet: ${e.message}`);
    }
  }

  // ---- BSTPL-17 ----
  if (trimmed.startsWith('$10')) {
    return parseNormalPacket(trimmed);
  }
  if (trimmed.startsWith('$11')) {
    return parseAlertPacket(trimmed);
  }

  // ---- AIS140 V1 ----
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

  // ---- AIS140 V2 — comma-delimited general packets ($,10 / $,200 / $,101 / $,EPB / $,PC / $,500) ----
  if (trimmed.startsWith('$,')) {
    return parseAis140V2Packet(trimmed);
  }

  // ---- AIS140 V2 — ACTV / HCHKR activation/health-check responses ----
  if (trimmed.startsWith('ACTVR') || trimmed.startsWith('HCHKR')) {
    return parseAis140V2Packet(trimmed);
  }

  // ---- AIS140 V2 — dollar-delimited login packet ($VehicleNo$IMEI$...) ----
  if (isV2LoginPacket(trimmed)) {
    return parseAis140V2Packet(trimmed);
  }

  // ---- Fallback for other standard dollar-prefixed packets ----
  if (trimmed.match(/^\$[A-Z0-9]{2,5},/)) {
    try {
      const voltyParsed = parseVoltyPacket(trimmed);
      if (voltyParsed) return voltyParsed;
    } catch (e) {
      // fallback
    }
  }

  // Unknown packet type
  console.warn(`[PARSER] Unknown packet type: ${trimmed.substring(0, 20)}...`);
  return null;
}

module.exports = { parsePacket };
