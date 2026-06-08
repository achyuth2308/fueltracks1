// ============================================================
// TCP SERVER - FuelTracks
// Receives raw GPS packets from devices on isolated ports:
// - Port 5000: BSTPL-17 (uses # delimiter)
// - Port 5001: AIS140 / tNavIC (uses * delimiter)
// ============================================================

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const net = require('net');
const { parsePacket } = require('./parser');
const { validateNormalPacket, validateAlertPacket, validateAis140EmergencyPacket } = require('./utils/packetValidator');
const publisher = require('./publisher');

const BSTPL_PORT = process.env.TCP_PORT || 5000;
const AIS140_PORT = process.env.AIS140_TCP_PORT || 5001;

// Track connected devices
const connectedDevices = new Map(); // imei → socket info
let totalPacketsReceived = 0;
let totalPacketsParsed = 0;
let totalPacketsInvalid = 0;

// Initialize Redis publisher
publisher.init();

// Start the BSTPL-17 Server on Port 5000
const bstplServer = createProtocolServer(
  BSTPL_PORT,
  '#',
  'BSTPL-17',
  ['$10', '$11']
);

// Start the AIS140 Server on Port 5001
const ais140Server = createProtocolServer(
  AIS140_PORT,
  '*',
  'AIS140',
  ['$NRM', '$ALT', '$EPB', '$LGN', '$HLM']
);

/**
 * Factory to create a TCP server for a specific protocol configuration
 */
function createProtocolServer(port, delimiter, protocolName, allowedHeaders) {
  const server = net.createServer((socket) => {
    const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[TCP - ${protocolName}] Device connected: ${clientId}`);

    // Buffer for handling partial packets (TCP streaming)
    let buffer = '';

    socket.on('data', (data) => {
      buffer += data.toString('ascii');

      // Process complete packets delimited by the protocol specific delimiter
      let endIndex;
      while ((endIndex = buffer.indexOf(delimiter)) !== -1) {
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
        processPacket(packet, clientId, protocolName, allowedHeaders);
      }

      // Safety: prevent buffer overflow from malformed data
      if (buffer.length > 10000) {
        console.warn(`[TCP - ${protocolName}] Buffer overflow from ${clientId}, clearing`);
        buffer = '';
      }
    });

    socket.on('close', () => {
      console.log(`[TCP - ${protocolName}] Device disconnected: ${clientId}`);
      // Remove from connected devices
      for (const [imei, info] of connectedDevices.entries()) {
        if (info.clientId === clientId) {
          connectedDevices.delete(imei);
          break;
        }
      }
    });

    socket.on('error', (err) => {
      console.error(`[TCP - ${protocolName}] Socket error from ${clientId}:`, err.message);
    });

    // Keep connection alive
    socket.setKeepAlive(true, 60000);

    // Timeout after 5 minutes of no data
    socket.setTimeout(300000);
    socket.on('timeout', () => {
      console.log(`[TCP - ${protocolName}] Timeout for ${clientId}, closing connection`);
      socket.destroy();
    });
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`============================================================`);
    console.log(`  [TCP - ${protocolName}] Server started successfully`);
    console.log(`  Listening on port: ${port}`);
    console.log(`  Delimiter: '${delimiter}'`);
    console.log(`============================================================`);
  });

  return server;
}

/**
 * Process a single complete packet
 */
async function processPacket(raw, clientId, protocolName, allowedHeaders) {
  try {
    // Check if packet header is allowed on this port
    const header = raw.split(',')[0].trim();
    if (!allowedHeaders.includes(header)) {
      totalPacketsInvalid++;
      console.warn(`[TCP - ${protocolName}] Disallowed packet header '${header}' received on port. Ignoring.`);
      return;
    }

    // Parse the packet
    const parsed = parsePacket(raw);

    if (!parsed) {
      totalPacketsInvalid++;
      console.warn(`[TCP - ${protocolName}] Unrecognized packet from ${clientId}: ${raw.substring(0, 50)}`);
      return;
    }

    // Process based on packet type
    if (parsed.packetType === '$10' || parsed.packetType === '$NRM') {
      const validation = validateNormalPacket(parsed);
      if (!validation.valid) {
        totalPacketsInvalid++;
        console.warn(`[TCP - ${protocolName}] Invalid location packet from ${parsed.imei || 'unknown'}: ${validation.reason}`);
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

    } else if (parsed.packetType === '$11' || parsed.packetType === '$ALT') {
      const validation = validateAlertPacket(parsed);
      if (!validation.valid) {
        totalPacketsInvalid++;
        console.warn(`[TCP - ${protocolName}] Invalid alert from ${parsed.imei || 'unknown'}: ${validation.reason}`);
        return;
      }

      // Publish alert to Redis
      await publisher.publishAlert(parsed);
      totalPacketsParsed++;
      console.log(`[TCP - ${protocolName}] Alert from ${parsed.imei}: ${parsed.alertType} - ${parsed.alertText}`);

    } else if (parsed.packetType === '$EPB') {
      const validation = validateAis140EmergencyPacket(parsed);
      if (!validation.valid) {
        totalPacketsInvalid++;
        console.warn(`[TCP - ${protocolName}] Invalid emergency packet from ${parsed.imei || 'unknown'}: ${validation.reason}`);
        return;
      }

      // Track the connected device
      connectedDevices.set(parsed.imei, {
        clientId,
        lastPacket: new Date(),
        lat: parsed.lat,
        lng: parsed.lng,
      });

      // Publish both location and alert to Redis
      await publisher.publishLocation(parsed);
      await publisher.publishAlert(parsed);
      totalPacketsParsed++;
      console.log(`[TCP - ${protocolName}] Emergency/SOS from ${parsed.imei}: ${parsed.alertText}`);

    } else if (parsed.packetType === '$LGN') {
      console.log(`[TCP - ${protocolName}] Login received from device ${parsed.imei} (${parsed.vehicleRegNo || 'No Reg'})`);
      totalPacketsParsed++;

    } else if (parsed.packetType === '$HLM') {
      console.log(`[TCP - ${protocolName}] Health status received from device ${parsed.imei}. Battery: ${parsed.batteryPercent}%`);
      totalPacketsParsed++;
    }

  } catch (err) {
    totalPacketsInvalid++;
    console.error(`[TCP - ${protocolName}] Parse error from ${clientId}:`, err.message);
  }
}

// Graceful shutdown
const shutdown = async () => {
  console.log('\n[TCP] Shutting down servers...');
  bstplServer.close();
  ais140Server.close();
  await publisher.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Log stats every 60 seconds
setInterval(() => {
  if (totalPacketsReceived > 0) {
    console.log(`[TCP] Periodic stats: received=${totalPacketsReceived}, parsed=${totalPacketsParsed}, invalid=${totalPacketsInvalid}, connected=${connectedDevices.size}`);
  }
}, 60000);

module.exports = { bstplServer, ais140Server };
