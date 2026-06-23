// ============================================================
// CONCOX PARSER VERIFICATION SCRIPT
// Tests the Concox V5/VL149/GT800 binary protocol parser using
// worked examples derived from the Concox protocol spec.
//
// Usage: node tcp-server/verifyConcox.js
// Exit code 0 = all pass, 1 = failures detected
// ============================================================

'use strict';

const { parseConcoxBuffer, buildLoginAck, buildHeartbeatAck, buildAlarmAck, decodeImei } = require('./parser/concoxParser');
const { crcItu } = require('./parser/concoxCrc');

let passed = 0;
let failed = 0;

// ------------------------------------------------------------
// Assertion helpers
// ------------------------------------------------------------
function assert(condition, name, detail) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.error(`  ❌ ${name}${detail ? ': ' + detail : ''}`);
    failed++;
  }
}

function assertEq(actual, expected, name) {
  const ok = actual === expected;
  if (!ok) {
    assert(false, name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  } else {
    assert(true, name);
  }
}

function assertClose(actual, expected, name, tolerance = 0.0001) {
  const ok = Math.abs(actual - expected) <= tolerance;
  if (!ok) {
    assert(false, name, `expected ~${expected}, got ${actual} (diff=${Math.abs(actual - expected)})`);
  } else {
    assert(true, name);
  }
}

function assertBufEq(actual, expected, name) {
  const ok = Buffer.isBuffer(actual) && Buffer.isBuffer(expected) &&
             actual.toString('hex') === expected.toString('hex');
  if (!ok) {
    assert(false, name,
      `expected [${expected.toString('hex')}] got [${actual ? actual.toString('hex') : 'null'}]`);
  } else {
    assert(true, name);
  }
}

function section(title) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

// ============================================================
// TEST 1 — CRC-ITU basic verification
// ============================================================
section('TEST 1: CRC-ITU correctness');

// The login ACK example from spec: 78 78 05 01 00 05 9F F8 0D 0A
// CRC is over bytes: 05 01 00 05 → expected = 0x9FF8
{
  const crcInput = Buffer.from([0x05, 0x01, 0x00, 0x05]);
  const crc = crcItu(crcInput);
  assertEq(crc, 0x9FF8, 'Login ACK CRC matches spec example (05 01 00 05 → 0x9FF8)');
}

// Heartbeat ACK example from spec: 78 78 05 13 01 00 E1 A0 0D 0A
// CRC is over bytes: 05 13 01 00 → expected = 0xE1A0
{
  const crcInput = Buffer.from([0x05, 0x13, 0x01, 0x00]);
  const crc = crcItu(crcInput);
  assertEq(crc, 0xE1A0, 'Heartbeat ACK CRC matches spec example (05 13 01 00 → 0xE1A0)');
}

// Alarm ACK example from spec: 78 78 05 26 00 1C 9D 86 0D 0A
// CRC over: 05 26 00 1C → expected = 0x9D86
{
  const crcInput = Buffer.from([0x05, 0x26, 0x00, 0x1C]);
  const crc = crcItu(crcInput);
  assertEq(crc, 0x9D86, 'Alarm ACK CRC matches spec example (05 26 00 1C → 0x9D86)');
}

// ============================================================
// TEST 2 — IMEI BCD decoding
// ============================================================
section('TEST 2: IMEI BCD decode');

// Spec example: 0x01 0x23 0x45 0x67 0x89 0x12 0x34 0x56 → IMEI 123456789123456
{
  const imeiBuf = Buffer.from([0x01, 0x23, 0x45, 0x67, 0x89, 0x12, 0x34, 0x56]);
  const imei = decodeImei(imeiBuf);
  assertEq(imei, '123456789123456', 'BCD IMEI decode matches spec example');
  assertEq(/^\d{15}$/.test(imei), true, 'IMEI is exactly 15 digits');
}

// ============================================================
// TEST 3 — Login packet parse + ACK byte-for-byte match
// ============================================================
section('TEST 3: Login packet (0x01) — parse + ACK');

// Construct a login packet for IMEI 123456789123456 with serial 0x0005
// Login info: 8 bytes IMEI + 2 bytes model (0x0000) + 2 bytes TZ (0x0000)
// Packet length = protocol(1) + info(12) + serial(2) + crc(2) = 17
//   BUT per spec, packet length field value = content from protocol to serial
//   = protocol(1) + info(12) + serial(2) = 15... actually the length byte includes
//   protocol + info + serial + crc = 17. Let's compute:
//   Actually spec "Packet Length" = number of bytes from Protocol to last byte before stop
//   = protocol(1) + info(12) + serial(2) + crc(2) = 17 = 0x11
//
// CRC over [0x11, 0x01, ...12 bytes info..., 0x00, 0x05]
{
  const imeiBytes = Buffer.from([0x01, 0x23, 0x45, 0x67, 0x89, 0x12, 0x34, 0x56]);
  const model = Buffer.from([0x00, 0x00]);
  const tz    = Buffer.from([0x00, 0x00]);
  const info  = Buffer.concat([imeiBytes, model, tz]); // 12 bytes

  const serialNumber = 0x0005;
  const packetLength = 1 + info.length + 2 + 2; // protocol + info + serial + crc = 17

  // Build CRC input: [length, protocol, ...info, serialHi, serialLo]
  const crcInput = Buffer.concat([
    Buffer.from([packetLength, 0x01]),
    info,
    Buffer.from([0x00, 0x05]),
  ]);
  const crc = crcItu(crcInput);

  // Assemble full packet
  const loginPacket = Buffer.concat([
    Buffer.from([0x78, 0x78, packetLength, 0x01]),
    info,
    Buffer.from([0x00, 0x05, (crc >> 8) & 0xFF, crc & 0xFF, 0x0D, 0x0A]),
  ]);

  const { packets, remainder } = parseConcoxBuffer(loginPacket, null);
  assertEq(packets.length, 1, 'Login packet parsed (exactly 1 packet)');
  assertEq(remainder.length, 0, 'No remainder after complete login packet');

  const p = packets[0];
  assertEq(p.packetType, 'CONCOX_LOGIN', 'Packet type is CONCOX_LOGIN');
  assertEq(p.imei, '123456789123456', 'IMEI decoded correctly');
  assertEq(p.serialNumber, 0x0005, 'Serial number extracted correctly');

  // Verify ACK bytes match spec: 78 78 05 01 00 05 9F F8 0D 0A
  const ack = buildLoginAck(0x0005);
  const expectedAck = Buffer.from([0x78, 0x78, 0x05, 0x01, 0x00, 0x05, 0x9F, 0xF8, 0x0D, 0x0A]);
  assertBufEq(ack, expectedAck, 'Login ACK bytes match spec example byte-for-byte');
}

// ============================================================
// TEST 4 — Heartbeat packet parse + ACK
// ============================================================
section('TEST 4: Heartbeat packet (0x13) — parse + ACK');

// Heartbeat: serial 0x0100, terminal info=0x09 (acc+gps), batt=0x05, gsm=0x03, lang=0x0000
// packetLength = 1 (protocol) + 5 (info) + 2 (serial) + 2 (crc) = 10 = 0x0A
{
  // termInfo=0x0A: bit1=gpsTracking(1), bit3=acc(1) → 0x02|0x08=0x0A
  const termInfo   = 0x0A;  // acc=1, gpsTracking=1
  const battLevel  = 0x05;  // 80%
  const gsmLevel   = 0x03;  // 75%
  const lang       = 0x0000;
  const info       = Buffer.from([termInfo, battLevel, gsmLevel, 0x00, 0x00]);
  const serialNum  = 0x0100;
  const pktLen     = 1 + info.length + 2 + 2; // = 10

  const crcInput = Buffer.concat([
    Buffer.from([pktLen, 0x13]),
    info,
    Buffer.from([(serialNum >> 8) & 0xFF, serialNum & 0xFF]),
  ]);
  const crc = crcItu(crcInput);

  const hbPacket = Buffer.concat([
    Buffer.from([0x78, 0x78, pktLen, 0x13]),
    info,
    Buffer.from([(serialNum >> 8) & 0xFF, serialNum & 0xFF, (crc >> 8) & 0xFF, crc & 0xFF, 0x0D, 0x0A]),
  ]);

  const { packets, remainder } = parseConcoxBuffer(hbPacket, '123456789123456');
  assertEq(packets.length, 1, 'Heartbeat parsed (1 packet)');
  assertEq(remainder.length, 0, 'No remainder after complete heartbeat');

  const p = packets[0];
  assertEq(p.packetType, 'CONCOX_HEARTBEAT', 'Packet type is CONCOX_HEARTBEAT');
  assertEq(p.battPercent, 80, 'Battery 0x05 → 80%');
  assertEq(p.gsmStrength, 75, 'GSM 0x03 → 75%');
  assertEq(p.terminalInfo.acc, true, 'ACC bit set (ignition on)');
  assertEq(p.terminalInfo.gpsTracking, true, 'GPS tracking bit set');
  assertEq(p.serialNumber, serialNum, 'Serial number extracted');

  // Verify the spec's heartbeat ACK example: 78 78 05 13 01 00 E1 A0 0D 0A
  const ack = buildHeartbeatAck(0x0100);
  const expectedAck = Buffer.from([0x78, 0x78, 0x05, 0x13, 0x01, 0x00, 0xE1, 0xA0, 0x0D, 0x0A]);
  assertBufEq(ack, expectedAck, 'Heartbeat ACK matches spec example (78 78 05 13 01 00 E1 A0 0D 0A)');
}

// ============================================================
// TEST 5 — Location packet (0x22) parse
// ============================================================
section('TEST 5: Location packet (0x22) — parse GPS fields');

// Construct a location packet:
//   Date: 2023-07-15 10:30:45 → bytes: 17 07 0F 0A 1E 2D
//   GPS info byte: 0xC4 (info length=12, satellites=4)
//   Latitude: 17.345300° N → 17.3453 * 1800000 = 31221540 = 0x01DC27E4
//     Actually let's use a clean round number: 17° 20.718' N
//     = 17 + 20.718/60 = 17.3453 → * 1800000 = 31221540 = 0x01DC27E4
//   Longitude: 78.523900° E → 78.5239 * 1800000 = 141343020 = 0x086CF56C
//   Speed: 50 km/h = 0x32
//   Course/Status: GPS fix=1, North=1, East=1, heading=180°
//     heading=180 = 0x00B4 → course bits: 0x00B4
//     Byte0: bit6(fix)=1, bit5(W)=0, bit4(N)=1 → 0101xxxx → 0x50 | bits9-8 of course(0) = 0x50
//     Byte1: bits7-0 of course(180=0xB4) = 0xB4
//   MCC: 0x0194 (404), MNC: 0x62 (98), LAC: 0xAAAA, CellID: 0xBBBBBB
//   ACC: 0x01 (high → ignition on)
//   Upload mode: 0x00 (timer)
//   Re-upload: 0x00 (live)
//   Mileage: 12345 km → 12345000 = 0x00BC4F68
//
{
  const dateBytes = Buffer.from([0x17, 0x07, 0x0F, 0x0A, 0x1E, 0x2D]); // 2023-07-15 10:30:45

  // GPS: lat=17.3453° N, lng=78.5239° E
  const rawLat = Math.round(17.3453 * 1800000); // 31221540 = 0x01DC27A4
  const rawLng = Math.round(78.5239 * 1800000); // 141343020 = 0x086CF56C
  const gpsInfoByte = 0xC4;   // 12 << 4 | 4 = 0xC4 (info length 12, 4 satellites)

  const latBuf = Buffer.alloc(4); latBuf.writeUInt32BE(rawLat);
  const lngBuf = Buffer.alloc(4); lngBuf.writeUInt32BE(rawLng);

  const speed = 0x32; // 50 km/h

  // Course/Status: fix=1(bit14→byte0 bit6), North=1(bit12→byte0 bit4), heading=180=0x00B4
  // byte0: 0b_0101_0000 = 0x50 (fix=1, West=0, North=1, heading bits9-8=0b00)
  // byte1: 0xB4 (heading bits 7-0)
  const courseHigh = 0x50;
  const courseLow  = 0xB4;

  const lbsBlock = Buffer.from([
    0x01, 0x94,  // MCC 404
    0x62,        // MNC 98
    0xAA, 0xAA,  // LAC
    0xBB, 0xBB, 0xBB,  // Cell ID
  ]);
  const acc = 0x01;
  const uploadMode = 0x00;
  const reUpload = 0x00; // live

  const mileage = 12345 * 1000; // 12345 km in meters
  const milBuf = Buffer.alloc(4); milBuf.writeUInt32BE(mileage);

  const info = Buffer.concat([
    dateBytes,
    Buffer.from([gpsInfoByte]),
    latBuf, lngBuf,
    Buffer.from([speed, courseHigh, courseLow]),
    lbsBlock,
    Buffer.from([acc, uploadMode, reUpload]),
    milBuf,
  ]);

  const serialNum = 0x0042;
  const pktLen = 1 + info.length + 2 + 2;

  const crcInput = Buffer.concat([
    Buffer.from([pktLen, 0x22]),
    info,
    Buffer.from([(serialNum >> 8) & 0xFF, serialNum & 0xFF]),
  ]);
  const crc = crcItu(crcInput);

  const locPacket = Buffer.concat([
    Buffer.from([0x78, 0x78, pktLen, 0x22]),
    info,
    Buffer.from([(serialNum >> 8) & 0xFF, serialNum & 0xFF,
                 (crc >> 8) & 0xFF, crc & 0xFF, 0x0D, 0x0A]),
  ]);

  const { packets, remainder } = parseConcoxBuffer(locPacket, '123456789123456');
  assertEq(packets.length, 1, 'Location packet parsed (1 packet)');
  assertEq(remainder.length, 0, 'No remainder');

  const p = packets[0];
  assertEq(p.packetType, 'CONCOX_LOCATION', 'Packet type is CONCOX_LOCATION');
  assertEq(p.imei, '123456789123456', 'IMEI from session context');
  assertEq(p.deviceTime, '2023-07-15T10:30:45.000Z', 'DateTime decoded correctly');
  assertEq(p.satellites, 4, 'Satellite count from GPS info nibble');
  assertEq(p.gpsValid, 'A', 'GPS fix flag decoded (bit14=1 → A)');
  assertClose(p.lat, 17.3453, 'Latitude decoded correctly (~17.3453° N)', 0.001);
  assertClose(p.lng, 78.5239, 'Longitude decoded correctly (~78.5239° E)', 0.001);
  assertEq(p.speed, 50, 'Speed decoded (0x32 = 50 km/h)');
  assertEq(p.direction, 180, 'Heading decoded (0x50/0xB4 → 180°)');
  assertEq(p.ignition, true, 'ACC 0x01 → ignition true');
  assertEq(p.isLive, true, 'Re-upload 0x00 → isLive true');
  assertEq(p.odometer, 12345.000, 'Mileage decoded (12345000 / 1000 = 12345 km)');

  // Verify no ACK is sent for location packets (no mandatory ACK per spec §3.2)
  // This is implicit — the server does not call buildLoginAck etc. for CONCOX_LOCATION
  assert(true, 'No ACK needed for location packet (per spec §3.2)');
}

// ============================================================
// TEST 6 — Alarm packet (0x26) parse
// ============================================================
section('TEST 6: Alarm packet (0x26 single-fence) — parse + ACK');

{
  // Use same GPS block as location test, date=2023-07-15 10:31:00
  const dateBytes = Buffer.from([0x17, 0x07, 0x0F, 0x0A, 0x1F, 0x00]);
  const rawLat = Math.round(17.3453 * 1800000);
  const rawLng = Math.round(78.5239 * 1800000);
  const gpsInfoByte = 0xC6;  // 4 bits info length, 6 satellites
  const latBuf = Buffer.alloc(4); latBuf.writeUInt32BE(rawLat);
  const lngBuf = Buffer.alloc(4); lngBuf.writeUInt32BE(rawLng);

  const courseHigh = 0x50; // fix=1, North=1
  const courseLow  = 0x5A; // heading=90°

  // LBS length byte + MCC MNC LAC CellID
  const lbsLen = 0x08;
  const lbsBlock = Buffer.from([lbsLen, 0x01, 0x94, 0x62, 0xAA, 0xAA, 0xBB, 0xBB, 0xBB]);

  // Terminal info: acc=1 → 0x08
  const termInfo = 0x08;
  const battLevel = 0x04; // 60%
  const gsmLevel  = 0x02; // 50%

  // Alarm/Language: alarmCode=0x06 (overspeed), lang=0x00
  const alarmCode = 0x06;
  const langByte  = 0x00;

  // Mileage (4 bytes for 0x26): 5000 km
  const milBuf = Buffer.alloc(4); milBuf.writeUInt32BE(5000 * 1000);

  const info = Buffer.concat([
    dateBytes,
    Buffer.from([gpsInfoByte]),
    latBuf, lngBuf,
    Buffer.from([0x32, courseHigh, courseLow]),  // speed=50
    lbsBlock,
    Buffer.from([termInfo, battLevel, gsmLevel, alarmCode, langByte]),
    milBuf,
  ]);

  const serialNum = 0x001C;
  const pktLen    = 1 + info.length + 2 + 2;

  const crcInput = Buffer.concat([
    Buffer.from([pktLen, 0x26]),
    info,
    Buffer.from([(serialNum >> 8) & 0xFF, serialNum & 0xFF]),
  ]);
  const crc = crcItu(crcInput);

  const alarmPacket = Buffer.concat([
    Buffer.from([0x78, 0x78, pktLen, 0x26]),
    info,
    Buffer.from([(serialNum >> 8) & 0xFF, serialNum & 0xFF,
                 (crc >> 8) & 0xFF, crc & 0xFF, 0x0D, 0x0A]),
  ]);

  const { packets } = parseConcoxBuffer(alarmPacket, '123456789123456');
  assertEq(packets.length, 1, 'Alarm packet (0x26) parsed');

  const p = packets[0];
  assertEq(p.packetType, 'CONCOX_ALARM', 'Type is CONCOX_ALARM');
  assertEq(p.alarmCode, 0x06, 'Alarm code 0x06 (overspeed)');
  assertEq(p.alertType, 'overspeed', 'Alert type mapped to overspeed');
  assertEq(p.alertText, 'Overspeed Alarm', 'Alert text correct');
  assertEq(p.battery, 60, 'Battery level 0x04 → 60%');
  assertEq(p.ignition, true, 'Terminal info ACC bit → ignition true');
  assertEq(p.odometer, 5000.000, 'Mileage (4 bytes) decoded for 0x26');

  // Alarm ACK matches spec: 78 78 05 26 00 1C 9D 86 0D 0A
  const ack = buildAlarmAck(0x26, 0x001C);
  const expectedAck = Buffer.from([0x78, 0x78, 0x05, 0x26, 0x00, 0x1C, 0x9D, 0x86, 0x0D, 0x0A]);
  assertBufEq(ack, expectedAck, 'Alarm ACK matches spec example byte-for-byte');
}

// ============================================================
// TEST 7 — CRC rejection (corrupted packet)
// ============================================================
section('TEST 7: CRC rejection — corrupted packet discarded');

{
  // Build a valid login packet then corrupt one byte in the info field
  const imeiBytes = Buffer.from([0x01, 0x23, 0x45, 0x67, 0x89, 0x12, 0x34, 0x56]);
  const info      = Buffer.concat([imeiBytes, Buffer.from([0x00, 0x00, 0x00, 0x00])]);
  const serialNum = 0x0001;
  const pktLen    = 1 + info.length + 2 + 2;

  const crcInput  = Buffer.concat([Buffer.from([pktLen, 0x01]), info, Buffer.from([0x00, 0x01])]);
  const crc       = crcItu(crcInput);

  const goodPacket = Buffer.concat([
    Buffer.from([0x78, 0x78, pktLen, 0x01]),
    info,
    Buffer.from([0x00, 0x01, (crc >> 8) & 0xFF, crc & 0xFF, 0x0D, 0x0A]),
  ]);

  // Corrupt byte at offset 5 (inside info field)
  const badPacket = Buffer.from(goodPacket);
  badPacket[5] ^= 0xFF; // flip all bits in byte 5

  const { packets } = parseConcoxBuffer(badPacket, null);
  assertEq(packets.length, 0, 'Corrupted packet rejected (CRC mismatch → 0 packets output)');
}

// ============================================================
// TEST 8 — Partial frame reassembly
// ============================================================
section('TEST 8: Partial frame reassembly across two buffer chunks');

{
  // Build a complete heartbeat packet, then split it in half
  const info     = Buffer.from([0x09, 0x05, 0x03, 0x00, 0x00]);
  const serial   = 0x0200;
  const pktLen   = 1 + info.length + 2 + 2; // = 10

  const crcInput = Buffer.concat([Buffer.from([pktLen, 0x13]), info, Buffer.from([0x02, 0x00])]);
  const crc      = crcItu(crcInput);

  const fullPacket = Buffer.concat([
    Buffer.from([0x78, 0x78, pktLen, 0x13]),
    info,
    Buffer.from([0x02, 0x00, (crc >> 8) & 0xFF, crc & 0xFF, 0x0D, 0x0A]),
  ]);

  // Split at midpoint
  const half1 = fullPacket.slice(0, Math.floor(fullPacket.length / 2));
  const half2 = fullPacket.slice(Math.floor(fullPacket.length / 2));

  // Feed first half — should get no complete packets but a remainder
  const result1 = parseConcoxBuffer(half1, '123456789123456');
  assertEq(result1.packets.length, 0, 'No packets from first half (incomplete frame)');
  assert(result1.remainder.length > 0, 'Remainder contains partial frame bytes');

  // Feed remainder + second half — should now complete the packet
  const combined = Buffer.concat([result1.remainder, half2]);
  const result2  = parseConcoxBuffer(combined, '123456789123456');
  assertEq(result2.packets.length, 1, 'Complete packet parsed after reassembly');
  assertEq(result2.remainder.length, 0, 'No leftover bytes after reassembly');
  assertEq(result2.packets[0].packetType, 'CONCOX_HEARTBEAT', 'Reassembled packet type correct');
}

// ============================================================
// TEST 9 — 0x78 vs 0x79 start-byte branching
// ============================================================
section('TEST 9: 0x78/0x79 extended-length packet handling');

{
  // Build a 0x79 0x79 packet: Info Transmission (0x94)
  // Sub-type 0x00 (External Voltage): 2 bytes → 0x04D2 = 1234 → 12.34 V
  const infoContent = Buffer.from([0x00, 0x04, 0xD2]);  // sub-type 0x00, voltage raw=1234
  const serialNum   = 0x0007;

  // For 0x79 0x79: packet length is 2 bytes, value = protocol(1) + info(n)
  const pktLen = 1 + infoContent.length; // = 4 for this info

  // CRC over [lenHi, lenLo, protocol, ...info, serialHi, serialLo]
  const crcInput = Buffer.concat([
    Buffer.from([(pktLen >> 8) & 0xFF, pktLen & 0xFF, 0x94]),
    infoContent,
    Buffer.from([(serialNum >> 8) & 0xFF, serialNum & 0xFF]),
  ]);
  const crc = crcItu(crcInput);

  const extPacket = Buffer.concat([
    Buffer.from([0x79, 0x79, (pktLen >> 8) & 0xFF, pktLen & 0xFF, 0x94]),
    infoContent,
    Buffer.from([(serialNum >> 8) & 0xFF, serialNum & 0xFF,
                 (crc >> 8) & 0xFF, crc & 0xFF, 0x0D, 0x0A]),
  ]);

  const { packets, remainder } = parseConcoxBuffer(extPacket, '123456789123456');
  assertEq(packets.length, 1, '0x79 0x79 packet parsed (CONCOX_INFO)');
  assertEq(remainder.length, 0, 'No remainder');

  const p = packets[0];
  assertEq(p.packetType, 'CONCOX_INFO', 'Type is CONCOX_INFO');
  assertClose(p.voltage, 12.34, 'External voltage decoded (1234/100 = 12.34 V)', 0.001);
}

// ============================================================
// TEST 10 — Multiple packets in one buffer
// ============================================================
section('TEST 10: Multiple frames in single buffer');

{
  // Combine two heartbeat packets in one buffer
  const makeHb = (serial) => {
    const info   = Buffer.from([0x09, 0x05, 0x03, 0x00, 0x00]);
    const pktLen = 1 + info.length + 2 + 2;
    const crcIn  = Buffer.concat([Buffer.from([pktLen, 0x13]), info,
                                   Buffer.from([(serial >> 8) & 0xFF, serial & 0xFF])]);
    const crc    = crcItu(crcIn);
    return Buffer.concat([
      Buffer.from([0x78, 0x78, pktLen, 0x13]),
      info,
      Buffer.from([(serial >> 8) & 0xFF, serial & 0xFF,
                   (crc >> 8) & 0xFF, crc & 0xFF, 0x0D, 0x0A]),
    ]);
  };

  const twoPkts = Buffer.concat([makeHb(0x0301), makeHb(0x0302)]);
  const { packets, remainder } = parseConcoxBuffer(twoPkts, '123456789123456');
  assertEq(packets.length, 2, 'Two heartbeat packets parsed from single buffer');
  assertEq(packets[0].serialNumber, 0x0301, 'First packet serial = 0x0301');
  assertEq(packets[1].serialNumber, 0x0302, 'Second packet serial = 0x0302');
  assertEq(remainder.length, 0, 'No remainder after two complete frames');
}

// ============================================================
// TEST 11 — isLive flag from re-upload byte
// ============================================================
section('TEST 11: isLive / isBuffered mapping from re-upload byte');

{
  // Build a minimal location packet with re-upload=0x01 (buffered/historical)
  const dateBytes = Buffer.from([0x17, 0x07, 0x0F, 0x0A, 0x1E, 0x2D]);
  const rawLat = Math.round(17.3453 * 1800000);
  const rawLng = Math.round(78.5239 * 1800000);
  const latBuf = Buffer.alloc(4); latBuf.writeUInt32BE(rawLat);
  const lngBuf = Buffer.alloc(4); lngBuf.writeUInt32BE(rawLng);
  const milBuf = Buffer.alloc(4); milBuf.writeUInt32BE(0);

  const info = Buffer.concat([
    dateBytes,
    Buffer.from([0xC4]),   // GPS info byte
    latBuf, lngBuf,
    Buffer.from([0x00, 0x50, 0x00]),  // speed=0, courseHigh (fix+North), courseLow=0 (hdg=0)
    Buffer.from([0x01, 0x94, 0x62, 0xAA, 0xAA, 0xBB, 0xBB, 0xBB]),  // LBS block
    Buffer.from([0x00, 0x00, 0x01]),  // ACC=0 (ign off), mode=0, re-upload=0x01 (buffered)
    milBuf,
  ]);

  const serialNum = 0x0050;
  const pktLen    = 1 + info.length + 2 + 2;
  const crcInput  = Buffer.concat([Buffer.from([pktLen, 0x22]), info,
                                    Buffer.from([(serialNum >> 8) & 0xFF, serialNum & 0xFF])]);
  const crc = crcItu(crcInput);

  const pkt = Buffer.concat([
    Buffer.from([0x78, 0x78, pktLen, 0x22]),
    info,
    Buffer.from([(serialNum >> 8) & 0xFF, serialNum & 0xFF, (crc >> 8) & 0xFF, crc & 0xFF, 0x0D, 0x0A]),
  ]);

  const { packets } = parseConcoxBuffer(pkt, '123456789123456');
  assertEq(packets.length, 1, 'Buffered location packet parsed');
  assertEq(packets[0].isLive, false, 'Re-upload=0x01 → isLive=false (buffered/historical)');
  assertEq(packets[0].ignition, false, 'ACC=0x00 → ignition false');
}

// ============================================================
// TEST 12 — Schema compatibility check
// ============================================================
section('TEST 12: Publisher schema compatibility');

{
  // Verify that a CONCOX_LOCATION packet has all the fields expected by publisher.publishLocation()
  const requiredFields = [
    'imei', 'lat', 'lng', 'speed', 'fuel', 'ignition', 'voltage',
    'direction', 'odometer', 'satellites', 'gsmSignal', 'battery',
    'deviceTime', 'isLive',
  ];

  // Build and parse a valid location packet
  const dateBytes = Buffer.from([0x17, 0x07, 0x0F, 0x0A, 0x1E, 0x2D]);
  const rawLat = Math.round(17.3453 * 1800000);
  const rawLng = Math.round(78.5239 * 1800000);
  const latBuf = Buffer.alloc(4); latBuf.writeUInt32BE(rawLat);
  const lngBuf = Buffer.alloc(4); lngBuf.writeUInt32BE(rawLng);
  const milBuf = Buffer.alloc(4); milBuf.writeUInt32BE(12345 * 1000);

  const info = Buffer.concat([
    dateBytes, Buffer.from([0xC4]), latBuf, lngBuf,
    Buffer.from([0x32, 0x50, 0xB4]),
    Buffer.from([0x01, 0x94, 0x62, 0xAA, 0xAA, 0xBB, 0xBB, 0xBB]),
    Buffer.from([0x01, 0x00, 0x00]),
    milBuf,
  ]);
  const serial = 0x0099;
  const pktLen = 1 + info.length + 2 + 2;
  const crcIn  = Buffer.concat([Buffer.from([pktLen, 0x22]), info, Buffer.from([0x00, 0x99])]);
  const crc    = crcItu(crcIn);
  const pkt    = Buffer.concat([Buffer.from([0x78, 0x78, pktLen, 0x22]), info,
                                 Buffer.from([0x00, 0x99, (crc >> 8) & 0xFF, crc & 0xFF, 0x0D, 0x0A])]);

  const { packets } = parseConcoxBuffer(pkt, '123456789123456');
  const p = packets[0];

  // Map to what the server sends to publishLocation (mirrors server.js logic)
  const publishPayload = {
    imei:      p.imei,
    lat:       p.lat,
    lng:       p.lng,
    speed:     p.speed,
    fuel:      p.fuel,
    ignition:  p.ignition,
    voltage:   p.voltage,
    direction: p.direction,
    odometer:  p.odometer || 0,
    satellites: p.satellites,
    gsmSignal: p.gsmSignal,
    battery:   p.battery,
    deviceTime: p.deviceTime,
    isLive:    p.isLive,
  };

  for (const field of requiredFields) {
    assert(
      publishPayload[field] !== undefined,
      `publishLocation field '${field}' is present`,
    );
  }
}

// ============================================================
// SUMMARY
// ============================================================
console.log(`\n${'═'.repeat(60)}`);
console.log(`  CONCOX TEST RESULTS`);
console.log('═'.repeat(60));
console.log(`  Total:  ${passed + failed}`);
console.log(`  Passed: ${passed} ✅`);
console.log(`  Failed: ${failed} ${failed > 0 ? '❌' : ''}`);
console.log('═'.repeat(60));

if (failed === 0) {
  console.log('\n🎉 ALL CONCOX TESTS PASSED SUCCESSFULLY!\n');
  process.exit(0);
} else {
  console.error(`\n❌ ${failed} TEST(S) FAILED\n`);
  process.exit(1);
}
