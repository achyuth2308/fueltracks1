// ============================================================
// SIMULATION TEST: B20 TCP Client & Server Handshake
// Connects to local B20 server and tests full registration & telemetry flow
// ============================================================

const net = require('net');
const assert = require('assert');
const { initB20Server } = require('../b20ServerHandler');
const { parseB20Frame } = require('../parser/b20Parser');

const TEST_PORT = 5019;
const mockStats = {};
const mockDevices = new Map();
const publishedLocations = [];
const publishedRaw = [];

const mockPublisher = {
  publishLocation: async (loc) => { publishedLocations.push(loc); },
  publishAlert: async () => {},
  publishHeartbeat: async () => {},
  publishRawMessage: async (raw) => { publishedRaw.push(raw); }
};

const server = initB20Server(TEST_PORT, mockStats, mockDevices, mockPublisher);

const client = new net.Socket();
let step = 0;

client.connect(TEST_PORT, '127.0.0.1', () => {
  console.log('Simulation client connected to B20 server on port', TEST_PORT);

  // Send Registration (0x0100) packet from test spec
  const regHex = '7e0100002d0136492550720006002c006431313131004e523039423030303031000000000000000000003932353530373201d4c1413535303732237e';
  client.write(Buffer.from(regHex, 'hex'));
});

client.on('data', (data) => {
  if (step === 0) {
    console.log('Received ACK for Registration: hex =', data.toString('hex').toUpperCase());
    const parsedResp = parseB20Frame(data);
    assert(parsedResp !== null, 'Response must be valid B20 frame');
    assert.strictEqual(parsedResp.msgId, '0x8100', 'Must receive 0x8100 Registration ACK');
    console.log('✅ Registration ACK 0x8100 verified.');

    // Step 1: Send Location + OBD packet (0x0200)
    step = 1;
    const locHex = '7E02000071013182506161000600000000000400030157B4AC06CA557A002E0000000018122515534301040000AE9E2504000000002A0200002B040000000030011F31010894113147314A43353434345237323532333637912200843B3F000C1E0C0A32270F00000006ACF3079485CC00000000000A77001E31000C9500E17E';
    client.write(Buffer.from(locHex, 'hex'));
  } else if (step === 1) {
    console.log('Received ACK for Location: hex =', data.toString('hex').toUpperCase());
    const parsedResp = parseB20Frame(data);
    assert(parsedResp !== null, 'Response must be valid B20 frame');
    assert.strictEqual(parsedResp.msgId, '0x8001', 'Must receive 0x8001 Universal ACK');
    console.log('✅ Location Universal ACK 0x8001 verified.');

    assert(publishedLocations.length > 0, 'Location must be published to Redis');
    const loc = publishedLocations[0];
    assert.strictEqual(loc.imei, '013182506161');
    assert.strictEqual(loc.lat, 22.5251);
    assert.strictEqual(loc.lng, 113.92345);
    assert.strictEqual(loc.obd.engineRpm, 1517);
    assert.strictEqual(loc.obd.totalOdometerKm, 4374.91);
    console.log('✅ Telemetry published properly with OBD diagnostic values.');

    console.log('\n🎉 ALL TCP HANDSHAKE AND SERVER SIMULATION TESTS PASSED!');
    client.destroy();
    server.close();
    process.exit(0);
  }
});
