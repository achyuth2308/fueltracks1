// ============================================================
// BSTPL17IS PROTOCOL TEST SCRIPT
// Validates parsing of all packet types from Protocol Document for client.md
// ============================================================

const { parsePacket } = require('./parser');
const { validateNormalPacket, validateAlertPacket } = require('./utils/packetValidator');

const testCases = [
  {
    name: 'Normal Location Packet (BSTPL$1)',
    raw: 'BSTPL$1,AP12AP3456,A,130720,160552,27.244183,N,83.673973,E,20,156,183,17,0,11,1,0,0,0,00.00,00,04.16,17A_V1_0_0,89917380578146790443,12.16,0#',
    expectedImei: 'AP12AP3456',
    expectedLat: 27.244183,
    expectedLng: 83.673973,
    expectedSpeed: 20,
    expectedIgnition: true,
    expectedPacketType: 'BSTPL$1'
  },
  {
    name: 'Digital Inputs 1 ON (BSTPL$2)',
    raw: 'BSTPL$2,AP12AP3456,A,130720,160552,27.244183,N,83.673973,E,20,156,183,17,0,11,1,1,1,1,02.00,00,04.16,17A_V1 _0_0,89917380578146790443,12.16,0#',
    expectedAlertType: 'ignition_on',
    expectedPacketType: 'BSTPL$2'
  },
  {
    name: 'Digital Inputs 1 OFF (BSTPL$2)',
    raw: 'BSTPL$2,AP12AP3456,A,130720,160552,27.244183,N,83.673973,E,20,156,183,17,0,11,1,0,0,0,02.00,00,04.16,17A_V1 _0_0,89917380578146790443,12.16,0#',
    expectedAlertType: 'ignition_off',
    expectedPacketType: 'BSTPL$2'
  },
  {
    name: 'Digital Inputs 2 ON (BSTPL$A)',
    raw: 'BSTPL$A,AP12AP3456,A,130720,160552,27.244183,N,83.673973,E,20,156,183,17,0,11,1,1,1,1,02.00,00,04.16,17A_V1 _0_0,89917380578146790443,12.16,0#',
    expectedAlertType: 'din2_on',
    expectedPacketType: 'BSTPL$A'
  },
  {
    name: 'Digital Inputs 3 ON (BSTPL$B)',
    raw: 'BSTPL$B,AP12AP3456,A,130720,160552,27.244183,N,83.673973,E,20,156,183,17,0,11,1,1,1,1,02.00,00,04.16,17A_V1 _0_0,89917380578146790443,12.16,0#',
    expectedAlertType: 'din3_on',
    expectedPacketType: 'BSTPL$B'
  },
  {
    name: 'Main Battery Connected (BSTPL$3)',
    raw: 'BSTPL$3,AP12AP3456,A,130720,160552,27.244183,N,83.673973,E,20,156,183,17,0,11,1,0,0,0,02.00,00,04.16,17A_V1 _0_0,89917380578146790443,12.16,0#',
    expectedAlertType: 'main_battery_connected',
    expectedPacketType: 'BSTPL$3'
  },
  {
    name: 'Main Battery Disconnected (BSTPL$3)',
    raw: 'BSTPL$3,AP12AP3456,A,130720,160552,27.244183,N,83.673973,E,20,156,183,17,0,11,0,0,0,0,02.00,00,04.16,17A_V1 _0_0,89917380578146790443,00.00,0#',
    expectedAlertType: 'main_battery_disconnected',
    expectedPacketType: 'BSTPL$3'
  },
  {
    name: 'Internal Battery Low (BSTPL$4)',
    raw: 'BSTPL$4,AP12AP3456,A,130720,160552,27.244183,N,83.673973,E,20,156,183,17,0,11,0,0,0,0,02.00,00,03.59,17A_V1 _0_0,89917380578146790443,00.00,0#',
    expectedAlertType: 'internal_battery_low',
    expectedPacketType: 'BSTPL$4'
  },
  {
    name: 'Harsh Acceleration (BSTPL$5)',
    raw: 'BSTPL$5,AP12AP3456,A,130720,160552,27.244183,N,83.673973,E,60,156,183,17,0,11,0,0,0,0,02.00,00,04.16,17A_V1 _0_0,89917380578146790443,00.00,0#',
    expectedAlertType: 'harsh_acceleration',
    expectedPacketType: 'BSTPL$5'
  },
  {
    name: 'Harsh Braking (BSTPL$6)',
    raw: 'BSTPL$6,AP12AP3456,A,130720,160552,27.244183,N,83.673973,E,7,156,183,17,0,11,0,0,0,0,02.00,00,04.16,17A_V1_ 0_0,89917380578146790443,00.00,0#',
    expectedAlertType: 'harsh_braking',
    expectedPacketType: 'BSTPL$6'
  },
  {
    name: 'Over Speeding (BSTPL$7)',
    raw: 'BSTPL$7,AP12AP3456,A,130720,160552,27.244183,N,83.673973,E,60,156,183,17,0,11,0,0,0,0,02.00,00,04.16,17A_V1 _0_0,89917380578146790443,00.00,0#',
    expectedAlertType: 'overspeed',
    expectedPacketType: 'BSTPL$7'
  },
  {
    name: 'Box Close (BSTPL$8)',
    raw: 'BSTPL$8,AP12AP3456,A,130720,160552,27.244183,N,83.673973,E,20,156,183,17,0,11,0,0,0,0,02.00,00,04.16,17A_V1 _0_0,89917380578146790443,00.00,0#',
    expectedAlertType: 'box_close',
    expectedPacketType: 'BSTPL$8'
  },
  {
    name: 'Box Open (BSTPL$8)',
    raw: 'BSTPL$8,AP12AP3456,A,130720,160552,27.244183,N,83.673973,E,20,156,183,17,1,11,0,0,0,0,02.00,00,04.16,17A_V1 _0_0,89917380578146790443,00.00,0#',
    expectedAlertType: 'box_open',
    expectedPacketType: 'BSTPL$8'
  },
  {
    name: 'SOS Emergency (BSTPL$9)',
    raw: 'BSTPL$9,AP12AP3456,A,130720,160552,27.244183,N,83.673973,E,20,156,183,17,0,11,0,0,0,0,02.00,00,04.16,17A_V1 _0_0,89917380578146790443,00.00,#',
    expectedAlertType: 'sos',
    expectedPacketType: 'BSTPL$9'
  },
  {
    name: 'Legacy $10 Location Packet (Backward Compatibility Check)',
    raw: '$10,123456789012345,A,080626,113000,1720.7174,N,07831.4323,E,50,12345,180,10,31,90,1,1,0,12.5,1.2,40,12.2,L#',
    expectedImei: '123456789012345',
    expectedPacketType: '$10'
  }
];

let allPassed = true;

testCases.forEach((tc) => {
  console.log(`\n----------------------------------------`);
  console.log(`Running test: ${tc.name}`);
  console.log(`Raw: ${tc.raw}`);

  try {
    const parsed = parsePacket(tc.raw);
    if (!parsed) {
      console.error(`❌ FAILED: parsePacket returned null`);
      allPassed = false;
      return;
    }

    const validation = validateNormalPacket(parsed);
    if (!validation.valid) {
      console.error(`❌ FAILED: Validation failed - ${validation.reason}`);
      allPassed = false;
      return;
    }

    if (tc.expectedPacketType && parsed.packetType !== tc.expectedPacketType) {
      console.error(`❌ FAILED: packetType mismatch (got ${parsed.packetType}, expected ${tc.expectedPacketType})`);
      allPassed = false;
      return;
    }

    if (tc.expectedImei && parsed.imei !== tc.expectedImei) {
      console.error(`❌ FAILED: imei mismatch (got ${parsed.imei}, expected ${tc.expectedImei})`);
      allPassed = false;
      return;
    }

    if (tc.expectedLat && Math.abs(parsed.lat - tc.expectedLat) > 0.0001) {
      console.error(`❌ FAILED: lat mismatch (got ${parsed.lat}, expected ${tc.expectedLat})`);
      allPassed = false;
      return;
    }

    if (tc.expectedLng && Math.abs(parsed.lng - tc.expectedLng) > 0.0001) {
      console.error(`❌ FAILED: lng mismatch (got ${parsed.lng}, expected ${tc.expectedLng})`);
      allPassed = false;
      return;
    }

    if (tc.expectedAlertType && parsed.alertType !== tc.expectedAlertType) {
      console.error(`❌ FAILED: alertType mismatch (got ${parsed.alertType}, expected ${tc.expectedAlertType})`);
      allPassed = false;
      return;
    }

    console.log(`✅ PASSED: Parsed IMEI=${parsed.imei}, Lat=${parsed.lat}, Lng=${parsed.lng}, AlertType=${parsed.alertType || 'None'}`);

  } catch (err) {
    console.error(`❌ FAILED with exception:`, err.message);
    allPassed = false;
  }
});

console.log(`\n========================================`);
if (allPassed) {
  console.log(`🎉 ALL BSTPL17IS PROTOCOL TESTS PASSED!`);
  process.exit(0);
} else {
  console.error(`❌ SOME TESTS FAILED.`);
  process.exit(1);
}
