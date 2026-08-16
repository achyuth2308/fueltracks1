const { parsePacket } = require('./parser');

const normalPacket = '$PVT,VLT1,M1.2.2,NR,01,L,861329080867568,DL1PC5814,1,06082026,043020,17.345352,N,78.523826,E,0.26,306.22,10,492.527,1.4,1.4,AIRTEL,1,1,18.4,4.2,0,O,30,404,49,4e5d,e2d7,e2d8,4e5d,10,1979,4e5d,9,ef3e,4e5d,0,0000,0000,0,0001,00,000001,0051*';
const healthPacket = '$HEL,VLT1,M1.2.2,861329080867568,13,40,2,60,120,0001,01*';
const emergencyPacket = '$PVT,VLT1,M1.2.2,EA,10,L,861329080867568,DL1PC5814,1,06082026,043020,17.345352,N,78.523826,E,0.26,306.22,10,492.527,1.4,1.4,AIRTEL,1,1,18.4,4.2,1,O,30,404,49,4e5d,e2d7,e2d8,4e5d,10,1979,4e5d,9,ef3e,4e5d,0,0000,0000,0,0001,00,000001,0051*';
const epbPacket = '$EPB,VLT1,M1.2.2,861329080867568,DL1PC5814,1,06082026,043020,17.345352,N,78.523826,E,0.26,306.22,10,492.527,1.4,1.4,AIRTEL,1,1,18.4,4.2,1,O,30,404,49,4e5d,e2d7,e2d8,4e5d,10,1979,4e5d,9,ef3e,4e5d,0,0000,0000,0,0001,00,000001,0051*';
const ocPacket = '$PVT,VLT1,M1.2.2,OC,12,<52.62.136.218#*';

console.log('--- TEST 1: Normal Packet ---');
console.log(parsePacket(normalPacket));

console.log('--- TEST 2: Health Packet ($HEL) ---');
console.log(parsePacket(healthPacket));

console.log('--- TEST 3: Emergency Packet ($PVT with EA) ---');
console.log(parsePacket(emergencyPacket));

console.log('--- TEST 4: EPB Packet ($EPB with VLT1) ---');
console.log(parsePacket(epbPacket));

console.log('--- TEST 5: OC Handshake Packet ---');
console.log(parsePacket(ocPacket));
