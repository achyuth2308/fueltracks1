// ============================================================
// BSTPL17IS PROTOCOL PARSER
// Parses BSTPL17IS location and alert packets from BS TECHNOTRONICS
// Protocol version: BSTPL17IS
// ============================================================
// Headers:
//   BSTPL$1 - Normal Packet
//   BSTPL$2 - Digital Input 1 (Ignition) Alert
//   BSTPL$A - Digital Input 2 Alert
//   BSTPL$B - Digital Input 3 Alert
//   BSTPL$3 - Main Battery Connection Alert
//   BSTPL$4 - Internal Battery Low Alert
//   BSTPL$5 - Harsh Acceleration Alert
//   BSTPL$6 - Harsh Braking Alert
//   BSTPL$7 - Over Speeding Alert
//   BSTPL$8 - Box Open / Close Alert
//   BSTPL$9 - SOS Alert
// ============================================================

/**
 * Parse a BSTPL17IS packet string into a structured object.
 * @param {string} raw - Raw packet string (e.g. BSTPL$1,AP12AP3456,A,130720,160552,...)
 * @returns {object} Parsed packet data
 */
function parseBstpl17IsPacket(raw) {
  if (!raw) {
    throw new Error('Empty packet received');
  }

  const cleaned = raw.trim();
  const parts = cleaned.split(',');

  if (parts.length < 24) {
    throw new Error(`BSTPL17IS packet has ${parts.length} fields, expected 24+`);
  }

  // Field extraction
  const header = parts[0].trim();
  const imei = parts[1].trim();
  const gpsValid = parts[2].trim();       // 'A' = valid, 'V' = invalid
  const dateStr = parts[3].trim();        // DDMMYY
  const timeStr = parts[4].trim();        // HHMMSS
  const rawLat = parts[5].trim();         // Decimal degree e.g. 27.244183 or DDM
  const latDir = parts[6].trim();         // N or S
  const rawLng = parts[7].trim();         // Decimal degree e.g. 83.673973 or DDM
  const lngDir = parts[8].trim();         // E or W
  const speed = parts[9].trim();          // KMPH
  const odometer = parts[10].trim();      // KM
  const direction = parts[11].trim();     // Heading degrees
  const satellites = parts[12].trim();    // Number of satellites
  const boxStatus = parts[13].trim();     // 0 = Close, 1 = Open
  const gsmSignal = parts[14].trim();     // GSM signal
  const mainBattery = parts[15].trim();   // 1 = Connected, 0 = Disconnected
  const din1 = parts[16].trim();          // 1 = ON, 0 = OFF (Ignition)
  const din2 = parts[17].trim();          // 1 = ON, 0 = OFF
  const din3 = parts[18].trim();          // 1 = ON, 0 = OFF
  const ain1 = parts[19].trim();          // Analog Input 1 voltage
  const reserved = parts[20].trim();      // Reserved
  const internalBattery = parts[21].trim();// Internal Battery voltage (V)
  const firmware = parts[22] ? parts[22].trim() : '';
  const ccid = parts[23] ? parts[23].trim() : '';
  const externalBattery = parts[24] ? parts[24].trim() : '0';

  // Last field (25) may contain RPM and '#' footer (e.g. "0#" or "0")
  const rawRpm = parts[25] ? parts[25].replace('#', '').trim() : '0';

  // Parse coordinates (Decimal Degrees / DDM resilient)
  const lat = parseCoordinate(rawLat, latDir);
  const lng = parseCoordinate(rawLng, lngDir);

  // Parse device time
  const deviceTime = parseDeviceTime(dateStr, timeStr);

  // Categorize alert details
  const { alertType, alertText } = categorizeAlert(
    header,
    din1,
    din2,
    din3,
    mainBattery,
    boxStatus
  );

  const parsedInternalBatt = parseFloat(internalBattery) || 0;
  const parsedExternalBatt = parseFloat(externalBattery) || 0;
  const parsedBattery = parsedExternalBatt || parsedInternalBatt || 0;

  return {
    packetType: header,
    imei,
    gpsValid,
    lat,
    lng,
    speed: parseInt(speed, 10) || 0,
    odometer: parseInt(odometer, 10) || 0,
    direction: parseInt(direction, 10) || 0,
    satellites: parseInt(satellites, 10) || 0,
    boxStatus: boxStatus === '1',
    gsmSignal: parseInt(gsmSignal, 10) || 0,
    mainBatteryStatus: mainBattery === '1',
    ignition: din1 === '1',
    din1: din1 === '1',
    din2: din2 === '1',
    din3: din3 === '1',
    ain1: parseFloat(ain1) || 0,
    internalBattery: parsedInternalBatt,
    externalBattery: parsedExternalBatt,
    battery: parsedBattery,
    voltage: parsedExternalBatt || parseFloat(ain1) || 0,
    firmware,
    ccid,
    rpm: parseInt(rawRpm, 10) || 0,
    alertType,
    alertText,
    isLive: true,
    deviceTime,
    rawPacket: raw
  };
}

/**
 * Resilient coordinate parser: supports both Decimal Degrees (27.244183) and DDM (1720.7174).
 */
function parseCoordinate(raw, dir) {
  if (!raw) return null;
  const str = String(raw).trim();
  const num = parseFloat(str);
  if (isNaN(num)) return null;

  const parts = str.split('.');
  const intPart = parts[0].replace('-', '');

  let val;
  // If intPart has >2 digits and absolute value > 90 (or > 180 for long), it's DDM (DDMM.MMMM or DDDMM.MMMM)
  if (intPart.length > 2 && Math.abs(num) > (dir === 'E' || dir === 'W' ? 180 : 90)) {
    const deg = Math.floor(Math.abs(num) / 100);
    const min = Math.abs(num) % 100;
    val = deg + (min / 60);
  } else {
    // Standard Decimal Degrees
    val = Math.abs(num);
  }

  if (dir === 'S' || dir === 'W' || str.startsWith('-')) {
    val = -val;
  }
  return parseFloat(val.toFixed(7));
}

/**
 * Parse DDMMYY and HHMMSS to ISO 8601 string
 */
function parseDeviceTime(dateStr, timeStr) {
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
 * Categorize alert text and alert type based on header and pin state
 */
function categorizeAlert(header, din1, din2, din3, mainBatt, boxStatus) {
  const h = header.toUpperCase();
  if (h === 'BSTPL$2') {
    return {
      alertType: din1 === '1' ? 'ignition_on' : 'ignition_off',
      alertText: din1 === '1' ? 'Digital Input 1 (Ignition) ON' : 'Digital Input 1 (Ignition) OFF'
    };
  }
  if (h === 'BSTPL$A') {
    return {
      alertType: din2 === '1' ? 'din2_on' : 'din2_off',
      alertText: din2 === '1' ? 'Digital Input 2 ON' : 'Digital Input 2 OFF'
    };
  }
  if (h === 'BSTPL$B') {
    return {
      alertType: din3 === '1' ? 'din3_on' : 'din3_off',
      alertText: din3 === '1' ? 'Digital Input 3 ON' : 'Digital Input 3 OFF'
    };
  }
  if (h === 'BSTPL$3') {
    return {
      alertType: mainBatt === '1' ? 'main_battery_connected' : 'main_battery_disconnected',
      alertText: mainBatt === '1' ? 'Main Battery Connected' : 'Main Battery Disconnected'
    };
  }
  if (h === 'BSTPL$4') {
    return { alertType: 'internal_battery_low', alertText: 'Internal Battery Low' };
  }
  if (h === 'BSTPL$5') {
    return { alertType: 'harsh_acceleration', alertText: 'Harsh Acceleration' };
  }
  if (h === 'BSTPL$6') {
    return { alertType: 'harsh_braking', alertText: 'Harsh Braking' };
  }
  if (h === 'BSTPL$7') {
    return { alertType: 'overspeed', alertText: 'Over Speeding' };
  }
  if (h === 'BSTPL$8') {
    return {
      alertType: boxStatus === '1' ? 'box_open' : 'box_close',
      alertText: boxStatus === '1' ? 'Box Open' : 'Box Close'
    };
  }
  if (h === 'BSTPL$9') {
    return { alertType: 'sos', alertText: 'SOS Emergency Alert' };
  }
  return { alertType: null, alertText: null };
}

module.exports = { parseBstpl17IsPacket };
