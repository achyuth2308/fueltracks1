// ============================================================
// AIS140 V2.0 PACKET PARSER
// Parses AIS140 Protocol Document V2.0 (MODEL NO:1819001A)
// ============================================================
//
// Supported packet types:
//   - LOGIN:   $VehicleNo$IMEI$Firmware$Protocol$Lat$LatDir$Lng$LngDir$
//   - GENERAL: $,10,...*  (normal/live)  or  $,200,...* (history)
//   - HEALTH:  $,101,...*
//   - EMERGENCY: $,EPB,EMR/SEM,...*
//   - OTA/PARAM CHANGE: $,PC,...*
//   - DIAGNOSIS: $,500,...*
//   - ACTIVATION: ACTVR,...  (no leading $)
//   - HEALTH CHECK: HCHKR,...  (no leading $)
// ============================================================

// ---- Alert ID map (from spec pages 4-5) ----
const ALERT_MAP = {
  '01': { type: 'general',       text: 'Location Update' },
  '02': { type: 'general',       text: 'Location Update (History)' },
  '03': { type: 'battery',       text: 'Alert – Disconnected from Main Battery' },
  '04': { type: 'battery',       text: 'Alert – Low Battery' },
  '05': { type: 'battery',       text: 'Alert – Internal Battery Charged Again' },
  '06': { type: 'battery',       text: 'Alert – Connected to Main Battery' },
  '07': { type: 'ignition_on',   text: 'Alert – Ignition ON' },
  '08': { type: 'ignition_off',  text: 'Alert – Ignition OFF' },
  '09': { type: 'box_open',      text: 'Alert – Box Opened (Tamper)' },
  '10': { type: 'sos',           text: 'Alert – Emergency State ON' },
  '11': { type: 'sos',           text: 'Alert – Emergency State OFF' },
  '12': { type: 'general',       text: 'Alert – Over-The-Air Parameter Change' },
  '13': { type: 'harsh_driving', text: 'Alert – Harsh Braking' },
  '14': { type: 'harsh_driving', text: 'Alert – Harsh Acceleration' },
  '15': { type: 'harsh_driving', text: 'Alert – Rash Turning' },
  '16': { type: 'sos',           text: 'Alert – Device Tampered' },
  '17': { type: 'overspeed',     text: 'Alert – Over Speed' },
  '18': { type: 'general',       text: 'Alert – Tilt' },
  // Numeric string aliases (single-digit without leading zero)
  '1':  { type: 'general',       text: 'Location Update' },
  '2':  { type: 'general',       text: 'Location Update (History)' },
  '3':  { type: 'battery',       text: 'Alert – Disconnected from Main Battery' },
  '4':  { type: 'battery',       text: 'Alert – Low Battery' },
  '5':  { type: 'battery',       text: 'Alert – Internal Battery Charged Again' },
  '6':  { type: 'battery',       text: 'Alert – Connected to Main Battery' },
  '7':  { type: 'ignition_on',   text: 'Alert – Ignition ON' },
  '8':  { type: 'ignition_off',  text: 'Alert – Ignition OFF' },
  '9':  { type: 'box_open',      text: 'Alert – Box Opened (Tamper)' },
};

// ---- Packet type codes (field 5) ----
const PACKET_TYPE_MAP = {
  'NR': 'Normal',
  'EA': 'Emergency Alert',
  'TA': 'Tamper Alert',
  'HP': 'Health Packet',
  'IN': 'Ignition On',
  'IF': 'Ignition Off',
  'BD': 'Vehicle Battery Disconnect',
  'BR': 'Vehicle Battery Reconnect',
  'BC': 'Internal Battery Charged',
  'BL': 'Internal Battery Low',
  'HB': 'Harsh Braking',
  'HA': 'Harsh Acceleration',
  'RT': 'Rash Turn',
  'PC': 'Parameter Change',
  'OS': 'Over Speed',
  'TL': 'Tilt',
};

// ============================================================
// HELPERS
// ============================================================

/**
 * Convert decimal-degree lat/lng with direction character to signed decimal.
 * The AIS140 V2 protocol transmits coordinates already in decimal degree format.
 */
function convertCoords(rawVal, direction) {
  const val = parseFloat(rawVal);
  if (isNaN(val) || val === 0) return null;
  const signed = (direction === 'S' || direction === 'W') ? -Math.abs(val) : Math.abs(val);
  return parseFloat(signed.toFixed(7));
}

/**
 * Parse AIS140 V2 date (DDMMYYYY) + time (HHMMSS) into ISO timestamp.
 * The V2 spec uses 8-char date: DDMMYYYY  (e.g. 23112020)
 */
function parseV2Time(dateStr, timeStr) {
  if (!dateStr || dateStr.length < 8 || !timeStr || timeStr.length < 6) {
    return new Date().toISOString();
  }
  const day   = dateStr.substring(0, 2);
  const month = dateStr.substring(2, 4);
  const year  = dateStr.substring(4, 8);
  const hh    = timeStr.substring(0, 2);
  const mm    = timeStr.substring(2, 4);
  const ss    = timeStr.substring(4, 6);
  const iso   = `${year}-${month}-${day}T${hh}:${mm}:${ss}Z`;
  const d     = new Date(iso);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/**
 * Parse merged datetime string DDMMYYYYHHMMSS into ISO timestamp.
 * Used by EPB emergency packets.
 */
function parseMergedTime(str) {
  if (!str || str.length < 14) return new Date().toISOString();
  return parseV2Time(str.substring(0, 8), str.substring(8, 14));
}

/**
 * Strip the trailing checksum and end-marker from a raw packet string.
 * V2 general packets end with:  ...,FrameNo,Checksum,*
 * We just need the comma-delimited fields.
 */
function cleanPacket(raw) {
  // Remove everything after and including the last '*'
  const starIdx = raw.lastIndexOf('*');
  return starIdx !== -1 ? raw.substring(0, starIdx) : raw;
}

// ============================================================
// 1. LOGIN PACKET
// Format: $VehicleNo$IMEI$FirmwareVer$ProtocolVer$Lat$LatDir$Lng$LngDir$
// Delimiter: '$'  (starts with '$', ends with '$')
// Example:  $TN3CBZ1122$864376047795371$1.0.9$1.0$28.651379$N$77.092681$E$
// ============================================================
function parseAis140V2LoginPacket(raw) {
  // Remove leading '$', then split by '$'
  const stripped = raw.startsWith('$') ? raw.slice(1) : raw;
  // Remove trailing '$' if present
  const withoutTrailing = stripped.endsWith('$') ? stripped.slice(0, -1) : stripped;
  const parts = withoutTrailing.split('$');

  // Expected: [VehicleNo, IMEI, Firmware, Protocol, Lat, LatDir, Lng, LngDir]
  const vehicleRegNo   = (parts[0] || '').trim();
  const imei           = (parts[1] || '').trim();
  const firmwareVer    = (parts[2] || '').trim();
  const protocolVer    = (parts[3] || '').trim();
  const rawLat         = (parts[4] || '').trim();
  const latDir         = (parts[5] || 'N').trim();
  const rawLng         = (parts[6] || '').trim();
  const lngDir         = (parts[7] || 'E').trim();

  const lat = convertCoords(rawLat, latDir);
  const lng = convertCoords(rawLng, lngDir);

  return {
    packetType:    'AIS140V2_LOGIN',
    imei,
    vehicleRegNo,
    firmwareVer,
    protocolVer,
    lat,
    lng,
    rawPacket: raw,
  };
}

// ============================================================
// 2. GENERAL DATA PACKET
// Header:    10 (live/normal) or 200 (history)
// Format:    $,10,VendorID,Firmware,PacketType,AlertID,PacketStatus,IMEI,VehicleNo,
//            GPSFix,Date,Time,Lat,LatDir,Lng,LngDir,Speed,Heading,Satellites,Altitude,
//            PDOP,HDOP,NetworkOp,Ignition,MainsPower,MainsVoltage,InternalBattery,
//            SOS,GSMSignal,MCC,MNC,LAC,CellId,
//            Neighbour1CellId,Neighbour1LAC,Neighbour1Signal,
//            Neighbour2CellId,Neighbour2LAC,Neighbour2Signal,
//            Neighbour3CellId,Neighbour3LAC,Neighbour3Signal,
//            Neighbour4CellId,Neighbour4LAC,Neighbour4Signal,
//            DigitalInputStatus,DigitalOutputStatus,FrameNumber,[Checksum]*
// Example:
//  $,10,APMK,1.1.2,NR,01,L,869247045236301,kl23m212,0,23112020,154924,0.0,N,0.0,E,
//  0,0,0,0,0,0,VODAFONE,0,1,14.0,4.1,0,31,404,84,C775,5510,...,0000,00,002185,0033,*
// ============================================================
function parseAis140V2GeneralPacket(raw) {
  const cleaned = cleanPacket(raw);
  const parts   = cleaned.split(',');

  // parts[0] = '$'  (empty string after leading $,)
  // parts[1] = '10' or '200'
  const header        = (parts[1] || '').trim();
  const vendorId      = (parts[2] || '').trim();
  const firmwareVer   = (parts[3] || '').trim();
  const pktTypeCode   = (parts[4] || '').trim();   // NR, EA, IN, IF, etc.
  const alertIdRaw    = (parts[5] || '').trim();   // 01-18
  const packetStatus  = (parts[6] || 'L').trim();  // L = Live, H = History
  const imei          = (parts[7] || '').trim();
  const vehicleRegNo  = (parts[8] || '').trim();
  const gpsFix        = (parts[9] || '0').trim();  // 1 = fixed, 0 = not fixed
  const dateStr       = (parts[10] || '').trim();  // DDMMYYYY
  const timeStr       = (parts[11] || '').trim();  // HHMMSS
  const rawLat        = (parts[12] || '0').trim();
  const latDir        = (parts[13] || 'N').trim();
  const rawLng        = (parts[14] || '0').trim();
  const lngDir        = (parts[15] || 'E').trim();
  const speed         = (parts[16] || '0').trim(); // km/h floating point
  const heading       = (parts[17] || '0').trim(); // degrees
  const satellites    = (parts[18] || '0').trim();
  const altitude      = (parts[19] || '0').trim();
  const pdop          = (parts[20] || '0').trim();
  const hdop          = (parts[21] || '0').trim();
  const networkOp     = (parts[22] || '').trim();
  const ignition      = (parts[23] || '0').trim(); // 0/1
  const mainsPower    = (parts[24] || '0').trim(); // 0=disconnected, 1=connected
  const mainsVoltage  = (parts[25] || '0').trim(); // Vehicle battery voltage
  const internalBatt  = (parts[26] || '0').trim(); // Internal battery voltage
  const sos           = (parts[27] || '0').trim(); // 0/1
  const gsmSignal     = (parts[28] || '0').trim(); // 0-31
  const mcc           = (parts[29] || '').trim();
  const mnc           = (parts[30] || '').trim();
  const lac           = (parts[31] || '').trim();
  const cellId        = (parts[32] || '').trim();

  // Neighbour cells: fields 33-46 (4 neighbours × 3 fields each)
  // fields 47,48 = DigitalInputStatus(4), DigitalOutputStatus(2)
  // field 49 = FrameNumber
  // field 50 = Checksum (optional)
  const digitalInput  = (parts[47] || '0000').trim();
  const digitalOutput = (parts[48] || '00').trim();
  const frameNo       = (parts[49] || '0').trim();

  const lat        = convertCoords(rawLat, latDir);
  const lng        = convertCoords(rawLng, lngDir);
  const deviceTime = parseV2Time(dateStr, timeStr);
  const isLive     = packetStatus === 'L';

  // Determine alert info from AlertID field
  const alertConfig = ALERT_MAP[alertIdRaw] || ALERT_MAP[String(parseInt(alertIdRaw, 10))] || null;

  // Compute internal battery as percentage (4.2V = 100%, 3.0V = 0%)
  const internalBattFloat = parseFloat(internalBatt) || 0;
  const batteryPercent    = Math.min(100, Math.max(0, Math.round(((internalBattFloat - 3.0) / 1.2) * 100)));

  return {
    packetType:      'AIS140V2_GENERAL',
    subType:         header === '200' ? 'HISTORY' : 'NORMAL',
    imei,
    vehicleRegNo,
    firmwareVer,
    vendorId,
    pktTypeCode,
    pktTypeText:     PACKET_TYPE_MAP[pktTypeCode] || pktTypeCode,
    alertId:         alertIdRaw,
    alertText:       alertConfig ? alertConfig.text : null,
    alertType:       alertConfig ? alertConfig.type : null,
    gpsValid:        gpsFix === '1' ? 'A' : 'V',
    lat,
    lng,
    speed:           parseFloat(speed) || 0,
    direction:       parseFloat(heading) || 0,
    satellites:      parseInt(satellites) || 0,
    altitude:        parseFloat(altitude) || 0,
    pdop:            parseFloat(pdop) || 0,
    hdop:            parseFloat(hdop) || 0,
    networkOperator: networkOp,
    ignition:        ignition === '1',
    mainsPower:      mainsPower === '1',
    voltage:         parseFloat(mainsVoltage) || 0,
    internalBattery: internalBattFloat,
    battery:         batteryPercent,
    sos:             sos === '1',
    gsmSignal:       parseInt(gsmSignal) || 0,
    mcc,
    mnc,
    lac,
    cellId,
    digitalInput,
    digitalOutput,
    frameNo:         parseInt(frameNo) || 0,
    odometer:        0,      // V2 general packet does not carry odometer
    din2:            false,
    din3:            false,
    engineHours:     0,
    ain:             0,
    fuel:            0,
    isLive,
    deviceTime,
    rawPacket:       raw,
  };
}

// ============================================================
// 3. HEALTH DATA PACKET
// Format:  $,101,VendorID,Firmware,IMEI,BattPct,LowBattThr,MemPct,
//          IgnInterval,NormalInterval,DigIOStatus,Analog1,Analog2,*
// Example: $,101,APM,1.0.9,869247046143589,100,30,0,10,60,1000,0.4,0.4,*
// ============================================================
function parseAis140V2HealthPacket(raw) {
  const cleaned = cleanPacket(raw);
  const parts   = cleaned.split(',');

  // parts[0]='$'  parts[1]='101'
  const vendorId          = (parts[2] || '').trim();
  const firmwareVer       = (parts[3] || '').trim();
  const imei              = (parts[4] || '').trim();
  const batteryPercent    = parseInt(parts[5]) || 0;
  const lowBattThreshold  = parseInt(parts[6]) || 0;
  const memoryPercent     = parseInt(parts[7]) || 0;
  const ignitionInterval  = parseInt(parts[8]) || 0;   // seconds when IGN ON
  const normalInterval    = parseInt(parts[9]) || 0;   // seconds when IGN OFF
  const digitalIOStatus   = (parts[10] || '').trim();
  const analog1           = parseFloat(parts[11]) || 0;
  const analog2           = parseFloat(parts[12]) || 0;

  return {
    packetType:      'AIS140V2_HEALTH',
    imei,
    vendorId,
    firmwareVer,
    batteryPercent,
    lowBattThreshold,
    memoryPercent,
    ignitionInterval,
    normalInterval,
    digitalIOStatus,
    analog1,
    analog2,
    rawPacket: raw,
  };
}

// ============================================================
// 4. EMERGENCY ALERT (EPB) PACKET
// Format:  $,EPB,EMR/SEM,IMEI,NM/SP,DDMMYYYYHHMMSS,A/V,Lat,LatDir,Lng,LngDir,
//          Altitude,Distance,Speed,Provider,VehicleNo,EMGReplyNo,*,Checksum
// Example: $,EPB,EMR,867459044086320,NM,28092019095458,A,28.651663,N,77.092813,E,
//          154.4,0.0,152.42,G,TA1AAC1122,0,*,0085
// ============================================================
function parseAis140V2EmergencyPacket(raw) {
  // The spec shows the checksum AFTER the '*', so clean differently:
  // Strip from '*' onward for field parsing
  const cleaned = cleanPacket(raw);
  const parts   = cleaned.split(',');

  // parts[0]='$'  parts[1]='EPB'  parts[2]='EMR'|'SEM'
  const msgType     = (parts[2] || '').trim();   // EMR = SOS ON, SEM = SOS OFF
  const imei        = (parts[3] || '').trim();
  const pktStatus   = (parts[4] || 'NM').trim(); // NM = normal, SP = stored
  const dateTimeStr = (parts[5] || '').trim();   // DDMMYYYYHHMMSS
  const gpsFix      = (parts[6] || 'V').trim();  // A or V
  const rawLat      = (parts[7] || '0').trim();
  const latDir      = (parts[8] || 'N').trim();
  const rawLng      = (parts[9] || '0').trim();
  const lngDir      = (parts[10] || 'E').trim();
  const altitude    = (parts[11] || '0').trim();
  const distance    = (parts[12] || '0').trim();
  const speed       = (parts[13] || '0').trim();
  const provider    = (parts[14] || 'G').trim(); // G = GPS, N = Network
  const vehicleNo   = (parts[15] || '').trim();
  const emgReplyNo  = (parts[16] || '0').trim();

  const lat        = convertCoords(rawLat, latDir);
  const lng        = convertCoords(rawLng, lngDir);
  const deviceTime = parseMergedTime(dateTimeStr);
  const isLive     = pktStatus === 'NM';

  const isSosOn    = msgType === 'EMR';
  const alertText  = isSosOn ? 'Emergency Message (SOS Pressed)' : 'Stop Message (Emergency Ended)';

  return {
    packetType:   'AIS140V2_EMERGENCY',
    imei,
    vehicleRegNo: vehicleNo,
    gpsValid:     gpsFix,
    lat,
    lng,
    altitude:     parseFloat(altitude) || 0,
    distance:     parseFloat(distance) || 0,
    speed:        parseFloat(speed) || 0,
    provider,
    emgReplyNo:   parseInt(emgReplyNo) || 0,
    msgType,
    alertText,
    alertType:    'sos',
    ignition:     true,    // Emergency typically has ignition active
    odometer:     0,
    direction:    0,
    satellites:   8,
    gsmSignal:    31,
    battery:      100,
    voltage:      12.0,
    din2:         false,
    din3:         false,
    engineHours:  0,
    ain:          0,
    fuel:         0,
    isLive,
    deviceTime,
    rawPacket:    raw,
  };
}

// ============================================================
// 5. DIAGNOSIS PACKET
// Format:  $,500,IMEI,ICCID,Date,Time,Flash,AccGyro,AdditionalData1,AdditionalData2,*
// Example: $,500,869247045236301,89910473121803853296,23112020,153408,0,0,1131,,*
// ============================================================
function parseAis140V2DiagnosisPacket(raw) {
  const cleaned = cleanPacket(raw);
  const parts   = cleaned.split(',');

  const imei            = (parts[2] || '').trim();
  const iccid           = (parts[3] || '').trim();
  const dateStr         = (parts[4] || '').trim();
  const timeStr         = (parts[5] || '').trim();
  const flashValue      = (parts[6] || '0').trim();
  const accGyroValue    = (parts[7] || '0').trim();
  const additionalData1 = (parts[8] || '').trim();
  const additionalData2 = (parts[9] || '').trim();

  return {
    packetType:     'AIS140V2_DIAGNOSIS',
    imei,
    iccid,
    flashValue:     parseInt(flashValue) || 0,
    accGyroValue:   parseInt(accGyroValue) || 0,
    additionalData1,
    additionalData2,
    deviceTime:     parseV2Time(dateStr, timeStr),
    rawPacket:      raw,
  };
}

// ============================================================
// 6. OTA PARAMETER CHANGE PACKET
// Format:  $,PC,12,IMEI,Mode,MobileNo/IP,Date,Time,ParameterChangeString,*
// Example: $,PC,12,869247046143589,0,+918939112162,17022020,113930,SETREPORT,*
// ============================================================
function parseAis140V2OtaPacket(raw) {
  const cleaned = cleanPacket(raw);
  const parts   = cleaned.split(',');

  // parts[0]='$'  parts[1]='PC'  parts[2]='12'
  const imei       = (parts[3] || '').trim();
  const mode       = (parts[4] || '0').trim();  // 0=SMS, 1=Server
  const sender     = (parts[5] || '').trim();   // mobile no or IP
  const dateStr    = (parts[6] || '').trim();
  const timeStr    = (parts[7] || '').trim();
  const paramStr   = parts.slice(8).join(',').trim(); // could be multi-field

  return {
    packetType:  'AIS140V2_OTA_CHANGE',
    imei,
    mode:        mode === '1' ? 'SERVER' : 'SMS',
    sender,
    paramStr,
    alertText:   `OTA Parameter Change: ${paramStr}`,
    alertType:   'general',
    deviceTime:  parseV2Time(dateStr, timeStr),
    rawPacket:   raw,
  };
}

// ============================================================
// 7. ACTIVATION RESPONSE / HEALTH CHECK RESPONSE
// Format (ACTVR):
//   ACTVR,RandomCode,VendorID,Firmware,IMEI,AlertID,Lat,LatDir,Lng,LngDir,
//   GPSFix,DateAndTime,Heading,Speed,GSMStrength,MCC,MNC,LAC,MainPower,
//   IGNStatus,BattVoltage,FrameNumber,VehicleMode
// Example:
//   ACTVR,654343,APM,1.0.9,864376047795371,17,28.651387,N,77.092746,E,1,23092019
//   053004,0.0,0.0,22,404,04,00F1,1,0,4.0,000007,NR
// ============================================================
function parseAis140V2ActivationPacket(raw) {
  // No leading '$' — direct comma-delimited
  const parts     = raw.trim().split(',');
  const header    = (parts[0] || '').trim(); // ACTVR or HCHKR
  const randCode  = (parts[1] || '').trim();
  const vendorId  = (parts[2] || '').trim();
  const firmwareVer = (parts[3] || '').trim();
  const imei      = (parts[4] || '').trim();
  const alertId   = (parts[5] || '').trim();
  const rawLat    = (parts[6] || '0').trim();
  const latDir    = (parts[7] || 'N').trim();
  const rawLng    = (parts[8] || '0').trim();
  const lngDir    = (parts[9] || 'E').trim();
  const gpsFix    = (parts[10] || '0').trim();

  // DateTime is split across two comma-separated tokens in the example:
  // "23092019 053004" → but the doc shows it as one field of 15 chars
  // Handle both: if parts[11] contains space, merge; otherwise use as-is
  let dateTimeStr = (parts[11] || '').trim();
  if (dateTimeStr.includes(' ')) {
    const [datePart, timePart] = dateTimeStr.split(' ');
    dateTimeStr = datePart + timePart;
  }

  const heading     = parseFloat(parts[12]) || 0;
  const speed       = parseFloat(parts[13]) || 0;
  const gsmStrength = parseInt(parts[14]) || 0;
  const mcc         = (parts[15] || '').trim();
  const mnc         = (parts[16] || '').trim();
  const lac         = (parts[17] || '').trim();
  const mainPower   = (parts[18] || '0').trim();
  const ignStatus   = (parts[19] || '0').trim();
  const battVoltage = parseFloat(parts[20]) || 0;
  const frameNo     = (parts[21] || '0').trim();
  const vehicleMode = (parts[22] || 'NR').trim();

  const lat        = convertCoords(rawLat, latDir);
  const lng        = convertCoords(rawLng, lngDir);
  // Parse merged 15-char datetime: DDMMYYYYHHMMSS (no space)
  const deviceTime = dateTimeStr.length >= 14
    ? parseMergedTime(dateTimeStr)
    : new Date().toISOString();

  const alertConfig = ALERT_MAP[alertId] || { type: 'general', text: `Alert ${alertId}` };

  return {
    packetType:    header === 'HCHKR' ? 'AIS140V2_HEALTH_CHECK' : 'AIS140V2_ACTIVATION',
    imei,
    vendorId,
    firmwareVer,
    randCode,
    gpsValid:      gpsFix === '1' ? 'A' : 'V',
    lat,
    lng,
    heading,
    speed,
    gsmSignal:     gsmStrength,
    mcc,
    mnc,
    lac,
    mainPower:     mainPower === '1',
    ignition:      ignStatus === '1',
    battVoltage,
    frameNo:       parseInt(frameNo) || 0,
    vehicleMode,
    alertId,
    alertText:     alertConfig.text,
    alertType:     alertConfig.type,
    deviceTime,
    rawPacket:     raw,
  };
}

// ============================================================
// MAIN ROUTER — called by index.js
// ============================================================

/**
 * Detect if a packet looks like an AIS140 V2 LOGIN packet
 * (dollar-sign-delimited, no comma at position 2).
 * Heuristic: raw starts with '$' and second '$' appears before any ','
 */
function isV2LoginPacket(raw) {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('$')) return false;
  const secondDollar = trimmed.indexOf('$', 1);
  const firstComma   = trimmed.indexOf(',');
  // Login uses '$' as separator — the second '$' should appear before the first ','
  return secondDollar !== -1 && (firstComma === -1 || secondDollar < firstComma);
}

/**
 * Parse any AIS140 V2 raw packet and return a structured object.
 * Returns null if the packet cannot be identified.
 */
function parseAis140V2Packet(raw) {
  const trimmed = raw.trim();

  // --- ACTVR / HCHKR (no leading '$') ---
  if (trimmed.startsWith('ACTVR') || trimmed.startsWith('HCHKR')) {
    return parseAis140V2ActivationPacket(trimmed);
  }

  // --- All other V2 packets start with '$,' ---
  if (trimmed.startsWith('$,')) {
    // Extract the second field to determine type
    const secondComma = trimmed.indexOf(',', 2);
    const typeField   = secondComma !== -1
      ? trimmed.substring(2, secondComma).trim()
      : trimmed.substring(2).trim();

    if (typeField === '10' || typeField === '200') {
      return parseAis140V2GeneralPacket(trimmed);
    }
    if (typeField === '101') {
      return parseAis140V2HealthPacket(trimmed);
    }
    if (typeField === 'EPB') {
      return parseAis140V2EmergencyPacket(trimmed);
    }
    if (typeField === 'PC') {
      return parseAis140V2OtaPacket(trimmed);
    }
    if (typeField === '500') {
      return parseAis140V2DiagnosisPacket(trimmed);
    }
  }

  // --- V2 LOGIN (dollar-delimited) ---
  if (isV2LoginPacket(trimmed)) {
    return parseAis140V2LoginPacket(trimmed);
  }

  return null; // Not a recognized V2 packet
}

module.exports = {
  parseAis140V2Packet,
  parseAis140V2LoginPacket,
  parseAis140V2GeneralPacket,
  parseAis140V2HealthPacket,
  parseAis140V2EmergencyPacket,
  parseAis140V2DiagnosisPacket,
  parseAis140V2OtaPacket,
  parseAis140V2ActivationPacket,
  isV2LoginPacket,
};
