// ============================================================
// APMK PACKET PARSER
// Dedicated parser for APM / APMK vendor devices
// Protocol format: AIS140 V2 variant
// Supported packets:
//   - General Location: $PVT,APMK,...*
//   - Health Packet:     $HEL,APMK,...*
// ============================================================

// ---- Alert ID map (AIS140 V2 specification) ----
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
  '11': { type: 'emergency_off', text: 'Alert – Emergency State OFF' },
  '12': { type: 'general',       text: 'Alert – Over-The-Air Parameter Change' },
  '13': { type: 'harsh_driving', text: 'Alert – Harsh Braking' },
  '14': { type: 'harsh_driving', text: 'Alert – Harsh Acceleration' },
  '15': { type: 'harsh_driving', text: 'Alert – Rash Turning' },
  '16': { type: 'tamper',        text: 'Alert – Device Tampered / Wire Disconnect' },
  '17': { type: 'overspeed',     text: 'Alert – Over Speed' },
  '18': { type: 'general',       text: 'Alert – Tilt' },
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

// ---- Packet type codes (field 3) ----
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

/**
 * Convert decimal-degree lat/lng with direction character to signed decimal.
 */
function convertCoords(rawVal, direction) {
  const val = parseFloat(rawVal);
  if (isNaN(val) || val === 0) return null;
  const signed = (direction === 'S' || direction === 'W') ? -Math.abs(val) : Math.abs(val);
  return parseFloat(signed.toFixed(7));
}

/**
 * Parse AIS140 V2 date (DDMMYYYY) + time (HHMMSS) into ISO timestamp.
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
 * Strip trailing checksum and end-marker '*'
 */
function cleanPacket(raw) {
  const starIdx = raw.lastIndexOf('*');
  return starIdx !== -1 ? raw.substring(0, starIdx) : raw;
}

/**
 * Parse APMK General Packet:
 * Example:
 * $PVT,APMK,3.0.12,NR,01,L,861329082394405,UNKNOWN,1,29102026,123920,10.006953,N,77.509266,E,0.0,209.44,38,288.0,0.0,0.0,AIRTEL,0,1,25.3,4.0,0,C,20,404,94,63B8,6365,499B,63B8,20,BC20,63B8,20,0,0,0,0,0,0,0000,00,060399,3A*
 */
function parseApmkGeneralPacket(raw) {
  const cleaned = cleanPacket(raw);
  const parts   = cleaned.split(',');

  // parts[0]='$PVT'  parts[1]='APMK'
  const vendorId      = (parts[1] || 'APMK').trim();
  const firmwareVer   = (parts[2] || '').trim();
  const pktTypeCode   = (parts[3] || 'NR').trim();
  const alertIdRaw    = (parts[4] || '01').trim();
  const packetStatus  = (parts[5] || 'L').trim();  // L = Live, H = History
  const imei          = (parts[6] || '').trim();
  const vehicleRegNo  = (parts[7] || '').trim();
  const gpsFix        = (parts[8] || '0').trim();  // 1 = fixed, 0 = not fixed
  const dateStr       = (parts[9] || '').trim();   // DDMMYYYY
  const timeStr       = (parts[10] || '').trim();  // HHMMSS
  const rawLat        = (parts[11] || '0').trim();
  const latDir        = (parts[12] || 'N').trim();
  const rawLng        = (parts[13] || '0').trim();
  const lngDir        = (parts[14] || 'E').trim();
  const speed         = (parts[15] || '0').trim();
  const heading       = (parts[16] || '0').trim();
  const satellites    = (parts[17] || '0').trim();
  const altitude      = (parts[18] || '0').trim();
  const pdop          = (parts[19] || '0').trim();
  const hdop          = (parts[20] || '0').trim();
  const networkOp     = (parts[21] || '').trim();
  const ignition      = (parts[22] || '0').trim();
  const mainsPower    = (parts[23] || '0').trim();
  const mainsVoltage  = (parts[24] || '0').trim();
  const internalBatt  = (parts[25] || '0').trim();
  const sos           = (parts[26] || '0').trim();
  const gsmSignal     = (parts[27] || '0').trim();
  const mcc           = (parts[28] || '').trim();
  const mnc           = (parts[29] || '').trim();
  const lac           = (parts[30] || '').trim();
  const cellId        = (parts[31] || '').trim();

  const lat        = convertCoords(rawLat, latDir);
  const lng        = convertCoords(rawLng, lngDir);
  const deviceTime = parseV2Time(dateStr, timeStr);
  const isLive     = packetStatus !== 'H' && packetStatus !== 'A';

  const alertConfig = ALERT_MAP[alertIdRaw] || ALERT_MAP[String(parseInt(alertIdRaw, 10))] || null;

  const internalBattFloat = parseFloat(internalBatt) || 0;
  const batteryPercent    = Math.min(100, Math.max(0, Math.round(((internalBattFloat - 3.0) / 1.2) * 100))) || 100;

  const hasExternalPower = parseFloat(mainsVoltage) > 5.0 && mainsPower !== '0';
  const isIgnition       = hasExternalPower ? (ignition === '1') : false;

  console.log(`[PARSER - APMK] IMEI ${imei}: gpsFix=${gpsFix}, lat=${lat}, lng=${lng}, speed=${speed}, ign=${isIgnition}`);

  return {
    packetType:      'APMK_GENERAL',
    subType:         packetStatus === 'H' ? 'HISTORY' : 'NORMAL',
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
    ignition:        isIgnition,
    mainsPower:      hasExternalPower,
    voltage:         parseFloat(mainsVoltage) || 0,
    internalBattery: internalBattFloat,
    battery:         batteryPercent,
    sos:             sos === '1',
    gsmSignal:       parseInt(gsmSignal) || 0,
    mcc,
    mnc,
    lac,
    cellId,
    digitalInput:    '0000',
    digitalOutput:   '00',
    frameNo:         0,
    odometer:        0,
    isLive,
    deviceTime,
    rawPacket:       raw,
  };
}

/**
 * Parse APMK Health Packet:
 * Example:
 * $HEL,APMK,3.0.12,861329082394405,92,20,0,10,120,0000,01*
 */
function parseApmkHealthPacket(raw) {
  const cleaned = cleanPacket(raw);
  const parts   = cleaned.split(',');

  // Extract IMEI (14-16 digit number)
  const imei = parts.find(p => /^\d{14,16}$/.test(p.trim())) || (parts[3] || '').trim();
  const vendorId = (parts[1] || 'APMK').trim();
  const firmwareVer = (parts[2] || '').trim();

  // Try extracting datetime if present in packet
  const dateStr = (parts[9] || '').trim();
  const timeStr = (parts[10] || '').trim();
  const deviceTime = (dateStr && timeStr) ? parseV2Time(dateStr, timeStr) : new Date().toISOString();

  return {
    packetType:     'APMK_HEALTH',
    imei,
    vendorId,
    firmwareVer,
    batteryPercent: 100,
    rawPacket:      raw,
    deviceTime,
  };
}

module.exports = {
  parseApmkGeneralPacket,
  parseApmkHealthPacket,
};
