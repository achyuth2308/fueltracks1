// ============================================================
// VOLTYFUEL / TRANSYNC NAV 140 PROTOCOL PARSER
// Binary AIS-140 protocol: frames delimited by 3A3A (data) / 2A2A (command) and 2323 (stop)
// Specification: TranSync NAV 140 Quick Developer Guide v1.3
// ============================================================

'use strict';

const START_DATA = Buffer.from([0x3A, 0x3A]); // '::' Data frame start
const START_CMD  = Buffer.from([0x2A, 0x2A]); // '**' Command frame start
const STOP       = Buffer.from([0x23, 0x23]); // '##' Stop frame bytes

const PKT_TYPE_GPS_DATA  = 0x10;
const PKT_TYPE_GPS_ACK   = 0x11;
const PKT_TYPE_CMD_REQ   = 0x40;
const PKT_TYPE_CMD_RESP  = 0x47;

const FIXED_HEADER_LEN = 46; // fixed bytes before optional TLVs
const MIN_FRAME_BYTES  = 48; // 46 fixed + 2 stop bytes

const ALERT_MAP = {
  3:  { type: 'battery',       text: 'Disconnect from main battery' },
  4:  { type: 'battery',       text: 'Low battery' },
  5:  { type: 'battery',       text: 'Low battery removed' },
  6:  { type: 'battery',       text: 'Connect back to main battery' },
  7:  { type: 'ignition_on',   text: 'Ignition ON' },
  8:  { type: 'ignition_off',  text: 'Ignition OFF' },
  9:  { type: 'box_open',      text: 'GPS box opened' },
  10: { type: 'sos',           text: 'Emergency state ON' },
  11: { type: 'emergency_off', text: 'Emergency state OFF' },
  12: { type: 'general',       text: 'Over the air parameter change' },
  13: { type: 'harsh_driving', text: 'Harsh Braking' },
  14: { type: 'harsh_driving', text: 'Harsh Acceleration' },
  15: { type: 'harsh_driving', text: 'Rash Turning' },
  16: { type: 'tamper',        text: 'Device Tampered / Emergency wire cut' },
  17: { type: 'overspeed',     text: 'Over speed' },
  22: { type: 'tilt',          text: 'TILT' },
  23: { type: 'impact',        text: 'Impact' },
};

function imeiFromDeviceId(b8) {
  const h = b8.toString('hex');
  return h.startsWith('0') ? h.slice(1) : h;
}

function deviceIdFromImei(imei) {
  return Buffer.from('0' + String(imei).replace(/\D/g, ''), 'hex');
}

// Tolerant relay response matcher
function parseOutputResponse(text) {
  const m = /^VLT;(\d{4});GP[O0]?([12])[\s#]*(ON|OFF|0N|0FF);?(\d{15}|DEVICEIMEINUMBER)?#?$/i.exec(String(text).trim());
  return m ? { output: Number(m[2]), state: m[3].toUpperCase().replace('0', 'O') } : null;
}

// ── FRAME PARSER ─────────────────────────────────────────────

function parseVoltyFuelFrame(f) {
  if (!f || f.length < 5) return null;

  // 1. GPS DATA FRAME (3A 3A ... 23 23)
  if (f.subarray(0, 2).equals(START_DATA)) {
    if (!f.subarray(-2).equals(STOP)) return null;
    if (f.length < MIN_FRAME_BYTES) return null;
    if (f[15] !== PKT_TYPE_GPS_DATA) return null;

    const imei = imeiFromDeviceId(f.subarray(5, 13));
    const seqNum = f.readUInt16BE(13);

    const yy = f[16], mo = f[17], dd = f[18], hh = f[19], mi = f[20], ss = f[21];
    const deviceTime = new Date(Date.UTC(2000 + yy, mo - 1, dd, hh, mi, ss)).toISOString();

    const latRaw = f.readUInt32BE(22);
    const lonRaw = f.readUInt32BE(26);
    let lat = latRaw / 1800000;
    let lon = lonRaw / 1800000;

    const speedKmh = f[30];
    const course = f.readUInt16BE(31);
    const mnc = f[33];
    const cellId = f.readUInt16BE(34);

    const b3 = f[36], b2 = f[37], b1 = f[38], b0 = f[39];
    if (!(b0 & 0x02)) lat = -lat; // bit 1: 1=North, 0=South
    if (!(b0 & 0x04)) lon = -lon; // bit 2: 1=East,  0=West

    const gsmSignal  = f[40];
    const internalV  = f[41] / 10;
    const satellites = f[42];
    const hdop       = f[43];
    const adc1Mv     = f.readUInt16BE(44);

    const isHistory  = !!(b3 & 0x80);
    const isGpsFixed = !!(b0 & 0x01);
    const isIgnition = !!(b0 & 0x08);
    const isPowerOff = !!(b0 & 0x10);
    const isOutput1  = !!(b0 & 0x40);
    const isOutput2  = !!(b0 & 0x80);

    const isValidGps = isGpsFixed && lat !== 0 && lon !== 0 && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;

    // Parse TLVs starting at byte 46 up to f.length - 2
    let odometerKm = 0;
    let mainVoltage = isPowerOff ? 0 : 24.0;
    if (!isPowerOff && adc1Mv > 0) {
      mainVoltage = adc1Mv > 10000 ? Number((adc1Mv / 1000).toFixed(1)) : Number((adc1Mv / 100).toFixed(1));
    }
    let rfid = null;
    let adc2Mv = null;
    let fuelLitres = null;
    let tag06Val = null;

    let i = FIXED_HEADER_LEN;
    const end = f.length - 2;
    while (i + 1 < end) {
      const tag = f[i];
      const len = f[i + 1];
      if (i + 2 + len > end) break;
      const val = f.subarray(i + 2, i + 2 + len);
      if (tag === 0x01) {
        const odoMeters = val.readUIntBE(0, Math.min(len, 6));
        odometerKm = Number((odoMeters / 1000).toFixed(3));
      } else if (tag === 0x02) {
        // Tag 0x02: Serial / RS485 Digital Fuel Sensor / RFID
        rfid = val.toString('hex').toUpperCase();
        try {
          if (val[0] === 0x31 && len >= 5) {
            // Omnicomm RS485 frame: 31 [addr] [cmd] [temp] [level_lsb] [level_msb]
            if (val[2] === 0x06 && len >= 6) {
              fuelLitres = val.readUInt16LE(4);
            } else if (val[2] === 0x00 && len >= 5) {
              fuelLitres = val.readUInt16LE(3);
            } else {
              fuelLitres = val.readUInt16LE(len - 2);
            }
          } else if (len === 5) {
            // 5-byte format: byte 0 is sensor status/address, bytes 1-4 is level
            fuelLitres = val.readUInt32BE(1);
          } else if (len > 0 && len <= 6) {
            fuelLitres = val.readUIntBE(0, len);
          }
        } catch (e) {
          console.warn('[VOLTYFUEL-PARSER] Tag 0x02 decode error:', e.message);
        }
      } else if (tag === 0x05) {
        adc2Mv = val.readUIntBE(0, Math.min(len, 6));
        // Only update main voltage if secondary ADC reports a valid positive voltage reading
        if (adc2Mv > 0) {
          mainVoltage = Number((adc2Mv / 1000).toFixed(1));
        }
      } else if (tag === 0x06) {
        // Tag 0x06: Auxiliary sensor / frequency / secondary fuel
        tag06Val = val.readUIntBE(0, Math.min(len, 6));
      }
      i += 2 + len;
    }

    let battPct = 100;
    if (internalV > 0) {
      battPct = Math.round(Math.min(100, Math.max(0, (internalV / 4.2) * 100)));
    } else if (isPowerOff) {
      battPct = 0;
    } else {
      battPct = 95; // Default healthy backup battery when main power is connected
    }

    let alertType = null;
    let alertText = null;
    if (b2 > 0 && ALERT_MAP[b2]) {
      alertType = ALERT_MAP[b2].type;
      alertText = ALERT_MAP[b2].text;
    }

    const lacHex = f.readUInt16BE(3).toString(16).toUpperCase();
    const cellIdHex = cellId.toString(16).toUpperCase();

    return {
      packetType: 'VOLTYFUEL_NORMAL',
      imei,
      seqNum,
      gpsValid:   isValidGps ? 'A' : 'V',
      lat:        isValidGps ? Number(lat.toFixed(7)) : null,
      lng:        isValidGps ? Number(lon.toFixed(7)) : null,
      speed:      speedKmh > 2.0 ? Math.round(speedKmh) : 0,
      odometer:   odometerKm,
      direction:  course,
      satellites,
      gsmSignal,
      battery:    battPct,
      ignition:   isIgnition,
      voltage:    mainVoltage,
      fuel:       fuelLitres !== null ? fuelLitres : null,
      fuelRaw:    rfid,
      tag06:      tag06Val,
      serial:     rfid,
      serialData: rfid,
      rfid, // retained for backward compatibility
      lac:        lacHex,
      cellId:     cellIdHex,
      hdop:       hdop / 10,
      adc1Mv,
      output1:    isOutput1,
      output2:    isOutput2,
      isLive:     !isHistory,
      deviceTime,
      alertType,
      alertText,
      rawPacket:  f.toString('hex').toUpperCase()
    };
  }

  // 2. COMMAND FRAME (2A 2A ... 23 23 OR plain ASCII **... )
  if (f.subarray(0, 2).equals(START_CMD)) {
    // Check if plain ASCII response (e.g. **SETTINGS UPDATED;:)
    const rawAscii = f.toString('ascii');
    if (/^\*\*([A-Za-z0-9_\s;:,\-\.\/=#]+)$/.test(rawAscii)) {
      const cleanCmd = rawAscii.replace(/^\*\*|[#\r\n\0]+$/g, '').trim();
      return {
        packetType: 'VOLTYFUEL_CMD_RESP',
        success: true,
        command: cleanCmd,
        rawPacket: f.toString('hex').toUpperCase()
      };
    }

    if (f.length < 18) return null;
    const proto = f[15];
    const imei = imeiFromDeviceId(f.subarray(5, 13));
    const seqNum = f.readUInt16BE(13);

    if (proto === PKT_TYPE_CMD_REQ) {
      const cmdText = f.subarray(17, -2).toString('ascii');
      return {
        packetType: 'VOLTYFUEL_CMD_REQ',
        imei,
        seqNum,
        command: cmdText,
        rawPacket: f.toString('hex').toUpperCase()
      };
    } else if (proto === PKT_TYPE_CMD_RESP) {
      const isSuccess = f[16] === 1;
      const echoText = f.subarray(18, -2).toString('ascii');
      const parsedRelay = parseOutputResponse(echoText);
      return {
        packetType: 'VOLTYFUEL_CMD_RESP',
        imei,
        seqNum,
        success: isSuccess,
        command: echoText,
        relayState: parsedRelay ? parsedRelay.state : null,
        rawPacket: f.toString('hex').toUpperCase()
      };
    }
  }

  return null;
}

// ── ACK / COMMAND BUILDERS ───────────────────────────────────

function buildGpsDataAck(seqNum) {
  // Standard TranSync 8-byte GPS Data ACK: 3A 3A 05 11 [SeqH] [SeqL] 23 23
  return Buffer.from([0x3A, 0x3A, 0x05, PKT_TYPE_GPS_ACK, (seqNum >> 8) & 0xFF, seqNum & 0xFF, 0x23, 0x23]);
}

function buildCommandFrame(imei, requestId, asciiCmd) {
  const cmd = Buffer.from(String(asciiCmd).trim(), 'ascii');
  if (cmd.length > 240) throw new Error('Command string exceeds 240 bytes');
  const id = Buffer.alloc(2);
  id.writeUInt16BE(requestId & 0xFFFF);
  const body = Buffer.concat([
    Buffer.from([0, 0]),
    deviceIdFromImei(imei),
    id,
    Buffer.from([PKT_TYPE_CMD_REQ, cmd.length]),
    cmd
  ]);
  return Buffer.concat([START_CMD, Buffer.from([1 + body.length]), body, STOP]);
}

// ── TCP STREAM FRAMING ───────────────────────────────────────

function extractFrames(buffer) {
  const frames = [];
  let offset = 0;

  while (offset < buffer.length) {
    const isData = buffer[offset] === 0x3A && buffer[offset + 1] === 0x3A;
    const isCmd  = buffer[offset] === 0x2A && buffer[offset + 1] === 0x2A;

    if (!isData && !isCmd) {
      offset++;
      continue;
    }

    if (isData) {
      if (offset + MIN_FRAME_BYTES > buffer.length) break;
      let i = offset + FIXED_HEADER_LEN;
      let foundStop = false;
      while (i + 2 <= buffer.length) {
        if (buffer[i] === 0x23 && buffer[i + 1] === 0x23) {
          frames.push(buffer.subarray(offset, i + 2));
          offset = i + 2;
          foundStop = true;
          break;
        }
        if (i + 2 > buffer.length) break;
        const tlvLen = buffer[i + 1];
        i += 2 + tlvLen;
        if (i - offset > 1024) break;
      }
      if (!foundStop) {
        if (buffer.length - offset > 1024) {
          offset++;
        } else {
          break;
        }
      }
    } else if (isCmd) {
      // Check if this is an ASCII command response (e.g. **SETTINGS UPDATED;:)
      const nextByte = buffer[offset + 2];
      const isAsciiCmd = nextByte && nextByte >= 0x41 && nextByte <= 0x5A; // Starts with uppercase A-Z
      if (isAsciiCmd) {
        // Look for end delimiters: STOP (##), or newline, or ending delimiter ';' or '#'
        let endIdx = buffer.indexOf(STOP, offset + 2);
        if (endIdx === -1) {
          // Look for newline or end of buffer if length is bounded
          for (let j = offset + 2; j < Math.min(buffer.length, offset + 128); j++) {
            if (buffer[j] === 0x0A || buffer[j] === 0x0D || (j > offset + 10 && buffer[j] === 0x3A && (j + 1 === buffer.length || buffer[j + 1] === 0x3A || buffer[j + 1] === 0x2A))) {
              endIdx = j;
              break;
            }
          }
        }
        if (endIdx !== -1) {
          const sliceLen = buffer[endIdx] === 0x23 && buffer[endIdx + 1] === 0x23 ? endIdx + 2 : endIdx + 1;
          frames.push(buffer.subarray(offset, sliceLen));
          offset = sliceLen;
          continue;
        } else if (buffer.length - offset > 256) {
          offset++;
          continue;
        } else {
          break; // wait for more bytes
        }
      }

      if (offset + 18 > buffer.length) break;
      const pl = buffer[offset + 2];
      const expectedEnd = offset + 2 + pl;
      if (expectedEnd + 2 <= buffer.length && buffer[expectedEnd] === 0x23 && buffer[expectedEnd + 1] === 0x23) {
        frames.push(buffer.subarray(offset, expectedEnd + 2));
        offset = expectedEnd + 2;
      } else {
        const stopIdx = buffer.indexOf(STOP, offset + 18);
        if (stopIdx !== -1) {
          frames.push(buffer.subarray(offset, stopIdx + 2));
          offset = stopIdx + 2;
        } else if (buffer.length - offset > 1024) {
          offset++;
        } else {
          break;
        }
      }
    }
  }

  return { frames, remainder: buffer.subarray(offset) };
}

module.exports = {
  parseVoltyFuelFrame,
  buildGpsDataAck,
  buildCommandFrame,
  extractFrames,
  parseOutputResponse,
  imeiFromDeviceId,
  deviceIdFromImei,
  PKT_TYPE_GPS_DATA,
  PKT_TYPE_GPS_ACK,
  PKT_TYPE_CMD_REQ,
  PKT_TYPE_CMD_RESP,
  ALERT_MAP,
};