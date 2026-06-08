// ============================================================
// PARSER VERIFICATION SCRIPT
// ============================================================

const { parsePacket } = require('./parser');
const { validateNormalPacket, validateAlertPacket, validateAis140EmergencyPacket } = require('./utils/packetValidator');

const testCases = [
  {
    name: 'BSTPL-17 Location Packet ($10)',
    raw: '$10,123456789012345,A,080626,113000,1720.7174,N,07831.4323,E,50,12345,180,10,31,90,1,1,0,12.5,1.2,40,12.2,L#',
    validator: validateNormalPacket
  },
  {
    name: 'BSTPL-17 Alert Packet ($11)',
    raw: '$11,123456789012345,080626,113000,1720.7174,N,07831.4323,E,Ignition On#',
    validator: validateAlertPacket
  },
  {
    name: 'AIS140 Location Packet ($NRM)',
    // Header, Vendor, SW, Type, AlertID, Status, IMEI, VehicleReg, Fix, Date, Time, Lat, LatDir, Lng, LngDir, Speed, Heading, Satellites, Altitude, PDOP, HDOP, Operator, Ignition, MainPower, MainVoltage, BattVoltage, Emergency, Tamper, GSM, MCC, MNC, LAC, CellID, DIN, DOUT, AIN1, AIN2, FrameNo, Odo, Debug, Checksum*
    raw: '$NRM,TNOWTN,1.0.0,NR,1,L,123456789012345,TS09EX1234,1,08062026,113000,17.345378,N,78.523923,E,45.2,180.25,12,500.5,1.1,0.9,Airtel,1,1,12.4,4.2,0,C,31,404,98,AAAA,BBBB,0000,00,0,0,000005,123.456,DEBUG_INFO,ABCDABCD*',
    validator: validateNormalPacket
  },
  {
    name: 'AIS140 Alert Packet ($ALT) - Low Battery',
    raw: '$ALT,TNOWTN,1.0.0,EA,4,L,123456789012345,TS09EX1234,1,08062026,113000,17.345378,N,78.523923,E,0.0,180.25,12,500.5,1.1,0.9,Airtel,1,1,12.4,3.2,0,C,31,404,98,AAAA,BBBB,0000,00,0,0,000006,123.456,DEBUG_INFO,ABCDABCD*',
    validator: validateAlertPacket
  },
  {
    name: 'AIS140 Emergency Packet ($EPB)',
    // Header, Type, IMEI, Status, DateTime, Fix, Lat, LatDir, Lng, LngDir, Alt, Speed, Dist, Prov, Reg, Reply*
    raw: '$EPB,EMR,123456789012345,NM,08062026113000,A,17.345378,N,78.523923,E,500.5,45.2,100,BSNL,TS09EX1234,0*',
    validator: validateAis140EmergencyPacket
  },
  {
    name: 'AIS140 Login Packet ($LGN)',
    raw: '$LGN,TS09EX1234,123456789012345,1.0.0,17.345378,N,78.523923,E*',
    validator: null
  },
  {
    name: 'AIS140 Health Packet ($HLM)',
    raw: '$HLM,TNOWTN,1.0.0,123456789012345,85,20,5,60,60,0000,0*',
    validator: null
  }
];

let allPassed = true;

testCases.forEach((tc) => {
  console.log(`\n----------------------------------------`);
  console.log(`Running test: ${tc.name}`);
  console.log(`Raw packet: ${tc.raw}`);

  try {
    const parsed = parsePacket(tc.raw);
    if (!parsed) {
      console.error(`❌ FAILED: Parser returned null`);
      allPassed = false;
      return;
    }

    console.log(`Parsed Object:`, JSON.stringify(parsed, null, 2));

    if (tc.validator) {
      const validation = tc.validator(parsed);
      if (validation.valid) {
        console.log(`✅ Passed validation`);
      } else {
        console.error(`❌ FAILED: Validation failed - ${validation.reason}`);
        allPassed = false;
      }
    } else {
      console.log(`✅ Parsed successfully (no validator required for this packet type)`);
    }

  } catch (err) {
    console.error(`❌ FAILED with exception:`, err.message);
    allPassed = false;
  }
});

console.log(`\n========================================`);
if (allPassed) {
  console.log(`🎉 ALL TESTS PASSED SUCCESSFULLY!`);
  process.exit(0);
} else {
  console.error(`❌ SOME TESTS FAILED.`);
  process.exit(1);
}
