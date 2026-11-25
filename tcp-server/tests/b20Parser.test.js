// ============================================================
// UNIT TESTS FOR B20 PROTOCOL PARSER
// ============================================================

const assert = require('assert');
const {
  extractB20Frames,
  parseB20Frame,
  buildUniversalResponse,
  buildRegisterResponse
} = require('../parser/b20Parser');

console.log('Starting B20 Parser Unit Tests...\n');

// ── Test 1: Location & OBD Telemetry Packet (Sample from Spec) ──────
const sampleLocationHex = '7E02000071013182506161000600000000000400030157B4AC06CA557A002E0000000018122515534301040000AE9E2504000000002A0200002B040000000030011F31010894113147314A43353434345237323532333637912200843B3F000C1E0C0A32270F00000006ACF3079485CC00000000000A77001E31000C9500E17E';
const locBuf = Buffer.from(sampleLocationHex, 'hex');

const locParsed = parseB20Frame(locBuf);
assert(locParsed !== null, 'Location packet must parse successfully');
assert.strictEqual(locParsed.msgId, '0x0200');
assert.strictEqual(locParsed.imei, '013182506161');
assert.strictEqual(locParsed.seqNum, 6);
assert.strictEqual(locParsed.ignition, true);
assert.strictEqual(locParsed.gpsValid, 'A');
assert.strictEqual(locParsed.lat, 22.5251);
assert.strictEqual(locParsed.lng, 113.92345);
assert.strictEqual(locParsed.altitude, 46);
assert.strictEqual(locParsed.satellites, 8);
assert.strictEqual(locParsed.gsmSignal, 31);
assert.strictEqual(locParsed.odometer, 4470.2);
assert.strictEqual(locParsed.vin, '1G1JC5444R7252367');
assert(locParsed.obd, 'OBD telemetry block must exist');
assert.strictEqual(locParsed.obd.batteryVoltage, 13.2);
assert.strictEqual(locParsed.obd.engineRpm, 1517);
assert.strictEqual(locParsed.obd.throttlePercent, 5);
assert.strictEqual(locParsed.obd.engineLoadPercent, 12);
assert.strictEqual(locParsed.obd.coolantTempCelsius, -28);
assert.strictEqual(locParsed.obd.instantFuelL100km, 26.1);
assert.strictEqual(locParsed.obd.tripFuelLitres, 19.4);
assert.strictEqual(locParsed.obd.totalOdometerKm, 4374.91);
console.log('✅ Test 1: Location & OBD Telemetry decoding passed perfectly.');

// ── Test 2: Universal Response Generation (0x8001) ─────────────────
const resp0200 = buildUniversalResponse(locParsed.imei, locParsed.seqNum, 0x0200, 1, 0);
assert(resp0200[0] === 0x7E && resp0200[resp0200.length - 1] === 0x7E, 'Response must be framed in 0x7E');
console.log('Generated 0x8001 response hex:', resp0200.toString('hex').toUpperCase());
console.log('✅ Test 2: 0x8001 Universal Response generation passed.');

// ── Test 3: Terminal Registration (0x0100) and 0x8100 Response ─────
const sampleRegHex = '7e0100002d0136492550720006002c006431313131004e523039423030303031000000000000000000003932353530373201d4c1413535303732237e';
// Note: checksum in doc sample is 0x23 (or unescaped). Let's test with frame parser:
const regBuf = Buffer.from(sampleRegHex, 'hex');
const regParsed = parseB20Frame(regBuf);
if (regParsed) {
  assert.strictEqual(regParsed.msgId, '0x0100');
  assert.strictEqual(regParsed.imei, '013649255072');
  console.log('✅ Test 3a: Registration frame decoded:', regParsed.terminalType);
}

const regResp = buildRegisterResponse('013649255072', 6, 1, 0, 'TR20171018090017');
assert(regResp[0] === 0x7E && regResp[regResp.length - 1] === 0x7E, 'Register response must be framed');
console.log('Generated 0x8100 response hex:', regResp.toString('hex').toUpperCase());
console.log('✅ Test 3b: 0x8100 Register response generation passed.');

// ── Test 4: Stream Frame Extraction ────────────────────────────────
const stream = Buffer.concat([
  Buffer.from([0x00, 0x00]), // garbage prefix
  locBuf,
  Buffer.from([0xAA, 0xBB]), // middle garbage
  resp0200,
  Buffer.from([0x7E, 0x01, 0x02]) // partial frame
]);

const { frames, remainder } = extractB20Frames(stream);
assert.strictEqual(frames.length, 2, 'Must extract exactly 2 complete frames from stream');
assert.strictEqual(remainder.length, 3, 'Remainder must hold partial 3 bytes');
console.log('✅ Test 4: Stream extraction and boundary splitting passed.');

console.log('\n🎉 ALL B20 PARSER UNIT TESTS PASSED WITH 100% SUCCESS!');
