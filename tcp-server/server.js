// ============================================================
// TCP SERVER - FuelTracks
// Receives raw GPS packets from devices on isolated ports:
// - Port 5000: BSTPL-17 (uses # delimiter)
// - Port 5001: AIS140 / tNavIC (uses * delimiter)
// - Port 5002: Concox V5/VL149/GT800 (binary protocol)
// ============================================================

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const net = require('net');
const http = require('http');
const { parsePacket } = require('./parser');

const protocolStats = {
  'BSTPL-17': { totalConnectionAttempts: 0, lastSuccessfulPacketAt: null, connections: 0 },
  'AIS140': { totalConnectionAttempts: 0, lastSuccessfulPacketAt: null, connections: 0 },
  'CONCOX': { totalConnectionAttempts: 0, lastSuccessfulPacketAt: null, connections: 0 }
};
const { validateNormalPacket, validateAlertPacket, validateAis140EmergencyPacket } = require('./utils/packetValidator');
const publisher = require('./publisher');

const BSTPL_PORT  = process.env.TCP_PORT || 5000;
const AIS140_PORT = process.env.AIS140_TCP_PORT || 5001;
const CONCOX_PORT = parseInt(process.env.CONCOX_TCP_PORT) || 5002;

// Concox binary parser + ACK builders
const { parseConcoxBuffer, buildLoginAck, buildHeartbeatAck, buildAlarmAck } = require('./parser/concoxParser');

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

// Start the Concox Server on Port 5002 (binary protocol — separate handler)
const concoxServer = createConcoxServer(CONCOX_PORT);

/**
 * Factory to create a TCP server for a specific protocol configuration
 */
function createProtocolServer(port, delimiter, protocolName, allowedHeaders) {
  const server = net.createServer((socket) => {
    if (protocolStats[protocolName]) {
      protocolStats[protocolName].totalConnectionAttempts++;
      protocolStats[protocolName].connections++;
    }
    const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[TCP - ${protocolName}] Device connected: ${clientId}`);

    // Buffer for handling partial packets (TCP streaming)
    let buffer = '';
    let isFirstData = true;

    socket.on('data', (data) => {
      if (isFirstData) {
        isFirstData = false;
        if (data.length >= 2 && ((data[0] === 0x78 && data[1] === 0x78) || (data[0] === 0x79 && data[1] === 0x79))) {
          const hexBytes = data.slice(0, 64).toString('hex');
          const utf8Bytes = data.slice(0, 64).toString('utf8').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
          console.warn(`[TCP - ${protocolName}] Received Concox-framed bytes on the ${protocolName} port — device is likely misconfigured to the wrong port/IP.`);
          console.warn(`[TCP - ${protocolName}] Diagnostic hex: ${hexBytes}`);
          console.warn(`[TCP - ${protocolName}] Diagnostic str: ${utf8Bytes}`);
          socket.destroy();
          return;
        }
      }
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
      if (protocolStats[protocolName]) protocolStats[protocolName].connections--;
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

    parsed.rawString = raw;
    parsed.packetType = parsed.packetType || header;

    if (parsed.imei) {
      await publisher.publishRawMessage(parsed).catch(err => console.error(err));
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
      if (typeof protocolName !== 'undefined' && protocolStats[protocolName]) {
        protocolStats[protocolName].lastSuccessfulPacketAt = new Date().toISOString();
      } else if (protocolStats['CONCOX']) {
        protocolStats['CONCOX'].lastSuccessfulPacketAt = new Date().toISOString();
      }
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
      if (typeof protocolName !== 'undefined' && protocolStats[protocolName]) {
        protocolStats[protocolName].lastSuccessfulPacketAt = new Date().toISOString();
      } else if (protocolStats['CONCOX']) {
        protocolStats['CONCOX'].lastSuccessfulPacketAt = new Date().toISOString();
      }
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
      if (typeof protocolName !== 'undefined' && protocolStats[protocolName]) {
        protocolStats[protocolName].lastSuccessfulPacketAt = new Date().toISOString();
      } else if (protocolStats['CONCOX']) {
        protocolStats['CONCOX'].lastSuccessfulPacketAt = new Date().toISOString();
      }
      totalPacketsParsed++;
      console.log(`[TCP - ${protocolName}] Emergency/SOS from ${parsed.imei}: ${parsed.alertText}`);

    } else if (parsed.packetType === '$LGN') {
      console.log(`[TCP - ${protocolName}] Login received from device ${parsed.imei} (${parsed.vehicleRegNo || 'No Reg'})`);
      if (typeof protocolName !== 'undefined' && protocolStats[protocolName]) {
        protocolStats[protocolName].lastSuccessfulPacketAt = new Date().toISOString();
      } else if (protocolStats['CONCOX']) {
        protocolStats['CONCOX'].lastSuccessfulPacketAt = new Date().toISOString();
      }
      totalPacketsParsed++;

    } else if (parsed.packetType === '$HLM') {
      console.log(`[TCP - ${protocolName}] Health status received from device ${parsed.imei}. Battery: ${parsed.batteryPercent}%`);
      if (typeof protocolName !== 'undefined' && protocolStats[protocolName]) {
        protocolStats[protocolName].lastSuccessfulPacketAt = new Date().toISOString();
      } else if (protocolStats['CONCOX']) {
        protocolStats['CONCOX'].lastSuccessfulPacketAt = new Date().toISOString();
      }
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
  concoxServer.close();
  if (typeof healthServer !== 'undefined') healthServer.close();
  await publisher.close();
  process.exit(0);
};

// ============================================================
// CONCOX BINARY TCP SERVER
// Separate from createProtocolServer() because Concox uses binary
// framing (0x78/0x79 start bytes, 0x0D 0x0A stop bytes) rather
// than ASCII text with a single-character delimiter.
// ============================================================

/**
 * Create a TCP server dedicated to the Concox binary protocol.
 * Each socket maintains its own binary buffer and session IMEI.
 *
 * @param {number} port
 * @returns {net.Server}
 */
function createConcoxServer(port) {
  const server = net.createServer((socket) => {
    protocolStats['CONCOX'].totalConnectionAttempts++;
    protocolStats['CONCOX'].connections++;
    const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[TCP - CONCOX] Device connected: ${clientId}`);

    // Binary buffer — do NOT stringify, keep as Buffer
    let buffer = Buffer.alloc(0);
    // IMEI is unknown until we receive the Login (0x01) packet
    let sessionImei = null;

    socket.on('data', async (chunk) => {
      // Append binary chunk to running buffer
      buffer = Buffer.concat([buffer, chunk]);

      // Safety: prevent buffer overflow from malformed data (10 KB limit)
      if (buffer.length > 10240) {
        console.warn(`[TCP - CONCOX] Buffer overflow from ${clientId}, clearing`);
        buffer = Buffer.alloc(0);
        return;
      }

      // Parse all complete frames from the accumulated buffer
      let result;
      try {
        result = parseConcoxBuffer(buffer, sessionImei);
      } catch (err) {
        console.error(`[TCP - CONCOX] Frame parse error from ${clientId}:`, err.message);
        buffer = Buffer.alloc(0);
        return;
      }

      // Carry over any incomplete partial frame for next data event
      buffer = result.remainder;

      // Process each successfully parsed packet
      for (const packet of result.packets) {
        totalPacketsReceived++;
        await processConcoxPacket(packet, socket, clientId);
      }
    });

    socket.on('close', () => {
      protocolStats['CONCOX'].connections--;
      console.log(`[TCP - CONCOX] Device disconnected: ${clientId} (IMEI: ${sessionImei || 'unknown'})`);
      if (sessionImei) connectedDevices.delete(sessionImei);
    });

    socket.on('error', (err) => {
      console.error(`[TCP - CONCOX] Socket error from ${clientId}:`, err.message);
    });

    socket.setKeepAlive(true, 60000);
    socket.setTimeout(300000);
    socket.on('timeout', () => {
      console.log(`[TCP - CONCOX] Timeout for ${clientId}, closing connection`);
      socket.destroy();
    });

    // Closure over sessionImei so inner async callbacks can update it
    async function processConcoxPacket(packet, sock, cId) {
      try {
        // Publish raw message to raw_logs channel for Sensor Logs UI
        const currentImei = packet.imei || sessionImei;
        if (currentImei) {
          await publisher.publishRawMessage({
            ...packet,
            imei: currentImei
          }).catch(err => console.error(err));
        }

        switch (packet.packetType) {

          case 'CONCOX_LOGIN': {
            // Store IMEI for this socket session
            sessionImei = packet.imei;
            connectedDevices.set(sessionImei, { clientId: cId, lastPacket: new Date() });
            console.log(`[TCP - CONCOX] Login from IMEI ${sessionImei} (model: 0x${packet.modelCode.toString(16)})`);

            // MUST ACK within 5 seconds or device reboots
            const ack = buildLoginAck(packet.serialNumber);
            sock.write(ack);
            if (typeof protocolName !== 'undefined' && protocolStats[protocolName]) {
        protocolStats[protocolName].lastSuccessfulPacketAt = new Date().toISOString();
      } else if (protocolStats['CONCOX']) {
        protocolStats['CONCOX'].lastSuccessfulPacketAt = new Date().toISOString();
      }
      totalPacketsParsed++;
            break;
          }

          case 'CONCOX_HEARTBEAT': {
            // MUST ACK — device reboots after 3x missed heartbeats
            const ack = buildHeartbeatAck(packet.serialNumber, packet.rawPacketType);
            sock.write(ack);
            console.log(`[TCP - CONCOX] Heartbeat from ${sessionImei || 'unknown'} (batt: ${packet.battPercent}%, gsm: ${packet.gsmStrength}%)`);

            if (sessionImei) {
              const dev = connectedDevices.get(sessionImei) || { clientId: cId, lastPacket: new Date() };
              dev.battPercent = packet.battPercent;
              connectedDevices.set(sessionImei, dev);
            }

            if (typeof protocolName !== 'undefined' && protocolStats[protocolName]) {
        protocolStats[protocolName].lastSuccessfulPacketAt = new Date().toISOString();
      } else if (protocolStats['CONCOX']) {
        protocolStats['CONCOX'].lastSuccessfulPacketAt = new Date().toISOString();
      }
      totalPacketsParsed++;
            break;
          }

          case 'CONCOX_LOCATION': {
            if (!sessionImei) {
              console.warn(`[TCP - CONCOX] Location from ${cId} before login - dropping (no IMEI)`);
              totalPacketsInvalid++;
              break;
            }
            
            // Deep debug log for 0x8066 protocol research
            if (packet.rawCourse !== undefined) {
              console.log(`[TCP - CONCOX - DEBUG] IMEI ${sessionImei} location packet: rawCourse=0x${packet.rawCourse.toString(16)}, gpsValid=${packet.gpsValid}, lat=${packet.lat}, lng=${packet.lng}`);
            }

            if (packet.gpsValid !== 'A') {
              console.warn(`[TCP - CONCOX] Location from ${sessionImei}: GPS not fixed (Status: ${packet.gpsValid}). Dropping.`);
              totalPacketsInvalid++;
              break;
            }
            if (packet.lat === null || packet.lng === null ||
                Math.abs(packet.lat) > 90 || Math.abs(packet.lng) > 180) {
              console.warn(`[TCP - CONCOX] Location from ${sessionImei}: coords out of range`);
              totalPacketsInvalid++;
              break;
            }

            const device = connectedDevices.get(sessionImei) || { clientId: cId, lastPacket: new Date() };
            device.lat = packet.lat;
            device.lng = packet.lng;
            connectedDevices.set(sessionImei, device);

            let estimatedVoltage = 0;
            let currentBattery = 50;
            if (device.battPercent !== undefined) {
              currentBattery = device.battPercent;
              estimatedVoltage = parseFloat((3.6 + (currentBattery / 100) * 0.6).toFixed(2));
            }

            // Publish to Redis tracking channel (same as BSTPL/AIS140)
            // Per spec §3.2: location packet ACK is not mandatory — skipping.
            // TODO: implement PBSW (server-side history request) mode if required.
            await publisher.publishLocation({
              imei:      sessionImei,
              lat:       packet.lat,
              lng:       packet.lng,
              speed:     packet.speed,
              fuel:      packet.fuel,
              ignition:  packet.ignition,
              voltage:   packet.voltage || estimatedVoltage,
              direction: packet.direction,
              odometer:  packet.odometer || 0,
              satellites: packet.satellites,
              gsmSignal: packet.gsmSignal,
              battery:   currentBattery,
              deviceTime: packet.deviceTime,
              isLive:    packet.isLive,
            });
            if (typeof protocolName !== 'undefined' && protocolStats[protocolName]) {
        protocolStats[protocolName].lastSuccessfulPacketAt = new Date().toISOString();
      } else if (protocolStats['CONCOX']) {
        protocolStats['CONCOX'].lastSuccessfulPacketAt = new Date().toISOString();
      }
      totalPacketsParsed++;

            if (totalPacketsParsed % 100 === 0) {
              console.log(`[TCP] Stats: received=${totalPacketsReceived}, parsed=${totalPacketsParsed}, invalid=${totalPacketsInvalid}, devices=${connectedDevices.size}`);
            }
            break;
          }

          case 'CONCOX_ALARM':
          case 'CONCOX_ALARM_MULTI': {
            if (!sessionImei) {
              console.warn(`[TCP - CONCOX] Alarm from ${cId} before login — dropping`);
              totalPacketsInvalid++;
              break;
            }

            const dev = connectedDevices.get(sessionImei) || { clientId: cId, lastPacket: new Date() };
            dev.battPercent = packet.battery;
            connectedDevices.set(sessionImei, dev);

            // Send ACK — some firmware variants expect it even though spec says optional
            const ack = buildAlarmAck(packet.rawPacketType, packet.serialNumber);
            sock.write(ack);

            console.log(`[TCP - CONCOX] Alarm from ${sessionImei}: ${packet.alertText} (0x${packet.alarmCode.toString(16)})`);

            // Publish alert
            await publisher.publishAlert({
              imei:      sessionImei,
              alertType: packet.alertType,
              alertText: packet.alertText,
              lat:       packet.lat,
              lng:       packet.lng,
              deviceTime: packet.deviceTime,
            });

            // Also publish location if GPS fix is valid (alarm packets carry GPS data)
            if (packet.gpsValid === 'A' &&
                packet.lat !== null && packet.lng !== null &&
                Math.abs(packet.lat) <= 90 && Math.abs(packet.lng) <= 180) {
              
              let estimatedVoltage = 0;
              if (packet.battery !== undefined) {
                estimatedVoltage = parseFloat((3.6 + (packet.battery / 100) * 0.6).toFixed(2));
              }

              await publisher.publishLocation({
                imei:      sessionImei,
                lat:       packet.lat,
                lng:       packet.lng,
                speed:     packet.speed,
                fuel:      packet.fuel,
                ignition:  packet.ignition,
                voltage:   packet.voltage || estimatedVoltage,
                direction: packet.direction,
                odometer:  packet.odometer || 0,
                satellites: packet.satellites,
                gsmSignal: packet.gsmSignal,
                battery:   packet.battery,
                deviceTime: packet.deviceTime,
                isLive:    packet.isLive,
              });
            }
            if (typeof protocolName !== 'undefined' && protocolStats[protocolName]) {
        protocolStats[protocolName].lastSuccessfulPacketAt = new Date().toISOString();
      } else if (protocolStats['CONCOX']) {
        protocolStats['CONCOX'].lastSuccessfulPacketAt = new Date().toISOString();
      }
      totalPacketsParsed++;
            break;
          }

          case 'CONCOX_INFO': {
            // Information transmission (0x94): metadata enrichment only.
            // Log voltage, ICCID, fuel sensor — no Redis publish for now.
            // Future: use to enrich vehicle:state cache with voltage/fuel.
            if (packet.voltage !== null) {
              console.log(`[TCP - CONCOX] External voltage from ${sessionImei || 'unknown'}: ${packet.voltage}V`);
            }
            if (packet.iccid) {
              console.log(`[TCP - CONCOX] ICCID from ${sessionImei || 'unknown'}: ${packet.iccid}`);
            }
            if (packet.sensorData) {
              console.log(`[TCP - CONCOX] Fuel sensor from ${sessionImei || 'unknown'}:`, packet.sensorData);
            }
            if (typeof protocolName !== 'undefined' && protocolStats[protocolName]) {
        protocolStats[protocolName].lastSuccessfulPacketAt = new Date().toISOString();
      } else if (protocolStats['CONCOX']) {
        protocolStats['CONCOX'].lastSuccessfulPacketAt = new Date().toISOString();
      }
      totalPacketsParsed++;
            break;
          }

          case 'CONCOX_TIME_CHECK':
            // 0x8A: device asks for current time — no response (per spec, GPS calibrates time)
            if (typeof protocolName !== 'undefined' && protocolStats[protocolName]) {
        protocolStats[protocolName].lastSuccessfulPacketAt = new Date().toISOString();
      } else if (protocolStats['CONCOX']) {
        protocolStats['CONCOX'].lastSuccessfulPacketAt = new Date().toISOString();
      }
      totalPacketsParsed++;
            break;

          case 'CONCOX_COMMAND_RESPONSE':
          case 'CONCOX_ONLINE_COMMAND':
          case 'CONCOX_ASCII_MESSAGE':
            // Ignored/logged at the parser level
            if (typeof protocolName !== 'undefined' && protocolStats[protocolName]) {
              protocolStats[protocolName].lastSuccessfulPacketAt = new Date().toISOString();
            } else if (protocolStats['CONCOX']) {
              protocolStats['CONCOX'].lastSuccessfulPacketAt = new Date().toISOString();
            }
            totalPacketsParsed++;
            break;

          default:
            console.warn(`[TCP - CONCOX] Unhandled packet type: ${packet.packetType}`);
            totalPacketsInvalid++;
        }
      } catch (err) {
        totalPacketsInvalid++;
        console.error(`[TCP - CONCOX] Processing error from ${cId}:`, err.message);
      }
    }
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`============================================================`);
    console.log(`  [TCP - CONCOX] Server started successfully`);
    console.log(`  Listening on port: ${port}`);
    console.log(`  Protocol: Binary (0x78/0x79 framing, CRC-ITU)`);
    console.log(`============================================================`);
  });

  return server;
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Log stats every 60 seconds
setInterval(() => {
  if (totalPacketsReceived > 0) {
    console.log(`[TCP] Periodic stats: received=${totalPacketsReceived}, parsed=${totalPacketsParsed}, invalid=${totalPacketsInvalid}, connected=${connectedDevices.size}`);
  }
}, 60000);

// ============================================================
// HEALTH ENDPOINT SERVER
// ============================================================
const HEALTH_PORT = process.env.TCP_HEALTH_PORT || 5050;
const healthServer = http.createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'OK',
      bstplConnections: protocolStats['BSTPL-17'].connections,
      ais140Connections: protocolStats['AIS140'].connections,
      concoxConnections: protocolStats['CONCOX'].connections,
      stats: protocolStats
    }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

healthServer.listen(HEALTH_PORT, '0.0.0.0', () => {
  console.log(`============================================================`);
  console.log(`  [TCP - HEALTH] Health server started`);
  console.log(`  Listening on port: ${HEALTH_PORT}`);
  console.log(`============================================================`);
});

module.exports = { bstplServer, ais140Server, concoxServer, healthServer };
