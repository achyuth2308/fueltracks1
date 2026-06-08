// ============================================================
// AIS140 PACKET PARSER
// Parses tnavIC AIS140 standard GPS telemetry packets
// ============================================================

const ALERT_MAP = {
  '1': { type: 'general', text: 'Location Update' },
  '2': { type: 'general', text: 'Location Update (History)' },
  '3': { type: 'battery', text: 'Mains Off (Battery Disconnected)' },
  '4': { type: 'battery', text: 'Low Battery Alert' },
  '5': { type: 'battery', text: 'Low Battery Removed' },
  '6': { type: 'battery', text: 'Mains On (Battery Connected)' },
  '7': { type: 'ignition_on', text: 'Ignition On' },
  '8': { type: 'ignition_off', text: 'Ignition Off' },
  '9': { type: 'box_open', text: 'Tamper Alert (Box Open)' },
  '10': { type: 'sos', text: 'Emergency On (SOS)' },
  '11': { type: 'sos', text: 'Emergency Off (SOS)' },
  '12': { type: 'general', text: 'OTA Alert' },
  '13': { type: 'harsh_driving', text: 'Harsh Braking Alert' },
  '14': { type: 'harsh_driving', text: 'Harsh Acceleration Alert' },
  '15': { type: 'harsh_driving', text: 'Rash Turning Alert' },
  '16': { type: 'sos', text: 'SOS Button Wire Disconnect Alert' },
  '17': { type: 'overspeed', text: 'Overspeed Alert' },
  '18': { type: 'geofence', text: 'Geofence In Alert' },
  '19': { type: 'geofence', text: 'Geofence Out Alert' },
  '22': { type: 'general', text: 'Tilt Alert' },
  '30': { type: 'general', text: 'Motion Start' },
  '31': { type: 'general', text: 'Motion Stop' },
  '32': { type: 'general', text: 'Relay Event' },
  '33': { type: 'general', text: 'New ID Detected' },
  '36': { type: 'general', text: 'Temperature High Alert' },
  '37': { type: 'general', text: 'Temperature Low Alert' },
  '40': { type: 'general', text: 'FOTA Failed' }
};

/**
 * Helper to convert coordinate values to sign-applied decimal degrees
 */
function convertCoords(raw, direction) {
  let val = parseFloat(raw);
  if (isNaN(val) || val === 0) return null;
  if (direction === 'S' || direction === 'W') {
    val = -val;
  }
  return parseFloat(val.toFixed(7));
}

/**
 * Parse AIS140 date (DDMMYYYY) + time (HHMMSS) into ISO timestamp
 */
function parseAis140Time(dateStr, timeStr) {
  if (!dateStr || dateStr.length < 8 || !timeStr || timeStr.length < 6) {
    return new Date().toISOString();
  }
  const day = dateStr.substring(0, 2);
  const month = dateStr.substring(2, 4);
  const year = dateStr.substring(4, 8);
  const hours = timeStr.substring(0, 2);
  const minutes = timeStr.substring(2, 4);
  const seconds = timeStr.substring(4, 6);

  const isoString = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

/**
 * Parse AIS140 merged date-time (DDMMYYYYHHMMSS) into ISO timestamp
 */
function parseAis140MergedTime(dateTimeStr) {
  if (!dateTimeStr || dateTimeStr.length < 14) {
    return new Date().toISOString();
  }
  const day = dateTimeStr.substring(0, 2);
  const month = dateTimeStr.substring(2, 4);
  const year = dateTimeStr.substring(4, 8);
  const hours = dateTimeStr.substring(8, 10);
  const minutes = dateTimeStr.substring(10, 12);
  const seconds = dateTimeStr.substring(12, 14);

  const isoString = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

/**
 * Parse $NRM normal packet
 */
function parseAis140NormalPacket(raw) {
  const cleanRaw = raw.replace('*', '').trim();
  const parts = cleanRaw.split(',');

  if (parts.length < 32) {
    throw new Error(`AIS140 normal packet has ${parts.length} fields, expected 32+`);
  }

  const imei = parts[6].trim();
  const gpsFix = parts[8].trim(); // 1 = valid, 0 = invalid
  const dateStr = parts[9].trim();
  const timeStr = parts[10].trim();
  const rawLat = parts[11].trim();
  const latDir = parts[12].trim();
  const rawLng = parts[13].trim();
  const lngDir = parts[14].trim();
  const speed = parts[15].trim();
  const direction = parts[16].trim();
  const satellites = parts[17].trim();
  const ignition = parts[22].trim();
  const voltage = parts[24].trim();

  // Extract Odometer from near the end
  // Format end structure: ...,DigitalInputStatus,DigitalOutputStatus,AnalogInput1,AnalogInput2,FrameNo,Odometer,DebugInfo,Checksum
  const odometerStr = parts[parts.length - 3] || '0';
  const batteryVoltageStr = parts[25] || '0';
  
  const lat = convertCoords(rawLat, latDir);
  const lng = convertCoords(rawLng, lngDir);
  const deviceTime = parseAis140Time(dateStr, timeStr);
  const isLive = parts[5].trim() === 'L';

  return {
    packetType: '$NRM',
    imei,
    gpsValid: gpsFix === '1' ? 'A' : 'V',
    lat,
    lng,
    speed: parseFloat(speed) || 0,
    odometer: parseFloat(odometerStr) || 0,
    direction: parseFloat(direction) || 0,
    satellites: parseInt(satellites) || 0,
    gsmSignal: parseInt(parts[28]) || 0,
    battery: parseFloat(batteryVoltageStr) * 20 || 100, // Estimate percentage if voltage is given
    ignition: ignition === '1',
    din2: false,
    din3: false,
    engineHours: 0,
    ain: parseFloat(parts[parts.length - 6]) || 0,
    fuel: 0,
    voltage: parseFloat(voltage) || 0,
    isLive,
    deviceTime,
    rawPacket: raw
  };
}

/**
 * Parse $ALT alert packet
 */
function parseAis140AlertPacket(raw) {
  const cleanRaw = raw.replace('*', '').trim();
  const parts = cleanRaw.split(',');

  if (parts.length < 32) {
    throw new Error(`AIS140 alert packet has ${parts.length} fields, expected 32+`);
  }

  const alertId = parts[4].trim();
  const alertConfig = ALERT_MAP[alertId] || { type: 'general', text: `Alert ${alertId}` };

  const imei = parts[6].trim();
  const rawLat = parts[11].trim();
  const latDir = parts[12].trim();
  const rawLng = parts[13].trim();
  const lngDir = parts[14].trim();
  const dateStr = parts[9].trim();
  const timeStr = parts[10].trim();

  const lat = convertCoords(rawLat, latDir);
  const lng = convertCoords(rawLng, lngDir);
  const deviceTime = parseAis140Time(dateStr, timeStr);

  return {
    packetType: '$ALT',
    imei,
    lat,
    lng,
    alertText: alertConfig.text,
    alertType: alertConfig.type,
    deviceTime,
    rawPacket: raw
  };
}

/**
 * Parse $EPB emergency packet
 */
function parseAis140EmergencyPacket(raw) {
  const cleanRaw = raw.replace('*', '').trim();
  const parts = cleanRaw.split(',');

  if (parts.length < 14) {
    throw new Error(`AIS140 emergency packet has ${parts.length} fields, expected 14+`);
  }

  const packetType = parts[1].trim(); // EMR or SEM
  const imei = parts[2].trim();
  const status = parts[3].trim(); // NM = normal, SP = stored
  const dateTimeStr = parts[4].trim(); // DDMMYYYYHHMMSS
  const gpsFix = parts[5].trim(); // A or V
  const rawLat = parts[6].trim();
  const latDir = parts[7].trim();
  const rawLng = parts[8].trim();
  const lngDir = parts[9].trim();
  const speed = parts[11].trim();

  const lat = convertCoords(rawLat, latDir);
  const lng = convertCoords(rawLng, lngDir);
  const deviceTime = parseAis140MergedTime(dateTimeStr);

  const alertText = packetType === 'SEM' ? 'Stop Message (Emergency Ended)' : 'Emergency Message (SOS Pressed)';

  // We return a parsed structure resembling location updates for mapping
  // as well as alert information so it can trigger notifications.
  return {
    packetType: '$EPB',
    imei,
    gpsValid: gpsFix,
    lat,
    lng,
    speed: parseFloat(speed) || 0,
    odometer: 0,
    direction: 0,
    satellites: 8,
    gsmSignal: 31,
    battery: 100,
    ignition: true, // Emergency is typically active ignition
    din2: false,
    din3: false,
    engineHours: 0,
    ain: 0,
    fuel: 0,
    voltage: 12.0,
    isLive: status === 'NM',
    deviceTime,
    alertText,
    alertType: 'sos',
    rawPacket: raw
  };
}

/**
 * Parse $LGN login packet
 */
function parseAis140LoginPacket(raw) {
  const parts = raw.replace('*', '').trim().split(',');
  const imei = parts[2] ? parts[2].trim() : 'unknown';
  return {
    packetType: '$LGN',
    imei,
    vehicleRegNo: parts[1] ? parts[1].trim() : '',
    softwareVersion: parts[3] ? parts[3].trim() : '',
    rawPacket: raw
  };
}

/**
 * Parse $HLM health monitoring packet
 */
function parseAis140HealthPacket(raw) {
  const parts = raw.replace('*', '').trim().split(',');
  const imei = parts[3] ? parts[3].trim() : 'unknown';
  return {
    packetType: '$HLM',
    imei,
    batteryPercent: parts[4] ? parseInt(parts[4]) : 100,
    rawPacket: raw
  };
}

module.exports = {
  parseAis140NormalPacket,
  parseAis140AlertPacket,
  parseAis140EmergencyPacket,
  parseAis140LoginPacket,
  parseAis140HealthPacket
};
