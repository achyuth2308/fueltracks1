'use strict';

// ============================================================
// PioneerX 101 2G (PN02) BINARY PROTOCOL PARSER
// Framing: 0x25 0x25
// Total length: Bytes 3-4 (inclusive of header)
// ============================================================

const PN02_ALARM_MAP = {
  0x01: { type: 'box_open',     text: 'Device Removed (Light Sensor)' },
  0x03: { type: 'sos',          text: 'SOS Alarm' },
  0x05: { type: 'general',      text: 'Start Falling' },
  0x06: { type: 'battery',      text: 'Low Battery Alarm' },
  0x07: { type: 'general',      text: 'Battery Recovered' },
  0x08: { type: 'general',      text: 'Device High Temp' },
  0x09: { type: 'general',      text: 'Vibration Start' },
  0x0A: { type: 'general',      text: 'Collision Alarm' },
  0x0E: { type: 'geofence',     text: 'Enter Geofence' },
  0x0F: { type: 'geofence',     text: 'Leave Geofence' },
  0x10: { type: 'ignition_on',  text: 'Ignition On Alarm' },
  0x11: { type: 'ignition_off', text: 'Ignition Off Alarm' },
  0x12: { type: 'general',      text: 'Idle Start Alarm' },
  0x13: { type: 'general',      text: 'Idle Stop Alarm' },
  0x14: { type: 'general',      text: 'Power On Alarm' },
  0x1A: { type: 'general',      text: 'Vibration Stop' },
  0x1B: { type: 'general',      text: 'Collision Stopped' },
  0x1D: { type: 'power_cut',    text: 'Power Off Alarm' },
  0x47: { type: 'tow',          text: 'Towing Alarm' },
};

function parseBCD(buf) {
  let str = '';
  for (let i = 0; i < buf.length; i++) {
    const hex = buf[i].toString(16).padStart(2, '0');
    str += hex;
  }
  return parseInt(str, 10);
}

function parseImei(buf) {
  let str = '';
  for (let i = 0; i < buf.length; i++) {
    str += buf[i].toString(16).padStart(2, '0');
  }
  // Remove leading '0' if it's a 15-digit IMEI padded to 16
  if (str.startsWith('0') && str.length === 16) {
    return str.substring(1);
  }
  return str;
}

function parsePn02Buffer(buffer, sessionImei = null) {
  const packets = [];
  let offset = 0;

  while (offset + 5 <= buffer.length) {
    // Find Header 0x25 0x25
    if (buffer[offset] !== 0x25 || buffer[offset + 1] !== 0x25) {
      offset++;
      continue;
    }

    const packetLength = buffer.readUInt16BE(offset + 3);

    // Wait for the full packet to arrive
    if (offset + packetLength > buffer.length) {
      break; 
    }

    const frame = buffer.slice(offset, offset + packetLength);
    offset += packetLength;

    try {
      const parsed = decodeFrame(frame, sessionImei);
      if (parsed) {
        packets.push(parsed);
      }
    } catch (err) {
      console.error('[PN02 Parser] Error decoding frame:', err.message);
    }
  }

  const remainder = buffer.slice(offset);
  return { packets, remainder };
}

function decodeFrame(frame, fallbackImei) {
  const msgType = frame[2];
  const serialNumber = frame.readUInt16BE(5);
  const imei = parseImei(frame.slice(7, 15));

  const basePacket = {
    protocol: 'PN02',
    imei: imei || fallbackImei,
    serialNumber,
    rawPacketType: msgType,
  };

  if (msgType === 0x01) {
    return { ...basePacket, packetType: 'PN02_LOGIN' };
  }
  if (msgType === 0x03) {
    return { ...basePacket, packetType: 'PN02_HEARTBEAT' };
  }
  if (msgType === 0x13 || msgType === 0x14) {
    const isAlarm = (msgType === 0x14);
    
    // Position payload starts at byte index 15.
    // Date/time is at index 52..57
    if (frame.length < 72) return { ...basePacket, packetType: 'PN02_POSITION_TRUNCATED' };

    const yy = frame[52];
    const mm = frame[53];
    const dd = frame[54];
    const hh = frame[55];
    const min = frame[56];
    const ss = frame[57];
    const timestamp = new Date(Date.UTC(2000 + yy, mm - 1, dd, hh, min, ss));

    // Coordinates (Float32LE)
    // 0xFF 0xFF 0xFF 0xFF means no GPS fix
    const altBuf = frame.slice(58, 62);
    const lngBuf = frame.slice(62, 66);
    const latBuf = frame.slice(66, 70);

    let altitude = 0, longitude = 0, latitude = 0;
    let gpsValid = true;

    if (latBuf[0] === 0xFF && latBuf[1] === 0xFF && latBuf[2] === 0xFF && latBuf[3] === 0xFF) {
      gpsValid = false;
    } else {
      altitude = altBuf.readFloatLE(0);
      longitude = lngBuf.readFloatLE(0);
      latitude = latBuf.readFloatLE(0);
    }

    const speedKmh = parseBCD(frame.slice(70, 72)) / 10.0;
    
    // Direction
    let direction = parseBCD(frame.slice(72, 74));
    if (isNaN(direction)) direction = frame.readUInt16BE(72);

    let alarmType = null;
    let alarmText = null;

    if (isAlarm && frame.length > 45) {
      const alarmCode = frame[45]; // Byte 46 is Alarm Type
      const mapped = PN02_ALARM_MAP[alarmCode];
      if (mapped) {
        alarmType = mapped.type;
        alarmText = mapped.text;
      } else {
        alarmType = 'general';
        alarmText = `Unknown Alarm (0x${alarmCode.toString(16)})`;
      }
    }

    return {
      ...basePacket,
      packetType: isAlarm ? 'PN02_ALARM' : 'PN02_POSITION',
      timestamp: isNaN(timestamp.getTime()) ? new Date() : timestamp,
      gpsValid,
      latitude,
      longitude,
      altitude,
      speed: speedKmh,
      course: direction,
      alarmType,
      alarmText
    };
  }

  return { ...basePacket, packetType: 'PN02_UNKNOWN' };
}

function buildPn02Ack(msgType, serialNumber, imeiStr) {
  // ACK format: 25 25 TT 00 0F SS SS II II II II II II II II
  const ack = Buffer.alloc(15);
  ack[0] = 0x25;
  ack[1] = 0x25;
  ack[2] = msgType;
  ack.writeUInt16BE(15, 3); // Length is always 15
  ack.writeUInt16BE(serialNumber, 5);
  
  // Pack IMEI back to 8 bytes BCD
  const paddedImei = imeiStr.padStart(16, '0');
  for (let i = 0; i < 8; i++) {
    ack[7 + i] = parseInt(paddedImei.substring(i * 2, i * 2 + 2), 16);
  }
  
  return ack;
}

module.exports = {
  parsePn02Buffer,
  buildPn02Ack
};
