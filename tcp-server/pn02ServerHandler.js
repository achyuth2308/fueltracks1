'use strict';

const net = require('net');
const {
  parsePn02Buffer,
  buildPn02Ack,
} = require('./parser/pn02Parser');

function initPn02Server(port, protocolStats, connectedDevices, publisher) {
  const server = net.createServer((socket) => {
    if (!protocolStats['PN02']) {
      protocolStats['PN02'] = { totalConnectionAttempts: 0, lastSuccessfulPacketAt: null, connections: 0 };
    }
    protocolStats['PN02'].totalConnectionAttempts++;
    protocolStats['PN02'].connections++;
    const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[TCP - PN02] Device connected: ${clientId}`);

    let buffer = Buffer.alloc(0);
    let sessionImei = null;

    socket.on('data', async (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);

      if (buffer.length > 10240) {
        console.warn(`[TCP - PN02] Buffer overflow from ${clientId}, clearing`);
        buffer = Buffer.alloc(0);
        return;
      }

      let result;
      try {
        result = parsePn02Buffer(buffer, sessionImei);
      } catch (err) {
        console.error(`[TCP - PN02] Frame parse error from ${clientId}:`, err.message);
        buffer = Buffer.alloc(0);
        return;
      }

      buffer = result.remainder;

      for (const packet of result.packets) {
        await processPn02Packet(packet, socket, clientId);
      }
    });

    socket.on('close', () => {
      protocolStats['PN02'].connections--;
      console.log(`[TCP - PN02] Device disconnected: ${clientId} (IMEI: ${sessionImei || 'unknown'})`);
      if (sessionImei) {
        const existing = connectedDevices.get(sessionImei);
        if (existing && existing.socket === socket) {
          connectedDevices.delete(sessionImei);
        }
      }
      for (const [imei, info] of connectedDevices.entries()) {
        if (info.socket === socket || info.clientId === clientId) {
          connectedDevices.delete(imei);
          break;
        }
      }
    });

    socket.on('error', (err) => {
      console.error(`[TCP - PN02] Socket error from ${clientId}:`, err.message);
    });

    socket.setKeepAlive(true, 60000);
    socket.setTimeout(300000);
    socket.on('timeout', () => {
      console.log(`[TCP - PN02] Timeout for ${clientId}, closing connection`);
      socket.destroy();
    });

    async function processPn02Packet(packet, sock, cId) {
      try {
        const currentImei = packet.imei || sessionImei;
        if (currentImei) {
          await publisher.publishRawMessage({
            ...packet,
            imei: currentImei
          }).catch(err => console.error(err));
        }

        // Handle Protocol Acknowledgements
        if (packet.packetType === 'PN02_LOGIN') {
          sessionImei = packet.imei;
          connectedDevices.set(sessionImei, { socket: sock, clientId: cId, protocolName: 'PN02', lastPacket: new Date() });
          console.log(`[TCP - PN02] Login from IMEI ${sessionImei}`);
          const ack = buildPn02Ack(packet.rawPacketType, packet.serialNumber, currentImei);
          sock.write(ack);
          if (protocolStats['PN02']) protocolStats['PN02'].lastSuccessfulPacketAt = new Date().toISOString();
        } 
        else if (packet.packetType === 'PN02_HEARTBEAT' || packet.packetType === 'PN02_ALARM') {
          // Heartbeat and Alarms require ACK
          if (protocolStats['PN02']) protocolStats['PN02'].lastSuccessfulPacketAt = new Date().toISOString();
          if (currentImei) {
            const ack = buildPn02Ack(packet.rawPacketType, packet.serialNumber, currentImei);
            sock.write(ack);
          }
        }
        else if (packet.packetType === 'PN02_POSITION') {
          // Normal position messages do NOT require ACK per protocol spec
          if (protocolStats['PN02']) protocolStats['PN02'].lastSuccessfulPacketAt = new Date().toISOString();
        }

      } catch (e) {
        console.error(`[TCP - PN02] Process packet error:`, e.message);
      }
    }
  });

  server.listen(port, () => {
    console.log(`[TCP - PN02] Parser listening on port ${port}`);
  });

  return server;
}

module.exports = {
  initPn02Server
};
