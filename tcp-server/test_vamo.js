const { parsePacket } = require('./parser/index.js');

const vamoPkt = '$PVT,VAMO,220131,NR,01,L,862567078925232,UNKNOWN,1,23092026,084631,16.544467,N,79.757551,E,0.26,306.22,10,492.527,1.4,1.4,AIRTEL,1,1,18.4,4.2,0,O,30,404,49,4e5d,e2d7,e2d8,4e5d,10,1979,4e5d,9,ef3e,4e5d,0,0000,0000,0,0001,00,000001,0051*';
const vamoHel = '$HEL,VAMO,220131,HP,20,0,862567078925232,UNKNOWN,1,23092026,084631,1,1,18.4,4.2,*';
const vlt1Pkt = '$PVT,VLT1,M1.2.2,NR,01,L,868329088433093,UNKNOWN,1,23092026,090000,16.5,N,79.7,E,0,0,8,100,1.4,1.4,AIRTEL,1,1,12.0,4.0,0,O,20*';

const r1 = parsePacket(vamoPkt);
console.log('VAMO $PVT packetType:', r1 && r1.packetType, '| Expected: AIS140V2_GENERAL | PASS:', r1 && r1.packetType === 'AIS140V2_GENERAL');
console.log('VAMO $PVT lat:', r1 && r1.lat, '| lng:', r1 && r1.lng, '| gpsValid:', r1 && r1.gpsValid);

const r2 = parsePacket(vamoHel);
console.log('VAMO $HEL packetType:', r2 && r2.packetType, '| Expected: AIS140V2_HEALTH | PASS:', r2 && r2.packetType === 'AIS140V2_HEALTH');

const r3 = parsePacket(vlt1Pkt);
console.log('VLT1 $PVT packetType:', r3 && r3.packetType, '| Expected: VOLTY_NORMAL | PASS:', r3 && r3.packetType === 'VOLTY_NORMAL');
