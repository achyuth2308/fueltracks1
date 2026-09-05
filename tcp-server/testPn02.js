const { parsePn02Buffer, buildPn02Ack } = require('./parser/pn02Parser');

// Construct a dummy 0x13 Position packet
// Packet length = 87 bytes
const packet = Buffer.alloc(87);
packet[0] = 0x25;
packet[1] = 0x25;
packet[2] = 0x13;
packet.writeUInt16BE(87, 3); // Length
packet.writeUInt16BE(1234, 5); // Serial

// IMEI: 868016898888888 (15 digits) -> padded to 16 -> 0868016898888888
const imeiHex = '0868016898888888';
for (let i = 0; i < 8; i++) {
  packet[7 + i] = parseInt(imeiHex.substring(i * 2, i * 2 + 2), 16);
}

// Timestamp: YY MM DD HH MM SS
packet[52] = 26; // 2026
packet[53] = 9;  // Sept
packet[54] = 5;  // 5th
packet[55] = 12; // 12
packet[56] = 30; // 30
packet[57] = 45; // 45

// Altitude (Float32LE): 58.8812
packet.writeFloatLE(58.8812, 58);
// Longitude (Float32LE): 113.9189
packet.writeFloatLE(113.9189, 62);
// Latitude (Float32LE): 22.52078
packet.writeFloatLE(22.52078, 66);

// Speed BCD: 111.5 km/h -> 0x11 0x15
packet[70] = 0x11;
packet[71] = 0x15;

// Direction BCD: 360 -> 0x03 0x60
packet[72] = 0x03;
packet[73] = 0x60;

console.log("Parsing PN02 Position Packet...");
const result = parsePn02Buffer(packet);
console.log(JSON.stringify(result.packets[0], null, 2));

console.log("\nBuilding ACK...");
const ack = buildPn02Ack(0x13, 1234, "868016898888888");
console.log("ACK Buffer:", ack.toString('hex').toUpperCase());
