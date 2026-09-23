const { isV2LoginPacket } = require('./parser/ais140V2Parser');

// Updated test with the final logic from server.js
function headerAllowed(raw, allowedHeaders) {
  const header = raw.split(',')[0].trim();
  return allowedHeaders.some(allowed => {
    if (allowed === 'IS_V2_LOGIN') return isV2LoginPacket(raw);
    if (allowed.includes(','))     return raw.trimStart().startsWith(allowed);
    return header.startsWith(allowed);
  });
}

const allowedHeadersAIS140V2 = ['$,', 'ACTVR', 'HCHKR', 'IS_V2_LOGIN', '$PVT,VAMO', '$HEL,VAMO'];

const tests = [
  { raw: '$PVT,VAMO,220131,NR,01,L,862567078925232,UNKNOWN,1,23092026,084631,16.544467,N,79.757551,E,0.26,306.22,10,492.527,1.4,1.4,AIRTEL,1,1,18.4,4.2,0,O,30*', expect: true,  label: 'VAMO $PVT on port 5003' },
  { raw: '$HEL,VAMO,220131,HP,20,0,862567078925232,UNKNOWN,1,23092026,084631,1,1,18.4,4.2*',                                                                         expect: true,  label: 'VAMO $HEL on port 5003' },
  { raw: '$PVT,VLT1,M1.2.2,OC,12,<5.223.61.229#>,L,868329088433093,DL1PC5814,1,23092026,102552*',                                                                   expect: false, label: 'VLT1 $PVT on port 5003 (MUST REJECT)' },
  { raw: '$HEL,VLT1,M1.2.2,HP,20,0,868329088433093,DL1PC5814,1*',                                                                                                   expect: false, label: 'VLT1 $HEL on port 5003 (MUST REJECT)' },
  { raw: '$,10,APMK,1.1.2,NR,01,L,869247045236301,kl23m212,0,23112020,154924,0.0,N,0.0,E,0,0,0,0,0,0,VODAFONE*', expect: true,  label: 'AIS140V2 $,10 on port 5003' },
  { raw: '$,101,APM,1.0.9,869247046143589,100,30,0,10,60,1000,0.4,0.4*',                                          expect: true,  label: 'AIS140V2 $,101 health on port 5003' },
  { raw: '$TN3CBZ1122$864376047795371$1.0.9$1.0$28.651379$N$77.092681$E$',                                        expect: true,  label: 'AIS140V2 V2 login $ on port 5003' },
  { raw: 'ACTVR,12,869247046143589,OK*',                                                                           expect: true,  label: 'AIS140V2 ACTVR on port 5003' },
  { raw: 'HCHKR,869247046143589,OK*',                                                                              expect: true,  label: 'AIS140V2 HCHKR on port 5003' },
];

let allPass = true;
tests.forEach(t => {
  const result = headerAllowed(t.raw, allowedHeadersAIS140V2);
  const pass = result === t.expect;
  if (!pass) allPass = false;
  console.log(`${pass ? '✅' : '❌'} ${t.label}: got=${result} expected=${t.expect}`);
});

console.log(allPass ? '\nAll tests PASSED ✅' : '\nSome tests FAILED ❌');
