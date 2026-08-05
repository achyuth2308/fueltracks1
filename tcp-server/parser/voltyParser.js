// ============================================================
// VOLTY PROTOCOL PARSER
// Parses Volty AIS-140 standard GPS telemetry packets
// ============================================================

const ALERT_MAP = {
  '3': { type: 'battery', text: 'Disconnect from main battery' },
  '4': { type: 'battery', text: 'Low battery' },
  '5': { type: 'battery', text: 'Low battery removed' },
  '6': { type: 'battery', text: 'Connect back to main battery' },
  '7': { type: 'ignition_on', text: 'Ignition ON' },
  '8': { type: 'ignition_off', text: 'Ignition OFF' },
  '9': { type: 'box_open', text: 'GPS box opened' },
  '10': { type: 'sos', text: 'Emergency state ON' },
  '11': { type: 'sos', text: 'Emergency state OFF' },
  '12': { type: 'general', text: 'Over the air parameter change' },
  '13': { type: 'harsh_driving', text: 'Harsh Braking' },
  '14': { type: 'harsh_driving', text: 'Harsh Acceleration' },
  '15': { type: 'harsh_driving', text: 'Rash Turning' },
  '16': { type: 'sos', text: 'Device Tempered / Emergency wire cut' }
};

function convertCoords(raw, direction) {
  if (!raw || !direction) return null;
  let val = parseFloat(raw);
  if (isNaN(val) || val === 0) return null;
  if (direction === 'S' || direction === 'W') {
    val = -val;
  }
  return parseFloat(val.toFixed(7));
}

function parseVoltyTime(dateStr, timeStr) {
  if (!dateStr || dateStr.length < 6 || !timeStr || timeStr.length < 6) {
    return new Date().toISOString();
  }
  // Date: DDMMYYYY or DDMMYY
  let day, month, year;
  if (dateStr.length === 8) {
    day = dateStr.substring(0, 2);
    month = dateStr.substring(2, 4);
    year = dateStr.substring(4, 8);
  } else {
    day = dateStr.substring(0, 2);
    month = dateStr.substring(2, 4);
    year = '20' + dateStr.substring(4, 6);
  }
  const hours = timeStr.substring(0, 2);
  const minutes = timeStr.substring(2, 4);
  const seconds = timeStr.substring(4, 6);

  const isoString = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

/**
 * Parses the general tracking packet
 */
function parseVoltyPacket(raw) {
  const cleanRaw = raw.replace(/\*/g, '').trim();
  const parts = cleanRaw.split(',');

  // The first 2 fields are header and vendor ID. We assume IMEI is next, followed by other fields.
  let imeiIndex = -1;
  for (let i = 1; i <= 10; i++) {
    if (parts[i] && parts[i].length >= 14 && /^[\d]+$/.test(parts[i])) {
      imeiIndex = i;
      break;
    }
  }

  if (imeiIndex === -1) {
    throw new Error('Could not find IMEI in Volty packet');
  }

  const imei = parts[imeiIndex];
  
  // Safe extraction helper
  const safeGet = (index) => parts[imeiIndex + index] ? parts[imeiIndex + index].trim() : '';

  const gpsFix = safeGet(2); // 1 = GPS fix, 0 = invalid
  const dateStr = safeGet(3);
  const timeStr = safeGet(4);
  const rawLat = safeGet(5);
  const latDir = safeGet(6);
  const rawLng = safeGet(7);
  const lngDir = safeGet(8);
  const speed = safeGet(9);
  const heading = safeGet(10);
  const satellites = safeGet(11);
  const ignition = safeGet(16);
  const inputV = safeGet(18);
  const internalV = safeGet(19);
  const emergencyStatus = safeGet(20);
  const gsmSignal = safeGet(22);

  const lat = convertCoords(rawLat, latDir);
  const lng = convertCoords(rawLng, lngDir);
  const deviceTime = parseVoltyTime(dateStr, timeStr);

  const result = {
    packetType: 'VOLTY_NORMAL',
    imei,
    gpsValid: gpsFix === '1' ? 'A' : 'V',
    lat,
    lng,
    speed: Math.round(parseFloat(speed)) || 0,
    odometer: 0, 
    direction: Math.round(parseFloat(heading)) || 0,
    satellites: parseInt(satellites) || 0,
    gsmSignal: parseInt(gsmSignal) || 0,
    battery: Math.round(Math.min(100, (parseFloat(internalV) / 4.2) * 100)) || 100, 
    ignition: ignition === '1',
    voltage: parseFloat(inputV) || 0,
    isLive: true,
    deviceTime,
    rawPacket: raw
  };
  
  if (emergencyStatus === '1') {
    result.alertText = 'Emergency state ON';
    result.alertType = 'sos';
  }

  return result;
}

module.exports = {
  parseVoltyPacket
};
