const net = require('net');

const HOST = '5.223.83.39';
const PORT = 5008;
const IMEI = '0861329085720424'; // 16 digits (padded with 0)

const client = new net.Socket();

client.connect(PORT, HOST, () => {
  console.log(`Connected to PN02 Server at ${HOST}:${PORT}`);
  
  // Create PN02 Login Packet (0x01)
  const loginPacket = Buffer.alloc(15);
  loginPacket[0] = 0x25;
  loginPacket[1] = 0x25;
  loginPacket[2] = 0x01; // Msg Type
  loginPacket.writeUInt16BE(15, 3); // Length = 15
  loginPacket.writeUInt16BE(1, 5); // Serial = 1
  
  for (let i = 0; i < 8; i++) {
    loginPacket[7 + i] = parseInt(IMEI.substring(i * 2, i * 2 + 2), 16);
  }

  console.log('Sending Login Packet:', loginPacket.toString('hex'));
  client.write(loginPacket);

  // Send a Position Packet (0x13) after 1 second
  setTimeout(() => {
    // 0x13 packet length = 87 bytes (0x57) based on protocol README
    const posPacket = Buffer.alloc(87);
    posPacket[0] = 0x25;
    posPacket[1] = 0x25;
    posPacket[2] = 0x13; // Msg Type
    posPacket.writeUInt16BE(87, 3); // Length = 87
    posPacket.writeUInt16BE(2, 5); // Serial = 2
    
    // IMEI
    for (let i = 0; i < 8; i++) {
      posPacket[7 + i] = parseInt(IMEI.substring(i * 2, i * 2 + 2), 16);
    }
    
    // Write timestamp at offset 52 (yy mm dd hh min ss) -> 26 09 24 12 00 00
    posPacket[52] = 26; // 2026
    posPacket[53] = 9;  // Sept
    posPacket[54] = 24; // 24th
    posPacket[55] = 12; // 12:00
    posPacket[56] = 0;
    posPacket[57] = 0;
    
    // Write Float32LE for altitude, longitude, latitude
    posPacket.writeFloatLE(150.0, 58); // Altitude
    posPacket.writeFloatLE(78.0, 62);  // Longitude
    posPacket.writeFloatLE(17.0, 66);  // Latitude
    
    console.log('Sending Position Packet:', posPacket.toString('hex'));
    client.write(posPacket);
    
    // Close connection after 3 seconds
    setTimeout(() => {
      client.destroy();
    }, 3000);
  }, 1000);
});

client.on('data', (data) => {
  console.log('Received response from server:', data.toString('hex'));
});

client.on('close', () => {
  console.log('Connection closed');
});

client.on('error', (err) => {
  console.error('Error:', err.message);
});
