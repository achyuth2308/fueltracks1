// ============================================================
// NORMAL PACKET PARSER ($10)
// Parses BSTPL-17 normal/location packets
// ============================================================
// Format:
// $10,{IMEI},{GPS_VALID},{DATE},{TIME},{LAT},{LAT_DIR},{LNG},{LNG_DIR},
// {SPEED},{ODO},{DIR},{SATS},{GSM},{BATT},{IGN},{DIN2},{DIN3},{ENG},
// {AIN},{FUEL},{VOLT},{L_OR_H}#
// ============================================================

const { ddmToDecimal } = require('../utils/gpsConverter');

/**
 * Parse a $10 normal packet string into a structured object
 * @param {string} raw - Raw packet string (without $ prefix and # suffix)
 * @returns {object} Parsed packet data
 */
function parseNormalPacket(raw) {
  // Split by comma
  const parts = raw.split(',');

  if (parts.length < 22) {
    throw new Error(`Normal packet has ${parts.length} fields, expected 22+`);
  }

  // Extract fields by position
  const imei = parts[1].trim();
  const gpsValid = parts[2].trim();       // A = valid, V = invalid
  const dateStr = parts[3].trim();         // DDMMYY
  const timeStr = parts[4].trim();         // HHMMSS
  const rawLat = parts[5].trim();          // DDM format e.g. 1720.7174
  const latDir = parts[6].trim();          // N or S
  const rawLng = parts[7].trim();          // DDM format e.g. 07831.4323
  const lngDir = parts[8].trim();          // E or W
  const speed = parts[9].trim();           // km/h
  const odometer = parts[10].trim();       // Total km
  const direction = parts[11].trim();      // Degrees 0-360
  const satellites = parts[12].trim();
  const gsmSignal = parts[13].trim();
  const battery = parts[14].trim();
  const ignition = parts[15].trim();       // 1 = ON, 0 = OFF
  const din2 = parts[16].trim();
  const din3 = parts[17].trim();
  const engineHours = parts[18].trim();
  const ain = parts[19].trim();
  const fuel = parts[20].trim();
  const voltage = parts[21].trim();
  // L_OR_H might have # at end
  const lOrH = (parts[22] || 'L').replace('#', '').trim();

  // Convert DDM to Decimal Degrees
  const lat = ddmToDecimal(rawLat, latDir);
  const lng = ddmToDecimal(rawLng, lngDir);

  // Parse device time: DDMMYY + HHMMSS → ISO timestamp
  const deviceTime = parseDeviceTime(dateStr, timeStr);

  return {
    packetType: '$10',
    imei,
    gpsValid,
    lat,
    lng,
    speed: parseInt(speed) || 0,
    odometer: parseInt(odometer) || 0,
    direction: parseInt(direction) || 0,
    satellites: parseInt(satellites) || 0,
    gsmSignal: parseInt(gsmSignal) || 0,
    battery: parseInt(battery) || 0,
    ignition: ignition === '1',
    din2: din2 === '1',
    din3: din3 === '1',
    engineHours: parseFloat(engineHours) || 0,
    ain: parseFloat(ain) || 0,
    fuel: parseFloat(fuel) || 0,
    voltage: parseFloat(voltage) || 0,
    isLive: lOrH === 'L',            // L = live, H = buffered history
    deviceTime,
    rawPacket: raw,
  };
}

/**
 * Parse BSTPL date+time to ISO timestamp
 * Date: DDMMYY, Time: HHMMSS
 */
function parseDeviceTime(dateStr, timeStr) {
  if (!dateStr || dateStr.length < 6 || !timeStr || timeStr.length < 6) {
    return null;
  }

  const day = dateStr.substring(0, 2);
  const month = dateStr.substring(2, 4);
  const year = '20' + dateStr.substring(4, 6);  // Assuming 2000s

  const hours = timeStr.substring(0, 2);
  const minutes = timeStr.substring(2, 4);
  const seconds = timeStr.substring(4, 6);

  // Create ISO string: YYYY-MM-DDTHH:MM:SS
  const isoString = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;

  const date = new Date(isoString);
  if (isNaN(date.getTime())) return null;

  return date.toISOString();
}

module.exports = { parseNormalPacket };
