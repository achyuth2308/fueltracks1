// ============================================================
// VOLTYFUEL SERVER HANDLER
// Dedicated TCP server for TranSync NAV 140 binary protocol
// Port: VOLTYFUEL_TCP_PORT (default 5011)
//
// Protocol summary:
//   Start: 3A 3A  |  Stop: 23 23  |  Length field at bytes 2-3
//   Type 0x10 = GPS data (device->server), ACK with 0x11
//   Type 0x40 = Command request/downlink
//   Type 0x47 = Command response from device
// ============================================================

'use strict';

const net = require('net');
const {
  extractFrames,
  parseVoltyFuelFrame,
  buildGpsDataAck,
} = require('./parser/voltyFuelParser');

/**
 * Per-device sequence counter for outbound command frames.
 * Stores last used seq number; increments with wrap at 65535.
 */
const deviceSeqCounters = new Map(); // imei => number

function nextSeq(imei) {
  const current = deviceSeqCounters.get(imei) || 0;
  const next = (current + 1) & 0xFFFF;
  deviceSeqCounters.set(imei, next);
  return next;
}

/**
 * Initialize the VoltyFuel TCP server.
 *
 * @param {number|string} port           TCP port to listen on (default 5011)
 * @param {object}        protocolStats  Shared protocol stats map from server.js
 * @param {Map}           connectedDevices Shared connected-device registry
 * @param {object}        publisher      Redis publisher instance
 * @returns {net.Server}
 */
function initVoltyFuelServer(port, protocolStats, connectedDevices, publisher) {
  const PROTO = 'VOLTYFUEL';

  if (!protocolStats[PROTO]) {
    protocolStats[PROTO] = { totalConnectionAttempts: 0, lastSuccessfulPacketAt: null, connections: 0 };
  }

  const server = net.createServer((socket) => {
    protocolStats[PROTO].totalConnectionAttempts++;
    protocolStats[PROTO].connections++;

    const clientId = socket.remoteAddress + ':' + socket.remotePort;
    console.log('[TCP - ' + PROTO + '] Device connected: ' + clientId);

    // Binary accumulation buffer — never toString()
    let rxBuffer = Buffer.alloc(0);
    let sessionImei = null;

    socket.on('data', async (chunk) => {
      rxBuffer = Buffer.concat([rxBuffer, chunk]);

      // Safety: clear buffer if it grows excessively (corrupt stream)
      if (rxBuffer.length > 65536) {
        console.warn('[TCP - ' + PROTO + '] Buffer overflow from ' + clientId + ', clearing');
        rxBuffer = Buffer.alloc(0);
        return;
      }

      // Extract complete frames from the stream
      let extracted;
      try {
        extracted = extractFrames(rxBuffer);
      } catch (err) {
        console.error('[TCP - ' + PROTO + '] Frame extraction error from ' + clientId + ':', err.message);
        rxBuffer = Buffer.alloc(0);
        return;
      }

      rxBuffer = extracted.remainder;

      for (const frame of extracted.frames) {
        await processFrame(frame, socket, clientId);
      }
    });

    socket.on('close', () => {
      if (protocolStats[PROTO]) protocolStats[PROTO].connections = Math.max(0, protocolStats[PROTO].connections - 1);
      console.log('[TCP - ' + PROTO + '] Device disconnected: ' + clientId + ' (IMEI: ' + (sessionImei || 'unknown') + ')');
      if (sessionImei) {
        const existing = connectedDevices.get(sessionImei);
        if (existing && existing.socket === socket) {
          connectedDevices.delete(sessionImei);
        }
      }
      // Sweep for stale entries by socket reference
      for (const [imei, info] of connectedDevices.entries()) {
        if (info.socket === socket || info.clientId === clientId) {
          connectedDevices.delete(imei);
          break;
        }
      }
    });

    socket.on('error', (err) => {
      console.error('[TCP - ' + PROTO + '] Socket error from ' + clientId + ':', err.message);
    });

    socket.setKeepAlive(true, 60000);
    socket.setTimeout(300000); // 5 minutes idle timeout
    socket.on('timeout', () => {
      console.log('[TCP - ' + PROTO + '] Timeout for ' + clientId + ', closing');
      socket.destroy();
    });

    // ── Per-connection frame processor ───────────────────────

    async function processFrame(frame, sock, cId) {
      try {
        const parsed = parseVoltyFuelFrame(frame);

        if (!parsed) {
          console.warn('[TCP - ' + PROTO + '] Unrecognised frame from ' + cId + ': ' + frame.toString('hex').toUpperCase().substring(0, 40));
          return;
        }

        // Register / refresh session IMEI
        if (parsed.imei && parsed.imei !== sessionImei) {
          sessionImei = parsed.imei;
          // Destroy stale socket for same IMEI if any
          const existing = connectedDevices.get(sessionImei);
          if (existing && existing.socket && existing.socket !== sock) {
            console.log('[TCP - ' + PROTO + '] Destroying stale zombie socket for IMEI ' + sessionImei);
            try { existing.socket.destroy(); } catch (e) {}
          }
          connectedDevices.set(sessionImei, {
            socket:       sock,
            clientId:     cId,
            protocolName: PROTO,
            lastPacket:   new Date(),
          });
        }

        // Publish raw log for Sensor Logs UI
        if (parsed.imei) {
          publisher.publishRawMessage({
            ...parsed,
            rawString: frame.toString('hex').toUpperCase(),
          }).catch((err) => console.error('[' + PROTO + '] Raw log publish error:', err.message));
        }

        // ── Dispatch by packet type ───────────────────────────

        switch (parsed.packetType) {

          case 'VOLTYFUEL_NORMAL': {
            // Per Volty / TranSync manufacturer advice: DO NOT send TCP ACK replies
            // for normal GPS/telemetry data frames. Sending replies to the TCP socket
            // disturbs the tracker firmware, causing a watchdog reboot (BOT) and GPS shutdown.
            // (We keep buildGpsDataAck available if ever explicitly required for specific firmware).

            const isValidGps = parsed.gpsValid === 'A'
              && parsed.lat !== null && parsed.lng !== null;

            // Update connected device record
            const devEntry = {
              socket:       sock,
              clientId:     cId,
              protocolName: PROTO,
              lastPacket:   new Date(),
            };
            if (isValidGps) {
              devEntry.lat = parsed.lat;
              devEntry.lng = parsed.lng;
            }
            connectedDevices.set(parsed.imei, devEntry);

            // Always publish location/telemetry so fuel, ignition, and battery state update
            // even when the vehicle is parked stationary or indoors without 3D GPS fix.
            // publisher.publishLocation already handles null/cached coordinates safely.
            await publisher.publishLocation(parsed);
            if (!isValidGps) {
              console.log('[TCP - ' + PROTO + '] IMEI ' + parsed.imei + ': GPS not fixed (status-only / stationary). Fuel=' + parsed.fuel + ', V=' + parsed.voltage);
            }

            if (parsed.alertType) {
              await publisher.publishAlert(parsed);
              console.log('[TCP - ' + PROTO + '] Alert from ' + parsed.imei + ': ' + parsed.alertType + ' - ' + parsed.alertText);
            }

            if (protocolStats[PROTO]) protocolStats[PROTO].lastSuccessfulPacketAt = new Date().toISOString();
            break;
          }

          case 'VOLTYFUEL_CMD_RESP': {
            // Device acknowledged a command we sent
            console.log('[TCP - ' + PROTO + '] Command response from ' + parsed.imei + ' (seq=' + parsed.seqNum + '): ' + parsed.command);
            if (parsed.imei) {
              publisher.publishRawMessage({
                imei:       parsed.imei,
                packetType: 'VOLTYFUEL_CMD_RESP',
                rawString:  parsed.command,
                rawPacket:  parsed.rawPacket,
                parsed:     true,
              }).catch(() => {});
            }
            if (protocolStats[PROTO]) protocolStats[PROTO].lastSuccessfulPacketAt = new Date().toISOString();
            break;
          }

          case 'VOLTYFUEL_CMD_REQ': {
            // Unexpected: device initiated a command request to us — log only
            console.log('[TCP - ' + PROTO + '] CMD_REQ from device ' + parsed.imei + ': ' + parsed.command);
            if (protocolStats[PROTO]) protocolStats[PROTO].lastSuccessfulPacketAt = new Date().toISOString();
            break;
          }

          default:
            console.warn('[TCP - ' + PROTO + '] Unhandled packet type: ' + parsed.packetType);
            break;
        }

      } catch (err) {
        console.error('[TCP - ' + PROTO + '] Frame processing error from ' + cId + ':', err.message);
      }
    }
  });

  server.listen(port, '0.0.0.0', () => {
    console.log('============================================================');
    console.log('  [TCP - ' + PROTO + '] Server started successfully');
    console.log('  Listening on port: ' + port);
    console.log('  Protocol: TranSync NAV 140 Binary (3A3A..2323)');
    console.log('============================================================');
  });

  return server;
}

module.exports = { initVoltyFuelServer, nextSeq };