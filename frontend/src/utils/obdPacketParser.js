/**
 * B20 OBD-II GPS Tracker (JT808 / GB/T 19056) Packet Parser
 * Client-side high performance bitwise parser for OBD Telemetry Terminal.
 * 
 * Supports:
 * - 0x0200 Location & OBD Telemetry
 * - 0x0002 Heartbeat / Keep-Alive
 * - 0x0100 Terminal Registration
 * - Tag 0x01, 0x02, 0x30, 0x31, 0xE3, 0x94, 0x91
 * - Tag 0xF3 Comprehensive OBD-II Live Parameters Block
 */

/**
 * Unescape JT808 byte sequences:
 * 0x7D 0x02 -> 0x7E
 * 0x7D 0x01 -> 0x7D
 */
export function unescapeHex(hexStr) {
  if (!hexStr || typeof hexStr !== 'string') return [];
  const clean = hexStr.replace(/\s+/g, '');
  const bytes = [];
  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(parseInt(clean.substr(i, 2), 16));
  }

  const unescaped = [];
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0x7D && i + 1 < bytes.length) {
      if (bytes[i + 1] === 0x02) {
        unescaped.push(0x7E);
        i++;
      } else if (bytes[i + 1] === 0x01) {
        unescaped.push(0x7D);
        i++;
      } else {
        unescaped.push(bytes[i]);
      }
    } else {
      unescaped.push(bytes[i]);
    }
  }
  return unescaped;
}

/**
 * Helper to read big-endian numbers from byte array
 */
function readUInt16BE(arr, offset) {
  if (offset + 1 >= arr.length) return 0;
  return ((arr[offset] << 8) | arr[offset + 1]) >>> 0;
}

function readUInt32BE(arr, offset) {
  if (offset + 3 >= arr.length) return 0;
  return (
    ((arr[offset] << 24) |
      (arr[offset + 1] << 16) |
      (arr[offset + 2] << 8) |
      arr[offset + 3]) >>> 0
  );
}

function bytesToHex(arr, start, end) {
  return arr.slice(start, end).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * Parse an incoming B20 / JT808 Hex Packet into structured OBD telemetry
 * @param {string} rawHex 
 * @returns {object|null}
 */
export function parseObdPacket(rawHex) {
  if (!rawHex || typeof rawHex !== 'string') return null;
  const cleanHex = rawHex.replace(/\s+/g, '').toUpperCase();
  const unescaped = unescapeHex(cleanHex);

  if (unescaped.length < 13) return null;

  // Frame delimiters check (0x7E ... 0x7E)
  let startIdx = 0;
  if (unescaped[0] === 0x7E) startIdx = 1;

  const msgId = readUInt16BE(unescaped, startIdx);
  const bodyProps = readUInt16BE(unescaped, startIdx + 2);
  const bodyLen = bodyProps & 0x03ff;

  const terminalId = bytesToHex(unescaped, startIdx + 4, startIdx + 10);
  const seqNum = readUInt16BE(unescaped, startIdx + 10);

  const bodyStart = startIdx + 12;
  const bodyEnd = bodyStart + bodyLen;
  const body = unescaped.slice(bodyStart, bodyEnd);

  const result = {
    rawHex: cleanHex,
    msgIdHex: '0x' + msgId.toString(16).padStart(4, '0').toUpperCase(),
    msgIdNum: msgId,
    packetType: getMsgTypeName(msgId),
    terminalId,
    seqNum,
    timestamp: new Date().toISOString(),

    // Fuel metrics
    fuelRemainingL: null,
    fuelLevelPct: null,
    tripFuelL: null,
    totalFuelL: null,
    instantFuelL100km: null,
    avgFuelL100km: null,
    auxFuelL: null,
    fuelRailPressureKpa: null,

    // Engine & ECU
    engineRpm: null,
    ecuWheelSpeedKmh: null,
    throttlePct: null,
    engineLoadPct: null,
    coolantTempC: null,
    intakeAirTempC: null,
    manifoldPressureKpa: null,
    mafGps: null,

    // Power & Electrical
    batteryVoltageV: null,
    obdVoltageV: null,
    backupBatteryPct: null,
    chargingState: 'Unknown',

    // Mileage & Timers
    clusterOdometerKm: null,
    gpsOdometerKm: null,
    tripDistanceKm: null,
    totalEngineRunTimeSec: null,
    engineIdleTimeSec: null,
    continuousDriveTimeSec: null,

    // Driver Behavior & ECU Health
    dtcCount: 0,
    rapidAccelCount: 0,
    rapidDecelCount: 0,
    harshCornerCount: 0,
    vin: null,
    ecuProtocol: null,

    // Telematics & GPS
    ignition: false,
    gpsValid: false,
    lat: null,
    lng: null,
    altitudeM: null,
    gpsSpeedKmh: null,
    headingDeg: null,
    satellites: null,
    gsmSignal: null,
    deviceTimeStr: null,
  };

  // 0x0002: Heartbeat
  if (msgId === 0x0002) {
    result.packetType = 'HEARTBEAT';
    return result;
  }

  // 0x0100: Registration
  if (msgId === 0x0100) {
    result.packetType = 'REGISTRATION';
    return result;
  }

  // 0x0200: Location & OBD Telemetry
  if (msgId === 0x0200 && body.length >= 28) {
    result.packetType = 'LOCATION_OBD';

    const alarmFlag = readUInt32BE(body, 0);
    const status = readUInt32BE(body, 4);

    result.ignition = !!(status & 0x01);
    result.gpsValid = !!(status & 0x02);
    const isSouth = !!(status & 0x04);
    const isWest = !!(status & 0x08);

    let lat = readUInt32BE(body, 8) / 1000000;
    let lng = readUInt32BE(body, 12) / 1000000;
    if (isSouth) lat = -lat;
    if (isWest) lng = -lng;
    result.lat = Number(lat.toFixed(6));
    result.lng = Number(lng.toFixed(6));

    result.altitudeM = readUInt16BE(body, 16);
    result.gpsSpeedKmh = Number((readUInt16BE(body, 18) / 10).toFixed(1));
    result.headingDeg = readUInt16BE(body, 20);

    const bcdTime = body.slice(22, 28).map(b => b.toString(16).padStart(2, '0')).join('');
    if (bcdTime.length === 12) {
      result.deviceTimeStr = `20${bcdTime.slice(0, 2)}-${bcdTime.slice(2, 4)}-${bcdTime.slice(4, 6)} ${bcdTime.slice(6, 8)}:${bcdTime.slice(8, 10)}:${bcdTime.slice(10, 12)}`;
    }

    // Extended Attributes (TLV)
    let off = 28;
    while (off + 1 < body.length) {
      const tag = body[off];
      const len = body[off + 1];
      const valStart = off + 2;
      const valEnd = valStart + len;
      if (valEnd > body.length) break;
      const val = body.slice(valStart, valEnd);

      // Tag 0x01: Total Mileage / Odometer (0.1 km)
      if (tag === 0x01 && len >= 4) {
        result.gpsOdometerKm = Number((readUInt32BE(val, 0) / 10).toFixed(2));
      }
      // Tag 0x02: Fuel Level (0.1 Litres)
      else if (tag === 0x02 && len >= 2) {
        result.auxFuelL = Number((readUInt16BE(val, 0) / 10).toFixed(1));
      }
      // Tag 0x30: GSM Signal RSSI (0-31)
      else if (tag === 0x30 && len >= 1) {
        result.gsmSignal = val[0];
      }
      // Tag 0x31: GNSS Satellites Count
      else if (tag === 0x31 && len >= 1) {
        result.satellites = val[0];
      }
      // Tag 0xE3: Voltage Block (6 bytes)
      else if (tag === 0xE3 && len >= 6) {
        // Offset 2-3 is voltage in 0.01V
        const vRaw = readUInt16BE(val, 2);
        if (vRaw > 0) {
          result.batteryVoltageV = Number((vRaw / 100).toFixed(2));
          result.chargingState = result.batteryVoltageV > 13.1 ? 'Charging (Alternator Healthy)' : 'Battery Discharging';
        }
      }
      // Tag 0x94: VIN
      else if (tag === 0x94 && len > 0) {
        result.vin = String.fromCharCode(...val).replace(/\0/g, '').trim();
      }
      // Tag 0xF3: Custom OBD-II Diagnostic Block (163 bytes)
      else if (tag === 0xF3 && len > 0) {
        parseF3SubTags(val, result);
      }
      // Tag 0x91: Standard 34-byte OBD diagnostic block
      else if (tag === 0x91 && len >= 34) {
        parse91SubTags(val, result);
      }

      off += 2 + len;
    }
  }

  return result;
}

/**
 * Parse Tag 0xF3 CAN-bus OBD sub-tags
 */
function parseF3SubTags(val, result) {
  let off = 0;
  while (off + 2 < val.length) {
    const subTag = readUInt16BE(val, off);
    const len = val[off + 2];
    const subValStart = off + 3;
    const subValEnd = subValStart + len;
    if (subValEnd > val.length) break;
    const subVal = val.slice(subValStart, subValEnd);

    switch (subTag) {
      case 0x0002: // ECU Wheel Speed (0.1 km/h)
        if (len >= 2) result.ecuWheelSpeedKmh = Number((readUInt16BE(subVal, 0) / 10).toFixed(1));
        break;

      case 0x0003: // Engine RPM (1 RPM)
        if (len >= 2) result.engineRpm = readUInt16BE(subVal, 0);
        break;

      case 0x0004: // OBD Voltage (mV)
        if (len >= 2) result.obdVoltageV = Number((readUInt16BE(subVal, 0) / 1000).toFixed(2));
        break;

      case 0x0005: // Cluster Odometer (0.1 km)
        if (len >= 4) result.clusterOdometerKm = Number((readUInt32BE(subVal, 0) / 10).toFixed(2));
        break;

      case 0x0006: // Instant Fuel Consumption (0.1 L/100km)
        if (len >= 2) result.instantFuelL100km = Number((readUInt16BE(subVal, 0) / 10).toFixed(1));
        break;

      case 0x0007: // Average Fuel Economy (0.1 L/100km)
        if (len >= 2) result.avgFuelL100km = Number((readUInt16BE(subVal, 0) / 10).toFixed(1));
        break;

      case 0x0008: // Engine Coolant Temp (°C)
        if (len >= 1) result.coolantTempC = subVal[0];
        break;

      case 0x0009: // Throttle Position (0.1%)
        if (len >= 2) result.throttlePct = Number((readUInt16BE(subVal, 0) / 10).toFixed(1));
        break;

      case 0x000B: // Engine Load (0.1%)
        if (len >= 2) result.engineLoadPct = Number((readUInt16BE(subVal, 0) / 10).toFixed(1));
        break;

      case 0x000C: // Intake Air Temperature (°C)
        if (len >= 2) result.intakeAirTempC = readUInt16BE(subVal, 0);
        break;

      case 0x000D: // Fuel Tank Remaining (0.01 Litres)
        if (len >= 2) result.fuelRemainingL = Number((readUInt16BE(subVal, 0) / 100).toFixed(2));
        break;

      case 0x000E: // Fuel Tank Level (%)
        if (len >= 1) result.fuelLevelPct = subVal[0];
        break;

      case 0x0100: // Intake Manifold Pressure (kPa)
        if (len >= 2) result.manifoldPressureKpa = readUInt16BE(subVal, 0);
        break;

      case 0x0101: // Trip Distance (0.1 km)
        if (len >= 4) result.tripDistanceKm = Number((readUInt32BE(subVal, 0) / 10).toFixed(2));
        break;

      case 0x0102: // Trip Fuel Consumed (0.01 Litres)
        if (len >= 2) result.tripFuelL = Number((readUInt16BE(subVal, 0) / 100).toFixed(2));
        break;

      case 0x0103: // Total Lifetime Fuel Consumed (1 Litre)
        if (len >= 4) result.totalFuelL = readUInt32BE(subVal, 0);
        break;

      case 0x0104: // Tracker Internal Backup Battery (%)
        if (len >= 2) result.backupBatteryPct = Number((readUInt16BE(subVal, 0) / 10).toFixed(1));
        break;

      case 0x010C: // Mass Air Flow (MAF, 0.01 g/s)
        if (len >= 2) result.mafGps = Number((readUInt16BE(subVal, 0) / 100).toFixed(2));
        break;

      case 0x010D: // Engine Idle Time (Seconds)
        if (len >= 2) result.engineIdleTimeSec = readUInt16BE(subVal, 0);
        break;

      case 0x010E: // Total Engine Running Time (Seconds)
        if (len >= 2) result.totalEngineRunTimeSec = readUInt16BE(subVal, 0);
        break;

      case 0x010F: // Continuous Drive Time (Seconds)
        if (len >= 2) result.continuousDriveTimeSec = readUInt16BE(subVal, 0);
        break;

      case 0x0110: // Fuel Rail Pressure (0.01 kPa)
        if (len >= 2) result.fuelRailPressureKpa = Number((readUInt16BE(subVal, 0) / 100).toFixed(2));
        break;

      case 0x0112: // Rapid Acceleration Event Counter
        if (len >= 2) result.rapidAccelCount = readUInt16BE(subVal, 0);
        break;

      case 0x0113: // Rapid Deceleration / Harsh Braking
        if (len >= 2) result.rapidDecelCount = readUInt16BE(subVal, 0);
        break;

      case 0x0116: // Harsh Cornering
        if (len >= 2) result.harshCornerCount = readUInt16BE(subVal, 0);
        break;

      case 0x0050: // VIN Number (17 bytes)
        if (len > 0) {
          const vinStr = String.fromCharCode(...subVal).replace(/\0/g, '').trim();
          if (vinStr.length > 5) result.vin = vinStr;
        }
        break;

      case 0x0052: // MIL DTC Status
        if (len >= 4) result.dtcCount = readUInt32BE(subVal, 0) & 0xFF;
        break;

      default:
        break;
    }

    off += 3 + len;
  }
}

/**
 * Parse Tag 0x91 standard 34-byte OBD diagnostic block
 */
function parse91SubTags(val, result) {
  if (val.length < 34) return;
  result.obdVoltageV = Number((readUInt16BE(val, 0) / 10).toFixed(1));
  result.engineRpm = Math.round(readUInt16BE(val, 2) / 10);
  result.ecuWheelSpeedKmh = val[4];
  result.throttlePct = Math.round((val[5] * 100) / 255);
  result.engineLoadPct = Math.round((val[6] * 100) / 255);
  result.coolantTempC = val[7] - 40;
  result.instantFuelL100km = Number((readUInt16BE(val, 8) / 100).toFixed(2));
  result.avgFuelL100km = Number((readUInt16BE(val, 10) / 100).toFixed(2));
  result.tripDistanceKm = Number((readUInt16BE(val, 12) / 100).toFixed(2));
  result.clusterOdometerKm = Number((readUInt32BE(val, 14) / 100).toFixed(2));
  result.tripFuelL = Number((readUInt16BE(val, 18) / 100).toFixed(2));
  result.totalFuelL = Number((readUInt32BE(val, 20) / 100).toFixed(2));
  result.dtcCount = val[22];
  result.rapidAccelCount = val[23];
  result.rapidDecelCount = val[24];
  result.totalEngineRunTimeSec = readUInt16BE(val, 25);
  result.engineIdleTimeSec = readUInt16BE(val, 27);
  result.mafGps = Number((readUInt16BE(val, 29) / 100).toFixed(2));
}

function getMsgTypeName(id) {
  switch (id) {
    case 0x0100: return 'TERMINAL_REGISTRATION';
    case 0x0102: return 'TERMINAL_AUTHENTICATION';
    case 0x0002: return 'HEARTBEAT';
    case 0x0200: return 'LOCATION_OBD_TELEMETRY';
    default: return `0x${id.toString(16).padStart(4, '0').toUpperCase()}`;
  }
}
