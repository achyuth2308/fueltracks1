// ============================================================
// CONCOX V5 / VL149 / GT800 BINARY PROTOCOL PARSER
// Concox protocol spec: binary TCP, 0x78 0x78 (normal) /
// 0x79 0x79 (extended-length) framing, CRC-ITU checksums.
// ============================================================
//
// PACKET STRUCTURE (0x78 0x78):
//   [0x78 0x78] [Length: 1 byte] [Protocol: 1 byte]
//   [Information Content: variable]
//   [Serial Number: 2 bytes] [CRC: 2 bytes] [0x0D 0x0A]
//
// PACKET STRUCTURE (0x79 0x79):
//   [0x79 0x79] [Length: 2 bytes] [Protocol: 1 byte]
//   [Information Content: variable]
//   [Serial Number: 2 bytes] [CRC: 2 bytes] [0x0D 0x0A]
//
// CRC is computed over [Length byte(s)] through [Serial Number].
//
// Protocol numbers implemented:
//   0x01 - Login
//   0x13 - Heartbeat
//   0x22 - Location (UTC)
//   0x26 - Alarm (single-fence)
//   0x27 - Alarm (multi-fence)
//   0x94 - Information Transmission (extended 0x79 0x79)
//   0x8A - Time Check (terminal→server, no response per spec)
// ============================================================

'use strict';

const { crcItu } = require('./concoxCrc');

// ------------------------------------------------------------
// Alarm type → canonical alert mapping
// Full table from Concox spec §4.1.ii
// ------------------------------------------------------------
const CONCOX_ALARM_MAP = {
  0x00: { type: 'normal',       text: 'Normal' },
  0x01: { type: 'sos',          text: 'SOS Alarm' },
  0x02: { type: 'power_cut',    text: 'Power Cut Alarm' },
  0x03: { type: 'shock',        text: 'Shock/Vibration Alarm' },
  0x04: { type: 'geofence',     text: 'Geofence Enter Alarm' },
  0x05: { type: 'geofence',     text: 'Geofence Exit Alarm' },
  0x06: { type: 'overspeed',    text: 'Overspeed Alarm' },
  0x07: { type: 'general',      text: 'Idle Alarm' },
  0x08: { type: 'general',      text: 'Fatigue Driving Alarm' },
  0x09: { type: 'tow',          text: 'Displacement/Tow Alarm' },
  0x0A: { type: 'geofence',     text: 'Entered GPS Dead Zone' },
  0x0B: { type: 'geofence',     text: 'Exited GPS Dead Zone' },
  0x0C: { type: 'general',      text: 'Arm/Disarm' },
  0x0D: { type: 'general',      text: 'Fuel Level High Alarm' },
  0x0E: { type: 'battery',      text: 'Low Battery Alarm' },
  0x0F: { type: 'battery',      text: 'Low Battery Auto-Off' },
  0x10: { type: 'box_open',     text: 'SIM Change Alarm' },
  0x11: { type: 'general',      text: 'Power Off Alarm' },
  0x12: { type: 'general',      text: 'Accident Alarm' },
  0x13: { type: 'general',      text: 'Tow Alarm (Parking)' },
  0x14: { type: 'geofence',     text: 'Geofence Alarm (Radius)' },
  0x15: { type: 'harsh_driving', text: 'Harsh Acceleration Alarm' },
  0x16: { type: 'harsh_driving', text: 'Harsh Braking Alarm' },
  0x17: { type: 'harsh_driving', text: 'Harsh Cornering Alarm' },
  0x18: { type: 'general',      text: 'RFID Alarm' },
  0x19: { type: 'general',      text: 'Temperature Alarm' },
  0x1A: { type: 'general',      text: 'Rollover Alarm' },
  0x1B: { type: 'general',      text: 'Rapid Lane Change Alarm' },
  0xFE: { type: 'ignition_on',  text: 'Ignition On (ACC On)' },
  0xFF: { type: 'ignition_off', text: 'Ignition Off (ACC Off)' },
};

// Battery voltage level enum (0x00–0x06) from heartbeat spec table
const BATTERY_LEVEL_MAP = {
  0x00: 0,    // No power (shutdown)
  0x01: 10,   // Extremely low battery
  0x02: 25,   // Very low battery
  0x03: 40,   // Low battery
  0x04: 60,   // Medium battery
  0x05: 80,   // High battery
  0x06: 100,  // Full battery
};

// GSM signal strength enum (0x00–0x04)
const GSM_SIGNAL_MAP = {
  0x00: 0,
  0x01: 25,
  0x02: 50,
  0x03: 75,
  0x04: 100,
};

// ------------------------------------------------------------
// Internal helpers
// ------------------------------------------------------------

/**
 * Decode an IMEI from 8-byte packed BCD in the Concox login packet.
 * Each byte is read as 2 BCD digits.
 * Result is 16 hex digits; drop the leading '0' → 15-digit IMEI.
 * Example: 0x01 0x23 0x45 0x67 0x89 0x12 0x34 0x56
 *        → "0123456789123456" → drop leading 0 → "123456789123456"
 * @param {Buffer} buf - 8-byte buffer
 * @returns {string} 15-digit IMEI string
 */
function decodeImei(buf) {
  let hex = '';
  for (let i = 0; i < 8; i++) {
    hex += buf[i].toString(16).padStart(2, '0');
  }
  // Drop the leading zero nibble
  return hex.startsWith('0') ? hex.slice(1) : hex;
}

/**
 * Parse the 6-byte UTC date-time block used in location/alarm packets.
 * Bytes: Year(2-digit), Month, Day, Hour, Minute, Second — each 1 byte decimal.
 * Year is offset 2000 (e.g. 0x17 = 23 → 2023).
 * @param {Buffer} buf - Buffer starting at the datetime bytes
 * @param {number} offset
 * @returns {string} ISO 8601 timestamp string
 */
function parseDateTime(buf, offset) {
  const year  = 2000 + buf[offset];
  const month = buf[offset + 1];
  const day   = buf[offset + 2];
  const hour  = buf[offset + 3];
  const min   = buf[offset + 4];
  const sec   = buf[offset + 5];

  const pad = (n) => String(n).padStart(2, '0');
  const iso = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(min)}:${pad(sec)}Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/**
 * Parse GPS satellite info byte, latitude (4 bytes), longitude (4 bytes),
 * speed (1 byte), and course/status (2 bytes) from a location or alarm packet.
 *
 * Per spec:
 *   GPS info byte: high nibble = GPS info length, low nibble = satellite count
 *   Latitude  (4 bytes): value / 1800000 = decimal degrees (unsigned)
 *   Longitude (4 bytes): value / 1800000 = decimal degrees (unsigned)
 *   Speed (1 byte): km/h, direct decimal
 *   Course/Status (2 bytes, 16-bit):
 *     Bit 15 (byte0 bit7): GPS realtime/differential flag
 *     Bit 14 (byte0 bit6): GPS has fix (0=no fix, 1=fix)  ← gpsValid
 *     Bit 13 (byte0 bit5): longitude hemisphere (0=East, 1=West)
 *     Bit 12 (byte0 bit4): latitude hemisphere (0=South, 1=North)
 *     Bits 9-0 (byte0 bits1-0 + all of byte1): course/heading 0-360°
 *
 * @param {Buffer} buf
 * @param {number} offset - byte offset pointing at the GPS info byte
 * @returns {{ satellites, lat, lng, speed, heading, gpsValid, consumed }}
 */
function parseGpsBlock(buf, offset) {
  const gpsInfoByte = buf[offset];
  const satellites  = gpsInfoByte & 0x0F;   // low nibble

  // Latitude — 4 bytes big-endian
  const rawLat = buf.readUInt32BE(offset + 1);
  // Longitude — 4 bytes big-endian
  const rawLng = buf.readUInt32BE(offset + 5);

  const speed = buf[offset + 9];

  // Course/Status — 2 bytes big-endian
  const courseHigh = buf[offset + 10];
  const courseLow  = buf[offset + 11];

  const gpsValid   = !!(courseHigh & 0x40);              // bit6 of high byte
  const isWest     = !!(courseHigh & 0x20);              // bit5
  const isNorth    = !!(courseHigh & 0x10);              // bit4
  const heading    = ((courseHigh & 0x03) << 8) | courseLow; // 10-bit course

  let lat = rawLat / 1800000;
  let lng = rawLng / 1800000;

  if (!isNorth) lat = -lat;

  // FIX: Cheap clones zero out hemisphere bits when GPS is lost, putting vehicles in the Indian Ocean.
  // If coordinates are in the Indian Ocean directly south of India, flip latitude back to North.
  if (lat < 0 && lat > -40 && lng > 65 && lng < 95) {
    lat = Math.abs(lat);
  }
  if (isWest)   lng = -lng;

  lat = parseFloat(lat.toFixed(7));
  lng = parseFloat(lng.toFixed(7));

  return {
    satellites,
    lat,
    lng,
    speed,
    heading,
    gpsValid,
    rawCourse: (courseHigh << 8) | courseLow,
    consumed: 12,   // bytes consumed: 1 (info) + 4 (lat) + 4 (lng) + 1 (speed) + 2 (course)
  };
}

/**
 * Parse terminal information byte (used in heartbeat and alarm packets).
 * Bit flags per spec:
 *   bit0 = oil/electricity (1 = cut off)
 *   bit1 = GPS tracking on/off (1 = on)
 *   bit2 = charging (1 = yes)
 *   bit3 = ACC/ignition (1 = high)
 *   bit4 = defense armed (1 = armed)
 * @param {number} byte
 * @returns {object}
 */
function parseTerminalInfo(byte) {
  return {
    oilCutOff:   !!(byte & 0x01),
    gpsTracking: !!(byte & 0x02),
    charging:    !!(byte & 0x04),
    acc:         !!(byte & 0x08),  // ACC / ignition
    armed:       !!(byte & 0x10),
  };
}

// ------------------------------------------------------------
// Protocol-number-specific sub-parsers
// ------------------------------------------------------------

/**
 * Parse Login packet (protocol 0x01)
 * Information Content: 8 bytes IMEI + 2 bytes model + 2 bytes TZ/lang
 */
function parseLogin(info, serialNumber) {
  if (info.length < 12) {
    throw new Error(`Concox Login: info too short (${info.length} bytes, expected 12)`);
  }

  const imei = decodeImei(info.slice(0, 8));
  const modelCode = info.readUInt16BE(8);
  const tzLang    = info.readUInt16BE(10);

  if (!/^\d{14,16}$/.test(imei)) {
    throw new Error(`Concox Login: invalid IMEI decoded: '${imei}'`);
  }

  return {
    packetType:  'CONCOX_LOGIN',
    imei,
    modelCode,
    tzLang,
    serialNumber,
    rawPacketType: 0x01,
  };
}

/**
 * Parse Heartbeat packet (protocol 0x13)
 * Information Content:
 *   Terminal Info: 1 byte (bit flags)
 *   Battery Voltage Level: 1 byte enum
 *   GSM Signal Strength: 1 byte enum
 *   Language/Extended Port Status: 2 bytes
 */
function parseHeartbeat(info, serialNumber, imei, rawPacketType = 0x13) {
  let termInfo, gsmLevel, langStatus, battLevel = null;

  if (rawPacketType === 0x23) {
    if (info.length < 4) {
      throw new Error(`Concox Heartbeat: info too short (${info.length} bytes, expected 4)`);
    }
    termInfo    = parseTerminalInfo(info[0]);
    gsmLevel    = info[1];
    langStatus  = info.readUInt16BE(2);
  } else {
    if (info.length < 5) {
      throw new Error(`Concox Heartbeat: info too short (${info.length} bytes, expected 5)`);
    }
    termInfo    = parseTerminalInfo(info[0]);
    battLevel   = info[1];
    gsmLevel    = info[2];
    langStatus  = info.readUInt16BE(3);
  }

  const battPercent = (battLevel !== null && BATTERY_LEVEL_MAP[battLevel] !== undefined)
    ? BATTERY_LEVEL_MAP[battLevel]
    : 50;
  const gsmStrength = GSM_SIGNAL_MAP[gsmLevel] !== undefined
    ? GSM_SIGNAL_MAP[gsmLevel]
    : 50;

  return {
    packetType:   'CONCOX_HEARTBEAT',
    imei:         imei || null,
    terminalInfo: termInfo,
    ignition:     termInfo.acc,
    battPercent,
    gsmStrength,
    langStatus,
    serialNumber,
    rawPacketType,
  };
}

/**
 * Parse Location packet (protocol 0x22)
 *
 * Field layout after protocol byte:
 *   [0]    DateTime: 6 bytes
 *   [6]    GPS Info byte: 1 byte (hi-nibble=info-len, lo-nibble=sats)
 *   [7]    Latitude: 4 bytes
 *   [11]   Longitude: 4 bytes
 *   [15]   Speed: 1 byte
 *   [16]   Course/Status: 2 bytes
 *   [18]   MCC: 2 bytes
 *   [20]   MNC: 1 byte
 *   [21]   LAC: 2 bytes
 *   [23]   Cell ID: 3 bytes
 *   [26]   ACC: 1 byte (0=low, 1=high)
 *   [27]   Data Upload Mode: 1 byte
 *   [28]   GPS Real-Time Re-upload: 1 byte (0x00=live, 0x01=buffered)
 *   [29]   Mileage: 4 bytes (absent on some "06 series" devices)
 */
function parseLocation(info, serialNumber, imei, rawPacketType = 0x22) {
  if (info.length < 29) {
    throw new Error(`Concox Location: info too short (${info.length} bytes, expected 29+)`);
  }

  const deviceTime = parseDateTime(info, 0);

  const gps = parseGpsBlock(info, 6);

  // LBS data (Cell tower info — parsed but stored as metadata only)
  const mcc    = info.readUInt16BE(18);
  const mnc    = info[20];
  const lac    = info.readUInt16BE(21);
  const cellId = (info[23] << 16) | (info[24] << 8) | info[25];

  const acc            = info[26];
  const dataUploadMode = info[27];
  const reUploadFlag   = info[28];
  const isBuffered     = reUploadFlag === 0x01;  // 0x00=live, 0x01=re-upload (historical)

  // Mileage: 4 bytes — may be absent on "06 series" devices, guard gracefully
  let odometer = null;
  if (info.length >= 33) {
    const rawMileage = info.readUInt32BE(29);
    odometer = Math.round(rawMileage / 1000);  // convert to km as integer
  }

  // Heuristic for clones (e.g. 0x8066) that never set the GPS Valid bit but send real coordinates
  let finalGpsValid = gps.gpsValid ? 'A' : 'V';
  if (finalGpsValid === 'V' && gps.lat !== 0 && gps.lng !== 0) {
    finalGpsValid = 'A';
  }

  return {
    packetType:     'CONCOX_LOCATION',
    imei:           imei || null,
    deviceTime,
    lat:            gps.lat,
    lng:            gps.lng,
    speed:          gps.speed,
    direction:      gps.heading,
    satellites:     gps.satellites,
    gpsValid:       finalGpsValid,
    rawCourse:      gps.rawCourse,
    ignition:       acc === 0x01,
    isLive:         !isBuffered,
    odometer,
    fuel:           null,       // not reported in Concox location packets
    voltage:        null,       // enriched later from 0x94 info packets if available
    battery:        null,       // unknown from location packet; heartbeat provides this
    gsmSignal:      null,
    serialNumber,
    rawPacketType,
    // Cell tower metadata (not persisted to DB columns)
    metadata: { mcc, mnc, lac, cellId, dataUploadMode, reUploadFlag },
    // TODO: Implement PBSW (server-requests-history) mode if needed in future.
    // Per spec §3.2 location packet response is not mandatory; skipping ACK.
  };
}

/**
 * Parse Alarm packets (protocol 0x26 single-fence, 0x27 multi-fence)
 *
 * Both variants share the location fields, then diverge:
 *   0x26 (single-fence):
 *     LBS block, Terminal Info, Battery, GSM, Alarm/Lang (2 bytes), Mileage (4 bytes)
 *   0x27 (multi-fence):
 *     LBS block, Terminal Info, Battery, GSM, Alarm/Lang (2 bytes), Fence No (1 byte), Mileage (1 byte)
 *
 * @param {Buffer} info - information content bytes
 * @param {number} serialNumber
 * @param {string|null} imei
 * @param {boolean} isMultiFence - true for 0x27, false for 0x26
 */
function parseAlarm(info, serialNumber, imei, isMultiFence, rawPacketType) {
  if (info.length < 26) {
    throw new Error(`Concox Alarm: info too short (${info.length} bytes, expected 26+)`);
  }

  const deviceTime = parseDateTime(info, 0);
  const gps        = parseGpsBlock(info, 6);

  // LBS block
  let pos = 18;
  const lbsLength  = info[pos];      pos += 1;
  const mcc        = info.readUInt16BE(pos); pos += 2;
  const mnc        = info[pos];              pos += 1;
  const lac        = info.readUInt16BE(pos); pos += 2;
  const cellId     = (info[pos] << 16) | (info[pos + 1] << 8) | info[pos + 2]; pos += 3;

  // Terminal info byte
  const termInfo   = parseTerminalInfo(info[pos]); pos += 1;
  const battLevel  = info[pos]; pos += 1;
  const gsmLevel   = info[pos]; pos += 1;

  // Alarm type is in the FIRST byte of the 2-byte Alarm/Language word
  const alarmCode  = info[pos]; pos += 1;
  const langByte   = info[pos]; pos += 1;  // language/reply byte, ignored

  const alarmInfo  = CONCOX_ALARM_MAP[alarmCode] || {
    type: 'general',
    text: `Unknown Alarm (0x${alarmCode.toString(16).toUpperCase()})`,
  };

  let fenceNo  = null;
  let odometer = null;

  if (isMultiFence) {
    // 0x27: Fence No (1 byte), Mileage (1 byte)
    fenceNo = info.length > pos ? info[pos] : null; pos += 1;
    if (info.length > pos) {
      odometer = Math.round(info[pos] / 1.0);  // 1-byte mileage in 0x27 (value in km, no scaling noted)
    }
  } else {
    // 0x26: Mileage (4 bytes)
    if (info.length >= pos + 4) {
      const rawMileage = info.readUInt32BE(pos);
      odometer = Math.round(rawMileage / 1000);
    }
  }

  const battPercent = BATTERY_LEVEL_MAP[battLevel] !== undefined
    ? BATTERY_LEVEL_MAP[battLevel]
    : 50;
  const gsmStrength = GSM_SIGNAL_MAP[gsmLevel] !== undefined
    ? GSM_SIGNAL_MAP[gsmLevel]
    : 50;

  // Heuristic for clones that never set the GPS Valid bit
  let finalGpsValid = gps.gpsValid ? 'A' : 'V';
  if (finalGpsValid === 'V' && gps.lat !== 0 && gps.lng !== 0) {
    finalGpsValid = 'A';
  }

  return {
    packetType:    isMultiFence ? 'CONCOX_ALARM_MULTI' : 'CONCOX_ALARM',
    imei:          imei || null,
    deviceTime,
    lat:           gps.lat,
    lng:           gps.lng,
    speed:         gps.speed,
    direction:     gps.heading,
    satellites:    gps.satellites,
    gpsValid:      finalGpsValid,
    ignition:      termInfo.acc,
    isLive:        true,       // alarm packets are always live/real-time
    odometer,
    fuel:          null,
    voltage:       null,
    battery:       battPercent,
    gsmSignal:     gsmStrength,
    alertType:     alarmInfo.type,
    alertText:     alarmInfo.text,
    alarmCode,
    fenceNo,
    serialNumber,
    rawPacketType: rawPacketType || (isMultiFence ? 0x27 : 0x26),
    metadata: { mcc, mnc, lac, cellId, lbsLength, termInfo, langByte },
  };
}

/**
 * Parse Information Transmission packet (protocol 0x94, 0x79 0x79 framing)
 *
 * Implemented sub-types:
 *   0x00 — External Voltage (2 bytes → hex/100 = volts)
 *   0x0A — ICCID (10 bytes hex digits concatenated)
 *   0x0D — Fuel sensor (ASCII payload "!AIOIL,...")
 *
 * All other sub-types are logged and skipped.
 *
 * TODO (future sub-types from spec §7.1):
 *   0x01 - Mileage statistics
 *   0x02 - Analog fuel sensor data
 *   0x03 - Temperature sensor
 *   0x04 - Blind area time
 *   0x05 - OBDII data
 *   0x06 - Driver behavior
 *   0x07 - TPMS (tire pressure)
 *   0x08 - Cargo weight
 *   0x09 - Black box data
 *   0x0B - RS232 extended data
 *   0x0C - RS485 extended data
 *   0x0E - Passenger counter
 *   0x0F - Voice data (out of scope — fleet tracking not applicable)
 *   File transfer packets — out of scope for fleet tracking
 */
function parseInfoTransmission(info, serialNumber, imei) {
  // Info transmission content: one or more TLV-style blocks
  // Each block: [Sub-type: 1 byte] [Length: 1 byte?] [Data: variable]
  // For 0x94, the spec shows sub-types where sub-type is 1 byte followed by data

  const results = [];
  let pos = 0;

  while (pos < info.length) {
    const subType = info[pos]; pos += 1;

    if (subType === 0x00) {
      // External Voltage: 2 bytes
      if (pos + 2 > info.length) break;
      const rawVolts = info.readUInt16BE(pos); pos += 2;
      const voltage  = rawVolts / 100;  // divide by 100 for volts
      results.push({ subType: 0x00, label: 'external_voltage', voltage });

    } else if (subType === 0x0A) {
      // ICCID: 10 bytes, concatenate hex digits
      if (pos + 10 > info.length) break;
      let iccid = '';
      for (let i = 0; i < 10; i++) {
        iccid += info[pos + i].toString(16).padStart(2, '0');
      }
      pos += 10;
      results.push({ subType: 0x0A, label: 'iccid', iccid });

    } else if (subType === 0x0D) {
      // Fuel sensor: ASCII payload after sub-type byte
      // Format: "!AIOIL,<tank_id>,<level>,<temp>,<status>,<checksum>"
      // Read remaining bytes as ASCII string
      const raw    = info.slice(pos).toString('ascii');
      pos          = info.length; // consumed everything

      let parsed   = null;
      const match  = raw.match(/!AIOIL,([^,]*),([^,]*),([^,]*),([^,]*)/);
      if (match) {
        parsed = {
          tankId: match[1],
          level:  parseFloat(match[2]) || null,
          temp:   parseFloat(match[3]) || null,
          status: match[4],
        };
      }
      results.push({
        subType: 0x0D,
        label:   'fuel_sensor',
        raw,
        parsed,
        sensorData: { type: 'fuel', raw, parsed },  // canonical metadata field
      });

    } else {
      // Unknown sub-type — skip rest (cannot determine length without full spec table)
      console.warn(`[CONCOX] Unknown 0x94 sub-type 0x${subType.toString(16).padStart(2, '0')} — skipping remaining info bytes`);
      break;
    }
  }

  // Extract voltage for canonical event if present
  const voltageEntry = results.find(r => r.subType === 0x00);
  const fuelEntry    = results.find(r => r.subType === 0x0D);

  return {
    packetType:    'CONCOX_INFO',
    imei:          imei || null,
    serialNumber,
    rawPacketType: 0x94,
    infoData:      results,
    // Top-level fields for easy access by caller
    voltage:       voltageEntry ? voltageEntry.voltage : null,
    iccid:         results.find(r => r.subType === 0x0A)?.iccid || null,
    sensorData:    fuelEntry ? fuelEntry.sensorData : null,
  };
}

// ------------------------------------------------------------
// ACK Builders
// ------------------------------------------------------------

/**
 * Build a Login ACK response (protocol 0x01)
 * Per spec example: 78 78 05 01 00 05 9F F8 0D 0A
 * Format: [0x78 0x78] [0x05] [0x01] [serialHi] [serialLo] [CRC 2 bytes] [0x0D 0x0A]
 *
 * @param {number} serialNumber - 16-bit serial from the login request
 * @returns {Buffer}
 */
function buildLoginAck(serialNumber) {
  // CRC is computed over [length byte through serial number]
  // i.e. over: 0x05 0x01 serialHi serialLo
  const crcInput = Buffer.from([
    0x05,
    0x01,
    (serialNumber >> 8) & 0xFF,
    serialNumber & 0xFF,
  ]);
  const crc = crcItu(crcInput);

  return Buffer.from([
    0x78, 0x78,                         // start bytes
    0x05,                               // packet length (protocol + serial + crc = 5 bytes)
    0x01,                               // protocol number
    (serialNumber >> 8) & 0xFF,         // serial high
    serialNumber & 0xFF,                // serial low
    (crc >> 8) & 0xFF,                  // CRC high
    crc & 0xFF,                         // CRC low
    0x0D, 0x0A,                         // stop bytes
  ]);
}

/**
 * Build a Heartbeat ACK response (protocol 0x13)
 * Per spec example: 78 78 05 13 01 00 E1 A0 0D 0A
 * Format: [0x78 0x78] [0x05] [0x13] [serialHi] [serialLo] [CRC 2 bytes] [0x0D 0x0A]
 *
 * @param {number} serialNumber - 16-bit serial from the heartbeat request
 * @returns {Buffer}
 */
function buildHeartbeatAck(serialNumber, protocolNumber = 0x13) {
  const crcInput = Buffer.from([
    0x05,
    protocolNumber,
    (serialNumber >> 8) & 0xFF,
    serialNumber & 0xFF,
  ]);
  const crc = crcItu(crcInput);

  return Buffer.from([
    0x78, 0x78,
    0x05,
    protocolNumber,
    (serialNumber >> 8) & 0xFF,
    serialNumber & 0xFF,
    (crc >> 8) & 0xFF,
    crc & 0xFF,
    0x0D, 0x0A,
  ]);
}

/**
 * Build an Alarm ACK response (protocol 0x26 or 0x27)
 * Per spec example: 78 78 05 26 00 1C 9D 86 0D 0A
 * Format: [0x78 0x78] [0x05] [protocolNum] [serialHi] [serialLo] [CRC 2 bytes] [0x0D 0x0A]
 *
 * @param {number} protocolNumber - 0x26 or 0x27
 * @param {number} serialNumber - 16-bit serial from the alarm packet
 * @returns {Buffer}
 */
function buildAlarmAck(protocolNumber, serialNumber) {
  const crcInput = Buffer.from([
    0x05,
    protocolNumber,
    (serialNumber >> 8) & 0xFF,
    serialNumber & 0xFF,
  ]);
  const crc = crcItu(crcInput);

  return Buffer.from([
    0x78, 0x78,
    0x05,
    protocolNumber,
    (serialNumber >> 8) & 0xFF,
    serialNumber & 0xFF,
    (crc >> 8) & 0xFF,
    crc & 0xFF,
    0x0D, 0x0A,
  ]);
}

// ------------------------------------------------------------
// Main buffer parser (frame extractor + dispatcher)
// ------------------------------------------------------------

/**
 * Parse all complete Concox frames from a binary Buffer.
 *
 * Handles both:
 *   0x78 0x78 — normal packets (1-byte length field)
 *   0x79 0x79 — extended-length packets (2-byte length field)
 *
 * CRC is verified for every frame. Invalid frames are logged and skipped.
 * Partial frames are returned in `remainder` for the next call.
 *
 * @param {Buffer} buffer - Accumulated binary data from TCP socket
 * @param {string|null} [imei] - Current session IMEI (set after login)
 * @returns {{ packets: object[], remainder: Buffer }}
 */
function parseConcoxBuffer(buffer, imei) {
  const packets   = [];
  let   pos       = 0;

  while (pos < buffer.length) {
    // Need at least 2 bytes to detect start marker
    if (pos + 2 > buffer.length) break;

    const b0 = buffer[pos];
    const b1 = buffer[pos + 1];

    // ---- Determine framing type ----
    let isExtended = false;
    if (b0 === 0x78 && b1 === 0x78) {
      isExtended = false;
    } else if (b0 === 0x79 && b1 === 0x79) {
      isExtended = true;
    } else {
      // Not a valid binary start byte.
      // Check if it's an ASCII message (common in clones for geofence/events)
      if (b0 >= 0x20 && b0 <= 0x7E) {
        // Scan forward for CRLF
        let crlfPos = -1;
        for (let i = pos; i < buffer.length - 1; i++) {
          if (buffer[i] === 0x0D && buffer[i+1] === 0x0A) {
            crlfPos = i;
            break;
          }
        }
        if (crlfPos !== -1) {
          const asciiStr = buffer.toString('ascii', pos, crlfPos);
          console.log(`[CONCOX] Interleaved ASCII Message: ${asciiStr}`);
          packets.push({
            packetType: 'CONCOX_ASCII_MESSAGE',
            rawString: asciiStr
          });
          pos = crlfPos + 2;
          continue;
        }
      }

      // Not a valid start byte and not a complete ASCII string — skip one byte and keep scanning
      // Only warn if we haven't warned too much or if it's not a common newline
      if (b0 !== 0x0A && b0 !== 0x0D) {
        console.warn(`[CONCOX] Unexpected byte 0x${b0.toString(16)} at offset ${pos}, scanning forward`);
      }
      pos++;
      continue;
    }

    // ---- Read packet length ----
    let lengthFieldSize;
    let packetLength;
    let frameSize;

    if (!isExtended) {
      // 1-byte length
      if (pos + 3 > buffer.length) break; // need at least start(2) + length(1)
      lengthFieldSize = 1;
      packetLength    = buffer[pos + 2];
      
      // For 0x78 0x78: packetLength includes protocol(1) + info(variable) + serial(2) + crc(2)
      // Total frame size: start(2) + lengthField(1) + packetLength + stop(2)
      frameSize       = 2 + lengthFieldSize + packetLength + 2;
    } else {
      // 2-byte length (big-endian)
      if (pos + 4 > buffer.length) break; // need at least start(2) + length(2)
      lengthFieldSize = 2;
      packetLength    = buffer.readUInt16BE(pos + 2);
      
      // For 0x79 0x79: packetLength includes protocol(1) + info(variable) + serial(2) + crc(2)
      // Total frame size: start(2) + lengthField(2) + packetLength + stop(2)
      frameSize       = 2 + lengthFieldSize + packetLength + 2;
    }

    if (pos + frameSize > buffer.length) {
      // Incomplete frame — wait for more data
      break;
    }

    // ---- Verify stop bytes ----
    const stopPos = pos + frameSize - 2;
    if (buffer[stopPos] !== 0x0D || buffer[stopPos + 1] !== 0x0A) {
      console.warn(`[CONCOX] Bad stop bytes at offset ${stopPos}: 0x${buffer[stopPos].toString(16)} 0x${buffer[stopPos + 1].toString(16)}, skipping frame`);
      // Resync: jump past current start bytes and scan for the next valid start marker
      let nextStart = pos + 2;
      while (nextStart < buffer.length - 1) {
        if ((buffer[nextStart] === 0x78 && buffer[nextStart + 1] === 0x78) ||
            (buffer[nextStart] === 0x79 && buffer[nextStart + 1] === 0x79)) {
          break;
        }
        nextStart++;
      }
      pos = nextStart;
      continue;
    }

    // ---- Verify CRC ----
    // CRC input: from the length byte(s) up to and including serial number
    // = lengthField + protocol + info + serialNumber
    // CRC bytes come AFTER serialNumber, BEFORE stop bytes
    // Frame layout:
    //   [start: 2] [length: 1-2] [protocol: 1] [info: variable] [serial: 2] [crc: 2] [stop: 2]
    const crcStart    = pos + 2;                       // length byte(s)
    const crcEnd      = pos + frameSize - 4;           // up to but not including CRC bytes (exclusive)
    const crcSlice    = buffer.slice(crcStart, crcEnd);
    const computedCrc = crcItu(crcSlice);

    const crcHighByte = buffer[pos + frameSize - 4];
    const crcLowByte  = buffer[pos + frameSize - 3];
    const packetCrc   = (crcHighByte << 8) | crcLowByte;

    if (computedCrc !== packetCrc) {
      console.warn(`[CONCOX] CRC mismatch: computed=0x${computedCrc.toString(16).toUpperCase()} packet=0x${packetCrc.toString(16).toUpperCase()} — discarding frame`);
      // Resync: jump to next valid start marker
      let nextStart = pos + 2;
      while (nextStart < buffer.length - 1) {
        if ((buffer[nextStart] === 0x78 && buffer[nextStart + 1] === 0x78) ||
            (buffer[nextStart] === 0x79 && buffer[nextStart + 1] === 0x79)) {
          break;
        }
        nextStart++;
      }
      pos = nextStart;
      continue;
    }

    // ---- Extract frame components ----
    const protocolNumber = buffer[pos + 2 + lengthFieldSize];

    // Info content: between protocol byte and serial number
    //   = frame[start + lengthFieldSize + 1 (protocol)] to [frame - 4 (serial+crc) - 2 (stop) + 2 (serial)]
    // More precisely:
    //   info starts at: pos + 2 (start) + lengthFieldSize + 1 (protocol)
    //   info ends at:   pos + frameSize - 2 (stop) - 2 (crc) - 2 (serial) = pos + frameSize - 6
    const infoStart = pos + 2 + lengthFieldSize + 1;
    const infoEnd   = pos + frameSize - 6;  // excludes serial, crc, stop
    const info      = buffer.slice(infoStart, infoEnd);

    // Serial number: 2 bytes before CRC
    const serialHigh   = buffer[pos + frameSize - 6];
    const serialLow    = buffer[pos + frameSize - 5];
    const serialNumber = (serialHigh << 8) | serialLow;

    const rawHex = buffer.slice(pos, pos + frameSize).toString('hex').toUpperCase();

    // ---- Dispatch to sub-parser ----
    try {
      let parsed = null;

      switch (protocolNumber) {
        case 0x01:
          parsed = parseLogin(info, serialNumber);
          break;
        case 0x13:
        case 0x23:
          parsed = parseHeartbeat(info, serialNumber, imei, protocolNumber);
          break;
        case 0x12:
        case 0x22:
          parsed = parseLocation(info, serialNumber, imei, protocolNumber);
          break;
        case 0x16:
        case 0x26:
          parsed = parseAlarm(info, serialNumber, imei, false, protocolNumber);
          break;
        case 0x27:
          parsed = parseAlarm(info, serialNumber, imei, true, protocolNumber);
          break;
        case 0x94:
          parsed = parseInfoTransmission(info, serialNumber, imei);
          break;
        case 0x8A:
          // Time Check: device asks server for current time.
          // Per spec, terminal calibrates via GPS anyway.
          // Skipping response — TODO: implement 0x8A ACK if a firmware variant requires it.
          console.log(`[CONCOX] Time Check (0x8A) from ${imei || 'unknown'} — no response sent (per spec)`);
          parsed = { packetType: 'CONCOX_TIME_CHECK', imei: imei || null, serialNumber, rawPacketType: 0x8A };
          break;
        case 0x21:
          console.log(`[CONCOX] Command Response (0x21) from ${imei || 'unknown'}`);
          parsed = { packetType: 'CONCOX_COMMAND_RESPONSE', imei: imei || null, serialNumber, rawPacketType: 0x21 };
          break;
        case 0x80:
          console.log(`[CONCOX] Online Command (0x80) from ${imei || 'unknown'}`);
          parsed = { packetType: 'CONCOX_ONLINE_COMMAND', imei: imei || null, serialNumber, rawPacketType: 0x80 };
          break;
        default:
          console.warn(`[CONCOX] Unknown protocol number 0x${protocolNumber.toString(16).toUpperCase()} — skipping`);
          parsed = null;
      }

      if (parsed) {
        parsed.rawPacket = rawHex;
        packets.push(parsed);
      }
    } catch (err) {
      console.error(`[CONCOX] Error parsing protocol 0x${protocolNumber.toString(16).toUpperCase()}:`, err.message);
    }

    pos += frameSize;
  }

  const remainder = pos < buffer.length ? buffer.slice(pos) : Buffer.alloc(0);
  return { packets, remainder };
}

module.exports = {
  parseConcoxBuffer,
  buildLoginAck,
  buildHeartbeatAck,
  buildAlarmAck,
  // Exported for testing
  decodeImei,
  parseGpsBlock,
  parseDateTime,
  parseTerminalInfo,
  crcItu,  // re-exported from concoxCrc via this module for convenience
};
