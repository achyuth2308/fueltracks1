// ============================================================
// GPS CONVERTER - DDM to Decimal Degrees
// BSTPL-17 sends Degree Decimal Minutes (DDM)
// We need Decimal Degrees (DD) for maps
// ============================================================

/**
 * Convert DDM (Degree Decimal Minutes) to Decimal Degrees
 * Example: 1720.7174 N → 17.3453°N
 * Example: 07831.4323 E → 78.5239°E
 *
 * Formula: degrees = floor(raw/100), decimal = degrees + ((raw % 100) / 60)
 */
function ddmToDecimal(raw, direction) {
  let str = String(raw).trim();
  if (!str) return null;

  const parts = str.split('.');
  let intPart = parts[0];
  const decPart = parts[1] || '0';

  // If the integer part is 1 or 2 digits (e.g. '17' or '83'), it is ALREADY Decimal Degrees!
  // NMEA DDM format for India will always have 3, 4, or 5 digits (e.g. '1720' or '8354').
  if (intPart.length <= 2) {
    let decimal = parseFloat(intPart + '.' + decPart);
    if (direction === 'S' || direction === 'W') {
      decimal = -decimal;
    }
    return parseFloat(decimal.toFixed(7));
  }

  // For India, latitude is 06 to 38 (always 2 digits degrees). Longitude is 65 to 100 (always 2-3 digits degrees).
  // NMEA standard: Latitude is DDMM.MMMM, Longitude is DDDMM.MMMM
  const isLat = (direction === 'N' || direction === 'S');
  
  if (isLat) {
    // Latitude integer part should be 4 digits (DDMM).
    // If it's 3 digits (e.g. '184'), it could be '0184' (1 deg 84 min - INVALID) or '1804' (18 deg 4 min - VALID).
    while (intPart.length < 4) {
      if (intPart.length === 3) {
        // Test if adding zero to front makes valid minutes
        const minIfFront = parseInt(intPart.slice(1, 3));
        if (minIfFront >= 60) {
          // Must be missing zero in the minutes (e.g. 184 -> 1804)
          intPart = intPart.slice(0, 2) + '0' + intPart.slice(2);
        } else {
          // Could be either (e.g. 123 -> 0123 or 1203). Since India is >= 6 deg, 01 is Ocean.
          // So we assume it's missing in minutes for India, unless it's genuinely a 1-digit degree.
          // Hardcode India assumption for this specific deployment to prevent 2.x degree anomalies.
          const degIfFront = parseInt(intPart.slice(0, 1));
          if (degIfFront < 6) {
             intPart = intPart.slice(0, 2) + '0' + intPart.slice(2); // Force 1203 instead of 0123
          } else {
             intPart = '0' + intPart;
          }
        }
      } else {
        intPart = '0' + intPart;
      }
    }
  } else {
    // Longitude integer part should be 5 digits (DDDMM).
    // If it's 4 digits (e.g. '0831'), it could be '00831' (8 deg) or '08031' (80 deg).
    while (intPart.length < 5) {
      if (intPart.length === 4) {
        const minIfFront = parseInt(intPart.slice(2, 4));
        if (minIfFront >= 60) {
          intPart = intPart.slice(0, 3) + '0' + intPart.slice(3);
        } else {
          const degIfFront = parseInt(intPart.slice(0, 2));
          if (degIfFront < 60) {
             intPart = intPart.slice(0, 3) + '0' + intPart.slice(3); // Assume missing zero in minutes for Indian longitude (65-100)
          } else {
             intPart = '0' + intPart;
          }
        }
      } else {
        intPart = '0' + intPart;
      }
    }
  }

  const fullStr = intPart + '.' + decPart;
  const value = parseFloat(fullStr);
  if (isNaN(value) || value === 0) return null;

  const degrees = Math.floor(value / 100);
  const minutes = value % 100;
  let decimal = degrees + (minutes / 60);

  if (direction === 'S' || direction === 'W') {
    decimal = -decimal;
  }

  return parseFloat(decimal.toFixed(7));
}

module.exports = { ddmToDecimal };
