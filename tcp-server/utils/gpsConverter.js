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
  const value = parseFloat(raw);
  if (isNaN(value) || value === 0) return null;

  const degrees = Math.floor(value / 100);
  const minutes = value % 100;
  let decimal = degrees + (minutes / 60);

  // South and West are negative
  if (direction === 'S' || direction === 'W') {
    decimal = -decimal;
  }

  return parseFloat(decimal.toFixed(7));
}

module.exports = { ddmToDecimal };
