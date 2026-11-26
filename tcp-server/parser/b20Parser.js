// ============================================================
// B20 / OBD GPS TRACKER WITH DIAGNOSTIC PROTOCOL PARSER
// Based on JT808 (GB/T 19056 / JT/T 808) standard with OBD-II extensions
// Delimited by 0x7E ... 0x7E with 0x7D byte-stuffing escape rules
// ============================================================

'use strict';

const START_STOP = 0x7E;
const ESCAPE_BYTE = 0x7D;

// Message IDs
const MSG_TERMINAL_GEN_RESP  = 0x0001; // Terminal universal response
const MSG_HEARTBEAT          = 0x0002; // Terminal shake hand / heartbeat
const MSG_REGISTER           = 0x0100; // Terminal login / registration
const MSG_AUTH               = 0x0102; // Terminal authentication request
const MSG_LOCATION           = 0x0200; // Terminal location & OBD telemetry report
const MSG_TEXT_UP            = 0x0300; // Text message from tracker

// Server Response Message IDs
const MSG_SERVER_GEN_RESP    = 0x8001; // Server universal response
const MSG_REGISTER_RESP      = 0x8100; // Server registration response
const MSG_TEXT_DOWN          = 0x8300; // Text message to tracker

/**
 * Restore escaped byte sequence:
 * 0x7D 0x02 -> 0x7E
 * 0x7D 0x01 -> 0x7D
 */
function unescapeBytes(buf) {
  const result = [];
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === ESCAPE_BYTE && i + 1 < buf.length) {
      if (buf[i + 1] === 0x02) {
        result.push(START_STOP);
        i++;
      } else if (buf[i + 1] === 0x01) {
        result.push(ESCAPE_BYTE);
        i++;
      } else {
        result.push(buf[i]);
      }
    } else {
      result.push(buf[i]);
    }
  }
  return Buffer.from(result);
}

/**
 * Apply escape rules when sending:
 * 0x7E -> 0x7D 0x02
 * 0x7D -> 0x7D 0x01
 */
function escapeBytes(buf) {
  const result = [];
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === START_STOP) {
      result.push(ESCAPE_BYTE, 0x02);
    } else if (buf[i] === ESCAPE_BYTE) {
      result.push(ESCAPE_BYTE, 0x01);
    } else {
      result.push(buf[i]);
    }
  }
  return Buffer.from(result);
}

/**
 * Compute XOR checksum across buffer
 */
function computeChecksum(buf) {
  let xor = 0;
  for (let i = 0; i < buf.length; i++) {
    xor ^= buf[i];
  }
  return xor;
}

/**
 * Convert 6-byte BCD buffer into terminal ID string (e.g. 01 31 82 50 61 61 -> "013182506161")
 */
function bcdToImei(b6) {
  let str = b6.toString('hex').toUpperCase();
  // Strip optional leading zero if 11 or 15 digit phone/IMEI
  if (str.startsWith('0') && str.length > 10 && !str.startsWith('00')) {
    // Keep raw string as primary identifier
  }
  return str;
}

/**
 * Encode string to 6-byte BCD buffer
 */
function imeiToBcd(idStr) {
  const clean = String(idStr).replace(/\D/g, '').padStart(12, '0').slice(-12);
  return Buffer.from(clean, 'hex');
}

/**
 * Parse 6-byte BCD Date/Time: YYMMDDhhmmss
 */
function parseBcdDate(b6) {
  try {
    const hex = b6.toString('hex');
    const yy = parseInt(hex.substring(0, 2), 10);
    const mo = parseInt(hex.substring(2, 4), 10);
    const dd = parseInt(hex.substring(4, 6), 10);
    const hh = parseInt(hex.substring(6, 8), 10);
    const mm = parseInt(hex.substring(8, 10), 10);
    const ss = parseInt(hex.substring(10, 12), 10);

    // Assume 2000-2099
    const year = 2000 + (isNaN(yy) ? 26 : yy);
    const month = Math.max(1, Math.min(12, isNaN(mo) ? 1 : mo)) - 1;
    const day = Math.max(1, Math.min(31, isNaN(dd) ? 1 : dd));
    const hours = Math.max(0, Math.min(23, isNaN(hh) ? 0 : hh));
    const mins = Math.max(0, Math.min(59, isNaN(mm) ? 0 : mm));
    const secs = Math.max(0, Math.min(59, isNaN(ss) ? 0 : ss));

    return new Date(Date.UTC(year, month, day, hours, mins, secs)).toISOString();
  } catch (e) {
    return new Date().toISOString();
  }
}

/**
 * Extract complete 0x7E ... 0x7E frames from TCP accumulation buffer
 */
function extractB20Frames(buffer) {
  const frames = [];
  let i = 0;

  while (i < buffer.length) {
    if (buffer[i] === START_STOP) {
      // Look for the next START_STOP (0x7E)
      let endIdx = -1;
      for (let j = i + 1; j < buffer.length; j++) {
        if (buffer[j] === START_STOP) {
          endIdx = j;
          break;
        }
      }

      if (endIdx !== -1) {
        // We have a bounded [i, endIdx] frame
        if (endIdx - i > 1) {
          frames.push(buffer.subarray(i, endIdx + 1));
        }
        // Advance cursor past this frame
        i = endIdx + 1;
      } else {
        // Unclosed frame reaching end of buffer
        break;
      }
    } else {
      i++;
    }
  }

  // Remainder buffer (any incomplete frame starting from i)
  const remainder = i < buffer.length ? buffer.subarray(i) : Buffer.alloc(0);

  return { frames, remainder };
}

/**
 * Parse an unescaped B20 frame
 * @param {Buffer} frame - Raw frame starting with 0x7E and ending with 0x7E
 */
function parseB20Frame(frame) {
  if (!frame || frame.length < 15) return null;
  if (frame[0] !== START_STOP || frame[frame.length - 1] !== START_STOP) return null;

  // 1. Unescape payload (excluding start and stop flags)
  const unescaped = unescapeBytes(frame.subarray(1, frame.length - 1));
  if (unescaped.length < 13) return null; // 12-byte header + 1-byte checksum

  // 2. Verify XOR checksum
  const payloadLen = unescaped.length - 1;
  const expectedCrc = unescaped[payloadLen];
  const calculatedCrc = computeChecksum(unescaped.subarray(0, payloadLen));

  if (expectedCrc !== calculatedCrc) {
    console.warn(`[B20-PARSER] Checksum mismatch: expected 0x${expectedCrc.toString(16)}, got 0x${calculatedCrc.toString(16)}`);
    return null;
  }

  // 3. Parse 12-Byte Header
  const msgId = unescaped.readUInt16BE(0);
  const msgProps = unescaped.readUInt16BE(2);
  const bodyLen = msgProps & 0x03FF;
  const imei = bcdToImei(unescaped.subarray(4, 10));
  const seqNum = unescaped.readUInt16BE(10);

  const body = unescaped.subarray(12, 12 + bodyLen);

  const parsed = {
    protocolName: 'B20',
    imei,
    seqNum,
    msgId: '0x' + msgId.toString(16).padStart(4, '0').toUpperCase(),
    msgIdNum: msgId,
    rawHex: frame.toString('hex').toUpperCase(),
    isLive: true,
  };

  // 4. Handle by Message ID
  switch (msgId) {

    // ── 0x0100: Terminal Registration ────────────────────────
    case MSG_REGISTER: {
      parsed.packetType = 'B20_REGISTER';
      if (body.length >= 29) {
        parsed.provinceId = body.readUInt16BE(0);
        parsed.cityId = body.readUInt16BE(2);
        parsed.factoryId = body.subarray(4, 9).toString('ascii').replace(/\0/g, '').trim();
        parsed.terminalType = body.subarray(9, 29).toString('ascii').replace(/\0/g, '').trim();
      }
      break;
    }

    // ── 0x0102: Terminal Authentication ──────────────────────
    case MSG_AUTH: {
      parsed.packetType = 'B20_AUTH';
      parsed.authCode = body.toString('ascii').replace(/\0/g, '').trim();
      break;
    }

    // ── 0x0002: Shake hand / Heartbeat ───────────────────────
    case MSG_HEARTBEAT: {
      parsed.packetType = 'B20_HEARTBEAT';
      parsed.isHeartbeat = true;
      parsed.deviceTime = new Date().toISOString();
      break;
    }

    // ── 0x0200: Location & OBD Telemetry ─────────────────────
    case MSG_LOCATION: {
      parsed.packetType = 'B20_LOCATION';
      if (body.length < 28) break;

      const alarmFlag = body.readUInt32BE(0);
      const status = body.readUInt32BE(4);

      const isIgnitionOn = !!(status & 0x01);
      const isGpsFixed = !!(status & 0x02);
      const isSouth = !!(status & 0x04);
      const isWest = !!(status & 0x08);

      let lat = body.readUInt32BE(8) / 1000000;
      let lng = body.readUInt32BE(12) / 1000000;
      if (isSouth) lat = -lat;
      if (isWest) lng = -lng;

      const altitude = body.readUInt16BE(16);
      const speedKmh = Number((body.readUInt16BE(18) / 10).toFixed(1));
      const direction = body.readUInt16BE(20);
      const deviceTime = parseBcdDate(body.subarray(22, 28));

      parsed.lat = lat;
      parsed.lng = lng;
      parsed.speed = speedKmh;
      parsed.direction = direction;
      parsed.altitude = altitude;
      parsed.ignition = isIgnitionOn;
      parsed.gpsValid = isGpsFixed ? 'A' : 'V';
      parsed.isGpsFixed = isGpsFixed;
      parsed.deviceTime = deviceTime;

      // Alarm definitions from Table 1
      if (alarmFlag & 0x0002) parsed.alertType = 'overspeed';
      else if (alarmFlag & 0x0004) parsed.alertType = 'fatigue_driving';
      else if (alarmFlag & 0x0080) parsed.alertType = 'low_power';
      else if (alarmFlag & 0x0100) parsed.alertType = 'tamper';
      else if (alarmFlag & 0x8000) parsed.alertType = 'motion';
      else if (alarmFlag & 0x20000000) parsed.alertType = 'crash';

      // Parse Extended TLVs (starting at offset 28 in body)
      let offset = 28;
      const end = body.length;
      const obd = {};

      while (offset + 1 < end) {
        const tag = body[offset];
        const len = body[offset + 1];
        if (offset + 2 + len > end) break;
        const val = body.subarray(offset + 2, offset + 2 + len);
        offset += 2 + len;

        // Tag 0x01: Car Meter Mileage in 0.1 KM
        if (tag === 0x01 && len >= 4) {
          parsed.odometer = Number((val.readUInt32BE(0) / 10).toFixed(2));
        }
        // Tag 0x02: Fuel Level in 0.1 Litres
        else if (tag === 0x02 && len >= 2) {
          parsed.fuel = Number((val.readUInt16BE(0) / 10).toFixed(1));
        }
        // Tag 0x30: GSM Signal Strength
        else if (tag === 0x30 && len >= 1) {
          parsed.gsmSignal = val[0];
        }
        // Tag 0x31: GNSS Satellite Quantity
        else if (tag === 0x31 && len >= 1) {
          parsed.satellites = val[0];
        }
        // Tag 0xE3: Battery Voltage (0.001V)
        else if (tag === 0xE3 && len >= 4) {
          parsed.voltage = Number((val.readUInt16BE(2) / 1000).toFixed(2));
        }
        // Tag 0x94: VIN Code
        else if (tag === 0x94 && len >= 17) {
          parsed.vin = val.toString('ascii').replace(/\0/g, '').trim();
          obd.vin = parsed.vin;
        }
        // Tag 0x91: Comprehensive OBD Diagnostic Block (34 bytes)
        else if (tag === 0x91 && len >= 34) {
          const battV = Number((val.readUInt16BE(0) / 10).toFixed(1));
          const engineRpm = Math.round(val.readUInt16BE(2) / 10);
          const obdSpd = val[4];
          const throttlePct = Math.round((val[5] * 100) / 255);
          const engineLoadPct = Math.round((val[6] * 100) / 255);
          const coolantTempC = val[7] - 40;
          const instFuelL100km = Number((val.readUInt16BE(8) / 100).toFixed(2));
          const avgFuelL100km = Number((val.readUInt16BE(10) / 100).toFixed(2));
          const tripKm = Number((val.readUInt16BE(12) / 100).toFixed(2));
          const totalMileageKm = Number((val.readUInt32BE(14) / 100).toFixed(2));
          const tripFuelL = Number((val.readUInt16BE(18) / 100).toFixed(2));
          const totalFuelL = Number((val.readUInt32BE(20) / 100).toFixed(2));
          const dtcCount = val[22];
          const rapidAcc = val[23];
          const rapidDec = val[24];
          const runTimeSec = val.readUInt16BE(25);
          const idleTimeSec = val.readUInt16BE(27);
          const maf = Number((val.readUInt16BE(29) / 100).toFixed(2));

          if (!parsed.voltage || parsed.voltage === 0) parsed.voltage = battV;
          if (!parsed.odometer || parsed.odometer === 0) parsed.odometer = totalMileageKm;
          if (parsed.fuel == null && totalFuelL > 0) parsed.fuel = totalFuelL;

          obd.batteryVoltage = battV;
          obd.engineRpm = engineRpm;
          obd.obdSpeed = obdSpd;
          obd.throttlePercent = throttlePct;
          obd.engineLoadPercent = engineLoadPct;
          obd.coolantTempCelsius = coolantTempC;
          obd.instantFuelL100km = instFuelL100km;
          obd.averageFuelL100km = avgFuelL100km;
          obd.tripDistanceKm = tripKm;
          obd.totalOdometerKm = totalMileageKm;
          obd.tripFuelLitres = tripFuelL;
          obd.totalFuelLitres = totalFuelL;
          obd.dtcCount = dtcCount;
          obd.rapidAccelerations = rapidAcc;
          obd.rapidDecelerations = rapidDec;
          obd.engineRunTimeSeconds = runTimeSec;
          obd.idleTimeSeconds = idleTimeSec;
          obd.maf = maf;
        }
      }

      parsed.obd = obd;
      break;
    }

    default:
      parsed.packetType = 'B20_OTHER';
      break;
  }

  return parsed;
}

/**
 * Build Server Universal Response (0x8001)
 * Used to ACK 0x0200 (Location), 0x0002 (Heartbeat), 0x0102 (Auth)
 *
 * @param {string} imei - 12-digit BCD device ID
 * @param {number} terminalSeq - Echoed sequence number from terminal
 * @param {number} respondMsgId - Echoed Message ID (e.g. 0x0200 or 0x0002)
 * @param {number} serverSeq - Server's own incrementing sequence counter
 * @param {number} result - 0: success, 1: failed, 2: message error
 */
function buildUniversalResponse(imei, terminalSeq, respondMsgId, serverSeq = 1, result = 0) {
  // Body: 2 bytes terminalSeq + 2 bytes respondMsgId + 1 byte result = 5 bytes
  const body = Buffer.alloc(5);
  body.writeUInt16BE(terminalSeq, 0);
  body.writeUInt16BE(respondMsgId, 2);
  body[4] = result;

  return encapsulateMessage(MSG_SERVER_GEN_RESP, imei, serverSeq, body);
}

/**
 * Build Server Registration Response (0x8100)
 * Used to ACK 0x0100 (Terminal Login)
 *
 * @param {string} imei - 12-digit BCD device ID
 * @param {number} terminalSeq - Echoed sequence number from terminal
 * @param {number} serverSeq - Server sequence counter
 * @param {number} result - 0: success, 1: already logged in, 2: no vehicle in system
 * @param {string} authCode - Authentication code string assigned to tracker
 */
function buildRegisterResponse(imei, terminalSeq, serverSeq = 1, result = 0, authCode = 'TR20261125000001') {
  const authBuf = Buffer.from(authCode, 'ascii');
  // Body: 2 bytes terminalSeq + 1 byte result + authCode string
  const body = Buffer.alloc(3 + authBuf.length);
  body.writeUInt16BE(terminalSeq, 0);
  body[2] = result;
  authBuf.copy(body, 3);

  return encapsulateMessage(MSG_REGISTER_RESP, imei, serverSeq, body);
}

/**
 * Encapsulate a complete JT808 message with header, checksum, escaping, and 0x7E delimiters
 */
function encapsulateMessage(msgId, imei, seqNum, bodyBuffer) {
  const bcd = imeiToBcd(imei);
  const bodyLen = bodyBuffer ? bodyBuffer.length : 0;

  // Unescaped frame buffer: 12-byte header + body
  const unescaped = Buffer.alloc(12 + bodyLen);
  unescaped.writeUInt16BE(msgId, 0);
  unescaped.writeUInt16BE(bodyLen, 2);
  bcd.copy(unescaped, 4);
  unescaped.writeUInt16BE(seqNum & 0xFFFF, 10);

  if (bodyLen > 0) {
    bodyBuffer.copy(unescaped, 12);
  }

  // Calculate XOR checksum across unescaped header + body
  const checksum = computeChecksum(unescaped);
  const withCrc = Buffer.concat([unescaped, Buffer.from([checksum])]);

  // Apply byte-stuffing escape
  const escaped = escapeBytes(withCrc);

  // Wrap in 0x7E delimiters
  return Buffer.concat([Buffer.from([START_STOP]), escaped, Buffer.from([START_STOP])]);
}

module.exports = {
  extractB20Frames,
  parseB20Frame,
  buildUniversalResponse,
  buildRegisterResponse,
  unescapeBytes,
  escapeBytes,
  computeChecksum,
  MSG_REGISTER,
  MSG_AUTH,
  MSG_HEARTBEAT,
  MSG_LOCATION,
  MSG_SERVER_GEN_RESP,
  MSG_REGISTER_RESP
};
