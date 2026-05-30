// ============================================================
// TCP SERVER - FuelTracks
// Receives raw BSTPL-17 packets from GPS devices
// Port 5000 (must be open to public for field devices)
// ============================================================

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const net = require('net');
const { parsePacket } = require('./parser');
const { validateNormalPacket, validateAlertPacket } = require('./utils/packetValidator');
const publisher = require('./publisher');

const TCP_PORT = process.env.TCP_PORT || 5000;

// Track connected devices
const connectedDevices = new Map(); // imei → socket info
let totalPacketsReceived = 0;
let totalPacketsParsed = 0;
let totalPacketsInvalid = 0;

// Initialize Redis publisher
publisher.init();

// Create TCP server
const server = net.createServer((socket) => {
  const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[TCP] Device connected: ${clientId}`);

  // Buffer for handling partial packets (TCP streaming)
  let buffer = '';

  socket.on('data', (data) => {
    buffer += data.toString('ascii');

    // Process complete packets (delimited by #)
    let endIndex;
    while ((endIndex = buffer.indexOf('#')) !== -1) {
      // Extract one complete packet (from $ to #)
      let packet = buffer.substring(0, endIndex + 1);
      buffer = buffer.substring(endIndex + 1);

      // Find the start of the packet
      const startIndex = packet.lastIndexOf('$');
      if (startIndex === -1) {
        continue; // No valid packet start found
      }
      packet = packet.substring(startIndex);

      totalPacketsReceived++;

      // Process the packet
      processPacket(packet, clientId);
    }

    // Safety: prevent buffer overflow from malformed data
    if (buffer.length > 10000) {
      console.warn(`[TCP] Buffer overflow from ${clientId}, clearing`);
      buffer = '';
    }
  });

  socket.on('close', () => {
    console.log(`[TCP] Device disconnected: ${clientId}`);
    // Remove from connected devices
    for (const [imei, info] of connectedDevices.entries()) {
      if (info.clientId === clientId) {
        connectedDevices.delete(imei);
        break;
      }
    }
  });

  socket.on('error', (err) => {
    console.error(`[TCP] Socket error from ${clientId}:`, err.message);
  });

  // Keep connection alive
  socket.setKeepAlive(true, 60000);

  // Timeout after 5 minutes of no data
  socket.setTimeout(300000);
  socket.on('timeout', () => {
    console.log(`[TCP] Timeout for ${clientId}, closing connection`);
    socket.destroy();
  });
});

/**
 * Process a single complete packet
 */
async function processPacket(raw, clientId) {
  try {
    // Parse the packet
    const parsed = parsePacket(raw);

    if (!parsed) {
      totalPacketsInvalid++;
      console.warn(`[TCP] Unrecognized packet from ${clientId}: ${raw.substring(0, 50)}`);
      return;
    }

    // Validate based on packet type
    if (parsed.packetType === '$10') {
      const validation = validateNormalPacket(parsed);
      if (!validation.valid) {
        totalPacketsInvalid++;
        console.warn(`[TCP] Invalid $10 packet from ${parsed.imei}: ${validation.reason}`);
        return;
      }

      // Track the connected device
      connectedDevices.set(parsed.imei, {
        clientId,
        lastPacket: new Date(),
        lat: parsed.lat,
        lng: parsed.lng,
      });

      // Publish to Redis
      await publisher.publishLocation(parsed);
      totalPacketsParsed++;

      if (totalPacketsParsed % 100 === 0) {
        console.log(`[TCP] Stats: received=${totalPacketsReceived}, parsed=${totalPacketsParsed}, invalid=${totalPacketsInvalid}, devices=${connectedDevices.size}`);
      }

    } else if (parsed.packetType === '$11') {
      const validation = validateAlertPacket(parsed);
      if (!validation.valid) {
        totalPacketsInvalid++;
        console.warn(`[TCP] Invalid $11 alert from ${parsed.imei}: ${validation.reason}`);
        return;
      }

      // Publish alert to Redis
      await publisher.publishAlert(parsed);
      totalPacketsParsed++;
      console.log(`[TCP] Alert from ${parsed.imei}: ${parsed.alertType} - ${parsed.alertText}`);
    }

  } catch (err) {
    totalPacketsInvalid++;
    console.error(`[TCP] Parse error from ${clientId}:`, err.message);
  }
}

// Start TCP server
server.listen(TCP_PORT, '0.0.0.0', () => {
  console.log('============================================================');
  console.log(`  FUELTRACKS TCP SERVER`);
  console.log(`  Listening on port ${TCP_PORT}`);
  console.log(`  Protocol: BSTPL-17 (ASCII over TCP)`);
  console.log(`  Redis: ${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`);
  console.log('============================================================');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[TCP] Shutting down...');
  server.close();
  await publisher.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[TCP] Shutting down...');
  server.close();
  await publisher.close();
  process.exit(0);
});

// Log stats every 60 seconds
setInterval(() => {
  if (totalPacketsReceived > 0) {
    console.log(`[TCP] Periodic stats: received=${totalPacketsReceived}, parsed=${totalPacketsParsed}, invalid=${totalPacketsInvalid}, connected=${connectedDevices.size}`);
  }
}, 60000);

module.exports = server;
