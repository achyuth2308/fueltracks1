const { parseRcDocumentText } = require('../services/rcOcrService');

const sampleRC = `
GOVERNMENT OF TELANGANA
TRANSPORT DEPARTMENT
REGISTRATION CERTIFICATE
Regn. No: TS 07 UJ 1278
Regn. Date: 14/08/2021
Chassis No: MB1H3LHD26578201
Engine No: NMHZ6578201
Owner Name: RAMESH KUMAR YADAV
S/W/D of: VENKAT YADAV
Address: PLOT NO 42 SRI SAI ENCLAVE ROAD NO 4 KHARMANGHAT HYDERABAD 500074
Maker: TATA MOTORS LTD
Model: PRIMA 4028.S
Vehicle Class: HGV
Fuel: DIESEL
Fitness Upto: 13/08/2026
`;

const result = parseRcDocumentText(sampleRC);
console.log('Parsed result:\n', JSON.stringify(result, null, 2));

const assert = require('assert');
assert.strictEqual(result.registrationNo, 'TS07UJ1278', 'Reg number mismatch');
assert.strictEqual(result.chassisNo, 'MB1H3LHD26578201', 'Chassis number mismatch');
assert.strictEqual(result.engineNo, 'NMHZ6578201', 'Engine number mismatch');
assert.strictEqual(result.ownerName, 'RAMESH KUMAR YADAV', 'Owner name mismatch');
assert.strictEqual(result.vehicleMakeModel, 'TATA MOTORS LTD - PRIMA 4028.S', 'Make/Model mismatch');
assert.strictEqual(result.registrationDate, '2021-08-14', 'Reg date mismatch');
assert.strictEqual(result.fitnessUpto, '2026-08-13', 'Fitness date mismatch');
assert.strictEqual(result.fuelType, 'DIESEL', 'Fuel type mismatch');
assert.strictEqual(result.vehicleClass, 'HGV', 'Vehicle class mismatch');

console.log('ALL UNIT TEST ASSERTIONS PASSED!');

