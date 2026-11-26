// ============================================================
// B20 SERVER HANDLER
// Dedicated TCP server for B20 OBD-II GPS Tracker (JT808 / GB/T 19056)
// Port: B20_TCP_PORT (default 5013)
// ============================================================

'use strict';

const net = require('net');
const {
  extractB20Frames,
  parseB20Frame,
  buildUniversalResponse,
  buildRegisterResponse,
  MSG_REGISTER,
  MSG_AUTH,
  MSG_HEARTBEAT,
  MSG_LOCATION
} = require('./parser/b20Parser');

/**
 * Per-device server sequence counter for outbound B20 frames.
 */
const deviceSeqCounters = new Map();

function getNextServerSeq(imei) {
  const cur = deviceSeqCounters.get(imei) || 0;
  const next = (cur + 1) & 0xFFFF;
  deviceSeqCounters.set(imei, next);
  return next;
}

/**
 * Initialize the B20 TCP Server
 *
 * @param {number|string} port           TCP port (default 5013)
 * @param {object}        protocolStats  Shared protocol stats map
 * @param {Map}           connectedDevices Shared connected-device registry
 * @param {object}        publisher      Redis publisher instance
 * @returns {net.Server}
 */
function initB20Server(port, protocolStats, connectedDevices, publisher) {
  const PROTO = 'B20';

  if (!protocolStats[PROTO]) {
    protocolStats[PROTO] = { totalConnectionAttempts: 0, lastSuccessfulPacketAt: null, connections: 0 };
  }

  const server = net.createServer((socket) => {
    protocolStats[PROTO].totalConnectionAttempts++;
    protocolStats[PROTO].connections++;

    const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[TCP - ${PROTO}] Device connected: ${clientId}`);

    // Binary accumulation buffer for handling TCP stream fragmentation
    let rxBuffer = Buffer.alloc(0);
    let sessionImei = null;

    socket.on('data', async (chunk) => {
      rxBuffer = Buffer.concat([rxBuffer, chunk]);

      // Buffer overflow protection against malformed stream
      if (rxBuffer.length > 65536) {
        console.warn(`[TCP - ${PROTO}] Buffer overflow from ${clientId}, clearing`);
        rxBuffer = Buffer.alloc(0);
        return;
      }

      let extracted;
      try {
        extracted = extractB20Frames(rxBuffer);
      } catch (err) {
        console.error(`[TCP - ${PROTO}] Frame extraction error from ${clientId}:`, err.message);
        rxBuffer = Buffer.alloc(0);
        return;
      }

      rxBuffer = extracted.remainder;

      for (const frame of extracted.frames) {
        await processFrame(frame, socket, clientId);
      }
    });

    socket.on('close', () => {
      if (protocolStats[PROTO]) {
        protocolStats[PROTO].connections = Math.max(0, protocolStats[PROTO].connections - 1);
      }
      console.log(`[TCP - ${PROTO}] Device disconnected: ${clientId} (IMEI: ${sessionImei || 'unknown'})`);
      if (sessionImei) {
        const existing = connectedDevices.get(sessionImei);
        if (existing && existing.socket === socket) {
          connectedDevices.delete(sessionImei);
        }
      }
    });

    socket.on('error', (err) => {
      console.warn(`[TCP - ${PROTO}] Socket error from ${clientId}:`, err.message);
    });

    socket.setKeepAlive(true, 60000);
    socket.setTimeout(300000); // 5 minutes idle timeout
    socket.on('timeout', () => {
      console.log(`[TCP - ${PROTO}] Idle timeout for ${clientId}, closing socket`);
      socket.destroy();
    });

    // ── Frame Processor ───────────────────────────────────────
    async function processFrame(frame, sock, cId) {
      try {
        const parsed = parseB20Frame(frame);
        if (!parsed) {
          console.warn(`[TCP - ${PROTO}] Invalid or unparseable frame from ${cId}`);
          return;
        }

        const imei = parsed.imei;
        if (imei && imei !== sessionImei) {
          sessionImei = imei;
          const existing = connectedDevices.get(sessionImei);
          if (existing && existing.socket && existing.socket !== sock) {
            try { existing.socket.destroy(); } catch (e) {}
          }
          connectedDevices.set(sessionImei, {
            socket: sock,
            clientId: cId,
            protocolName: PROTO,
            lastPacket: new Date()
          });
        }

        // Always publish raw frame hex for Sensor Logs UI
        if (imei) {
          publisher.publishRawMessage({
            ...parsed,
            rawString: frame.toString('hex').toUpperCase(),
            rawPacket: frame.toString('hex').toUpperCase(),
            parsed: true
          }).catch(err => console.error(`[TCP - ${PROTO}] Raw publish error:`, err.message));
        }

        // ── Dispatch by JT808 Message ID ──────────────────────
        const serverSeq = getNextServerSeq(imei || 'default');

        switch (parsed.msgIdNum) {
          // 0x0100: Terminal Registration
          case MSG_REGISTER: {
            console.log(`[TCP - ${PROTO}] Register request from ${imei} (seq=${parsed.seqNum})`);
            const authCode = `TR${imei ? imei.slice(-8) : '00000001'}`;
            const ack = buildRegisterResponse(imei, parsed.seqNum, serverSeq, 0, authCode);
            sock.write(ack);
            if (protocolStats[PROTO]) protocolStats[PROTO].lastSuccessfulPacketAt = new Date().toISOString();
            break;
          }

          // 0x0102: Terminal Authentication
          case MSG_AUTH: {
            console.log(`[TCP - ${PROTO}] Authentication request from ${imei} (seq=${parsed.seqNum})`);
            const ack = buildUniversalResponse(imei, parsed.seqNum, MSG_AUTH, serverSeq, 0);
            sock.write(ack);
            if (protocolStats[PROTO]) protocolStats[PROTO].lastSuccessfulPacketAt = new Date().toISOString();
            break;
          }

          // 0x0002: Heartbeat
          case MSG_HEARTBEAT: {
            console.log(`[TCP - ${PROTO}] Heartbeat from ${imei} (seq=${parsed.seqNum})`);
            const ack = buildUniversalResponse(imei, parsed.seqNum, MSG_HEARTBEAT, serverSeq, 0);
            sock.write(ack);

            if (imei) {
              await publisher.publishHeartbeat(
                imei,
                parsed.voltage || 12.0,
                parsed.gsmSignal || 100,
                parsed.ignition || false,
                parsed.deviceTime || new Date().toISOString(),
                frame.toString('hex').toUpperCase(),
                'B20_HEARTBEAT'
              );
            }
            if (protocolStats[PROTO]) protocolStats[PROTO].lastSuccessfulPacketAt = new Date().toISOString();
            break;
          }

          // 0x0200: Location & OBD Telemetry
          case MSG_LOCATION: {
            // Send 0x8001 Universal ACK
            const ack = buildUniversalResponse(imei, parsed.seqNum, MSG_LOCATION, serverSeq, 0);
            sock.write(ack);

            const hasValidGps = (parsed.gpsValid === 'A' || parsed.gpsValid === true)
              && parsed.lat !== 0 && parsed.lng !== 0
              && Math.abs(parsed.lat) <= 90 && Math.abs(parsed.lng) <= 180;

            const devEntry = {
              socket: sock,
              clientId: cId,
              protocolName: PROTO,
              lastPacket: new Date()
            };
            if (hasValidGps) {
              devEntry.lat = parsed.lat;
              devEntry.lng = parsed.lng;
            }
            connectedDevices.set(imei, devEntry);

            if (hasValidGps) {
              await publisher.publishLocation(parsed);
            } else {
              // Stationary or indoor without 3D fix: publish heartbeat with battery/ignition/fuel
              console.log(`[TCP - ${PROTO}] IMEI ${imei}: GPS not fixed (lat/lng 0). Publishing telemetry.`);
              await publisher.publishLocation(parsed); // publisher.publishLocation safely handles and caches coordinates
            }

            if (parsed.alertType) {
              await publisher.publishAlert(parsed);
              console.log(`[TCP - ${PROTO}] Alert from ${imei}: ${parsed.alertType}`);
            }

            if (protocolStats[PROTO]) protocolStats[PROTO].lastSuccessfulPacketAt = new Date().toISOString();
            break;
          }

          default: {
            // General Universal ACK for other tracker reports
            console.log(`[TCP - ${PROTO}] Unhandled MsgId ${parsed.msgId} from ${imei}`);
            const ack = buildUniversalResponse(imei, parsed.seqNum, parsed.msgIdNum, serverSeq, 0);
            sock.write(ack);
            if (protocolStats[PROTO]) protocolStats[PROTO].lastSuccessfulPacketAt = new Date().toISOString();
            break;
          }
        }
      } catch (err) {
        console.error(`[TCP - ${PROTO}] Error processing frame:`, err.message);
      }
    }
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`============================================================`);
    console.log(`  [TCP - ${PROTO}] Server started successfully`);
    console.log(`  Listening on port: ${port}`);
    console.log(`  Protocol: B20 OBD-II GPS Tracker (JT808 / GB/T 19056)`);
    console.log(`============================================================`);
  });

  return server;
}

module.exports = { initB20Server };
