const {
  isImeiPacket,
  parseImeiPacket,
  parseCodec8Packet,
  buildCodec12Command
} = require('../tcp-server/parser/fmb920Parser');

console.log("=== Testing IMEI Handshake ===");
// Create a fake IMEI packet (0x00, 0x0F, then 15 ascii bytes)
const imeiStr = "123456789012345";
const imeiBuffer = Buffer.alloc(17);
imeiBuffer.writeUInt16BE(15, 0);
imeiBuffer.write(imeiStr, 2, 'ascii');

console.log("Is IMEI packet?", isImeiPacket(imeiBuffer));
const { imei, response } = parseImeiPacket(imeiBuffer);
console.log("Parsed IMEI:", imei);
console.log("Response buffer (hex):", response.toString('hex'));
if (imei !== imeiStr || response.toString('hex') !== '01') {
  console.error("FAIL: IMEI handshake test failed");
  process.exit(1);
}

console.log("\n=== Testing Command Builder (Codec 12) ===");
const cmdBuffer = buildCodec12Command("setdigout 1");
console.log("Built Codec 12 Command Buffer:", cmdBuffer.toString('hex'));

console.log("\n=== Testing Codec 8 Parser with mock packet ===");
// Constructing a minimal Codec 8 packet:
// 4 bytes 00 (preamble)
// 4 bytes Data Length
// 1 byte Codec ID (08)
// 1 byte Count1 (1)
// -- record --
// 8 bytes timestamp
// 1 byte priority
// 15 bytes GPS
// -- IO --
// 1 byte event io (0)
// 1 byte total IO (0)
// 1 byte n1 (0)
// 1 byte n2 (0)
// 1 byte n4 (0)
// 1 byte n8 (0)
// 1 byte Count2 (1)
// 4 bytes CRC16

const dataFieldBuffer = Buffer.alloc(1 + 1 + 8 + 1 + 15 + 1 + 1 + 1 + 1 + 1 + 1 + 1); // 32 bytes
let offset = 0;
dataFieldBuffer.writeUInt8(0x08, offset++); // codec
dataFieldBuffer.writeUInt8(0x01, offset++); // count 1
dataFieldBuffer.writeBigUInt64BE(BigInt(Date.now()), offset); offset += 8; // timestamp
dataFieldBuffer.writeUInt8(1, offset++); // priority
// GPS (Lon, Lat, Alt, Angle, Sats, Speed)
dataFieldBuffer.writeInt32BE(0, offset); offset += 4; // Lon
dataFieldBuffer.writeInt32BE(0, offset); offset += 4; // Lat
dataFieldBuffer.writeInt16BE(0, offset); offset += 2; // Alt
dataFieldBuffer.writeUInt16BE(0, offset); offset += 2; // Angle
dataFieldBuffer.writeUInt8(12, offset++); // Sats
dataFieldBuffer.writeUInt16BE(80, offset); offset += 2; // Speed (80 km/h)
// IO
dataFieldBuffer.writeUInt8(0, offset++); // Event IO
dataFieldBuffer.writeUInt8(0, offset++); // Total IO
dataFieldBuffer.writeUInt8(0, offset++); // N1
dataFieldBuffer.writeUInt8(0, offset++); // N2
dataFieldBuffer.writeUInt8(0, offset++); // N4
dataFieldBuffer.writeUInt8(0, offset++); // N8
// count 2
dataFieldBuffer.writeUInt8(0x01, offset++); 

// Calculate CRC 
function crc16(buffer, length) {
  let crc = 0;
  for (let i = 0; i < length; i++) {
    crc ^= buffer.readUInt8(i);
    for (let j = 0; j < 8; j++) {
      if ((crc & 1) > 0) crc = (crc >> 1) ^ 0xA001;
      else crc >>= 1;
    }
  }
  return crc;
}
const crc = crc16(dataFieldBuffer, dataFieldBuffer.length);

const fullPacket = Buffer.alloc(4 + 4 + dataFieldBuffer.length + 4);
fullPacket.writeUInt32BE(0, 0); // Zeros
fullPacket.writeUInt32BE(dataFieldBuffer.length, 4); // Length
dataFieldBuffer.copy(fullPacket, 8); // Data
fullPacket.writeUInt32BE(crc, 8 + dataFieldBuffer.length); // CRC

const result = parseCodec8Packet(fullPacket);
if (result.error) {
  console.error("FAIL: Error parsing packet:", result.error);
  process.exit(1);
} else {
  console.log("Parsed records:", JSON.stringify(result.records, null, 2));
  console.log("ACK response (hex):", result.response.toString('hex'));
}

console.log("\nALL TESTS PASSED");
