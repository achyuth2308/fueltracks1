// ============================================================
// ALERT PACKET PARSER ($11)
// Parses BSTPL-17 alert packets
// ============================================================
// Format:
// $11,{IMEI},{DATE},{TIME},{LAT},{LAT_DIR},{LNG},{LNG_DIR},{ALERT_TEXT}#
// ============================================================

const { ddmToDecimal } = require('../utils/gpsConverter');

/**
 * Parse a $11 alert packet string
 * @param {string} raw - Raw packet string
 * @returns {object} Parsed alert data
 */
function parseAlertPacket(raw) {
  const parts = raw.split(',');

  if (parts.length < 9) {
    throw new Error(`Alert packet has ${parts.length} fields, expected 9+`);
  }

  const imei = parts[1].trim();
  const dateStr = parts[2].trim();
  const timeStr = parts[3].trim();
  const rawLat = parts[4].trim();
  const latDir = parts[5].trim();
  const rawLng = parts[6].trim();
  const lngDir = parts[7].trim();
  // Alert text might contain commas, rejoin remaining parts
  const alertText = parts.slice(8).join(',').replace('#', '').trim();

  const lat = ddmToDecimal(rawLat, latDir);
  const lng = ddmToDecimal(rawLng, lngDir);

  // Parse device time
  const deviceTime = parseAlertTime(dateStr, timeStr);

  return {
    packetType: '$11',
    imei,
    lat,
    lng,
    alertText,
    alertType: categorizeAlert(alertText),
    deviceTime,
    rawPacket: raw,
  };
}

/**
 * Parse date+time from alert packet
 */
function parseAlertTime(dateStr, timeStr) {
  if (!dateStr || dateStr.length < 6 || !timeStr || timeStr.length < 6) {
    return new Date().toISOString();
  }

  const day = dateStr.substring(0, 2);
  const month = dateStr.substring(2, 4);
  const year = '20' + dateStr.substring(4, 6);
  const hours = timeStr.substring(0, 2);
  const minutes = timeStr.substring(2, 4);
  const seconds = timeStr.substring(4, 6);

  const isoString = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return new Date().toISOString();

  return date.toISOString();
}

/**
 * Categorize alert text into types
 */
function categorizeAlert(alertText) {
  const text = alertText.toLowerCase();
  if (text.includes('ignition on')) return 'ignition_on';
  if (text.includes('ignition off')) return 'ignition_off';
  if (text.includes('battery')) return 'battery';
  if (text.includes('box open')) return 'box_open';
  if (text.includes('box close')) return 'box_close';
  if (text.includes('sos')) return 'sos';
  if (text.includes('overspeed')) return 'overspeed';
  if (text.includes('geofence')) return 'geofence';
  if (text.includes('tow')) return 'tow';
  if (text.includes('harsh')) return 'harsh_driving';
  return 'general';
}

module.exports = { parseAlertPacket };
