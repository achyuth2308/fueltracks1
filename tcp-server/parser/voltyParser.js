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

  // Look for the 14-16 digit numeric IMEI anywhere in the first few fields of the header
  let imeiIndex = -1;
  for (let i = 1; i < Math.min(parts.length, 10); i++) {
    if (parts[i] && parts[i].length >= 14 && /^\d+$/.test(parts[i].trim())) {
      imeiIndex = i;
      break;
    }
  }

  if (imeiIndex === -1) {
    const header = (parts[0] || '').toUpperCase();
    const pktType = (parts[3] || '').toUpperCase();
    if (pktType === 'OC' || header.includes('OC') || parts.includes('OC')) {
      return {
        packetType: 'VOLTY_OPEN_CONN',
        imei: null,
        isHeartbeat: true,
        rawPacket: raw,
        deviceTime: new Date().toISOString()
      };
    }
    throw new Error('Could not find IMEI in Volty packet');
  }

  const imei = parts[imeiIndex];
  
  // Safe extraction helper
  const safeGet = (index) => parts[imeiIndex + index] ? parts[imeiIndex + index].trim() : '';

  // Check if packet is Health Monitoring ($HLM / $HLT)
  const header = (parts[0] || '').toUpperCase();
  const pktType = (parts[3] || '').toUpperCase();
  if (header.includes('HLM') || header.includes('HLT') || pktType === 'HL' || pktType === 'HP' || (parts.length - imeiIndex <= 9)) {
    const batteryPercent = parseInt(safeGet(1), 10) || 100;
    const lowBattThreshold = parseInt(safeGet(2), 10) || 15;
    const memoryPercent = parseInt(safeGet(3), 10) || 0;
    return {
      packetType: '$HLM',
      imei,
      batteryPercent,
      lowBattThreshold,
      memoryPercent,
      deviceTime: new Date().toISOString(),
      rawString: raw
    };
  }

  const gpsFix = safeGet(2); // 1 = GPS fix, 0 = invalid
  const dateStr = safeGet(3);
  const timeStr = safeGet(4);
  const rawLat = safeGet(5);
  const latDir = safeGet(6);
  const rawLng = safeGet(7);
  const lngDir = safeGet(8);
  const speedStr = safeGet(9);
  const heading = safeGet(10);
  const satellites = safeGet(11);
  const ignition = safeGet(16);
  const mainPowerStatus = safeGet(17); // 1 = connected to vehicle battery, 0 = disconnected
  const inputV = safeGet(18);
  const internalV = safeGet(19);
  const emergencyStatus = safeGet(20);
  const gsmSignal = safeGet(22);

  const rawSpeed = parseFloat(speedStr) || 0;
  // Filter GPS drift below 2.0 km/h
  const cleanSpeed = rawSpeed > 2.0 ? Math.round(rawSpeed) : 0;

  const mainVoltage = parseFloat(inputV) || 0;
  const internalVoltage = parseFloat(internalV) || 0;

  // If power is removed (voltage <= 5V or mainPowerStatus is '0'), vehicle ignition is definitely OFF
  const hasExternalPower = mainVoltage > 5.0 && mainPowerStatus !== '0';
  const isIgnition = hasExternalPower ? (ignition === '1') : false;

  const lat = convertCoords(rawLat, latDir);
  const lng = convertCoords(rawLng, lngDir);
  const deviceTime = parseVoltyTime(dateStr, timeStr);

  const isGpsFixed = gpsFix === '1' || gpsFix.toUpperCase() === 'A';
  const isGpsValid = isGpsFixed && lat !== null && lng !== null;

  console.log(`[TCP - VOLTY - DEBUG] IMEI ${imei}: gpsFix=${gpsFix} (valid=${isGpsValid}), lat=${lat}, lng=${lng}, speed=${cleanSpeed}, ign=${isIgnition}, vIn=${mainVoltage}V, vBatt=${internalVoltage}V`);

    const lOrH = imeiIndex >= 1 ? parts[imeiIndex - 1].trim().toUpperCase() : 'L';
    const isLivePacket = lOrH !== 'H' && lOrH !== 'A'; // H/A = History/Archive

    const result = {
      packetType: 'VOLTY_NORMAL',
      imei,
      gpsValid: isGpsValid ? 'A' : 'V',
      lat,
      lng,
      speed: cleanSpeed,
      odometer: 0, 
      direction: Math.round(parseFloat(heading)) || 0,
      satellites: parseInt(satellites) || 0,
      gsmSignal: parseInt(gsmSignal) || 0,
      battery: Math.round(Math.min(100, Math.max(0, (internalVoltage / 4.2) * 100))) || 100, 
      ignition: isIgnition,
      voltage: mainVoltage,
      isLive: isLivePacket,
      deviceTime,
    rawPacket: raw
  };
  
  // Check for alert ID in the packet header (e.g. $PVT,VLT1,M1.2.2,NR,01,L,IMEI)
  const alertIdRaw = imeiIndex >= 2 ? parts[imeiIndex - 2] : '';
  const alertId = parseInt(alertIdRaw, 10);
  if (alertId && ALERT_MAP[alertId.toString()]) {
    result.alertType = ALERT_MAP[alertId.toString()].type;
    result.alertText = ALERT_MAP[alertId.toString()].text;
  }

  if (emergencyStatus === '1') {
    result.alertText = 'Emergency state ON';
    result.alertType = 'sos';
  }

  return result;
}

module.exports = {
  parseVoltyPacket
};
