// ============================================================
// INTEGRATION NETWORK TEST - MULTI-PORT VALIDATION
// ============================================================

const net = require('net');
const path = require('path');

// Set test ports so we don't conflict with any active running servers
process.env.TCP_PORT = 5090;
process.env.AIS140_TCP_PORT = 5091;

// Mock Redis publisher to prevent it connecting to Redis during test
const publisher = require('./publisher');
publisher.init = () => console.log('[MOCK REDIS] Init');
publisher.publishLocation = (p) => {
  console.log(`[MOCK REDIS] Published Location for ${p.imei} (Type: ${p.packetType})`);
  return Promise.resolve();
};
publisher.publishAlert = (p) => {
  console.log(`[MOCK REDIS] Published Alert for ${p.imei} (Type: ${p.packetType})`);
  return Promise.resolve();
};
publisher.close = () => Promise.resolve();

// Import server
const { bstplServer, ais140Server } = require('./server');

// Mock packets
const BSTPL_PACKET = '$10,123456789012345,A,080626,113000,1720.7174,N,07831.4323,E,50,12345,180,10,31,90,1,1,0,12.5,1.2,40,12.2,L#';
const AIS140_PACKET = '$NRM,TNOWTN,1.0.0,NR,1,L,123456789012345,TS09EX1234,1,08062026,113000,17.345378,N,78.523923,E,45.2,180.25,12,500.5,1.1,0.9,Airtel,1,1,12.4,4.2,0,C,31,404,98,AAAA,BBBB,0000,00,0,0,000005,123.456,DEBUG_INFO,ABCDABCD*';

function sendPacket(port, packet) {
  return new Promise((resolve) => {
    console.log(`[TEST CLIENT] Sending packet to port ${port}...`);
    const client = new net.Socket();
    client.connect(port, '127.0.0.1', () => {
      client.write(packet);
      // Wait a moment for processing, then close
      setTimeout(() => {
        client.destroy();
        resolve();
      }, 500);
    });
    client.on('error', (err) => {
      console.error(`[TEST CLIENT] Connection error on port ${port}:`, err.message);
      resolve();
    });
  });
}

async function runTests() {
  console.log('\n=== STARTING MULTI-PORT NETWORK INTEGRATION TEST ===\n');

  // Test 1: BSTPL packet to BSTPL port (should succeed)
  console.log('\n--- TEST 1: BSTPL Packet to BSTPL Port (5090) ---');
  await sendPacket(5090, BSTPL_PACKET);

  // Test 2: AIS140 packet to BSTPL port (should be ignored/rejected)
  console.log('\n--- TEST 2: AIS140 Packet to BSTPL Port (5090) - Should Reject ---');
  await sendPacket(5090, AIS140_PACKET);

  // Test 3: AIS140 packet to AIS140 port (should succeed)
  console.log('\n--- TEST 3: AIS140 Packet to AIS140 Port (5091) ---');
  await sendPacket(5091, AIS140_PACKET);

  // Test 4: BSTPL packet to AIS140 port (should be ignored/rejected)
  console.log('\n--- TEST 4: BSTPL Packet to AIS140 Port (5091) - Should Reject ---');
  await sendPacket(5091, BSTPL_PACKET);

  console.log('\n=== INTEGRATION TESTS COMPLETED. SHUTTING DOWN ===\n');
  bstplServer.close();
  ais140Server.close();
  process.exit(0);
}

// Start tests after servers had a moment to bind
setTimeout(runTests, 1000);
