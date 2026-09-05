'use strict';

const net = require('net');
const {
  parsePt06Buffer,
  buildLoginAck,
  buildHeartbeatAck,
  buildAlarmAck,
} = require('./parser/pt06Parser');

function initPt06Server(port, protocolStats, connectedDevices, publisher) {
  const server = net.createServer((socket) => {
    if (!protocolStats['PT06']) {
      protocolStats['PT06'] = { totalConnectionAttempts: 0, lastSuccessfulPacketAt: null, connections: 0 };
    }
    protocolStats['PT06'].totalConnectionAttempts++;
    protocolStats['PT06'].connections++;
    const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[TCP - PT06] Device connected: ${clientId}`);

    let buffer = Buffer.alloc(0);
    let sessionImei = null;

    socket.on('data', async (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);

      if (buffer.length > 10240) {
        console.warn(`[TCP - PT06] Buffer overflow from ${clientId}, clearing`);
        buffer = Buffer.alloc(0);
        return;
      }

      let result;
      try {
        result = parsePt06Buffer(buffer, sessionImei);
      } catch (err) {
        console.error(`[TCP - PT06] Frame parse error from ${clientId}:`, err.message);
        buffer = Buffer.alloc(0);
        return;
      }

      buffer = result.remainder;

      for (const packet of result.packets) {
        await processPt06Packet(packet, socket, clientId);
      }
    });

    socket.on('close', () => {
      protocolStats['PT06'].connections--;
      console.log(`[TCP - PT06] Device disconnected: ${clientId} (IMEI: ${sessionImei || 'unknown'})`);
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
      console.error(`[TCP - PT06] Socket error from ${clientId}:`, err.message);
    });

    socket.setKeepAlive(true, 60000);
    socket.setTimeout(300000);
    socket.on('timeout', () => {
      console.log(`[TCP - PT06] Timeout for ${clientId}, closing connection`);
      socket.destroy();
    });

    async function processPt06Packet(packet, sock, cId) {
      try {
        const currentImei = packet.imei || sessionImei;
        if (currentImei) {
          await publisher.publishRawMessage({
            ...packet,
            imei: currentImei
          }).catch(err => console.error(err));
        }

        switch (packet.packetType) {
          case 'PT06_LOGIN': {
            sessionImei = packet.imei;
            connectedDevices.set(sessionImei, { socket: sock, clientId: cId, protocolName: 'PT06', lastPacket: new Date() });
            console.log(`[TCP - PT06] Login from IMEI ${sessionImei}`);

            const ack = buildLoginAck(packet.serialNumber);
            sock.write(ack);
            if (protocolStats['PT06']) protocolStats['PT06'].lastSuccessfulPacketAt = new Date().toISOString();
            break;
          }

          case 'PT06_HEARTBEAT': {
            const ack = buildHeartbeatAck(packet.serialNumber, packet.rawPacketType);
            sock.write(ack);
            console.log(`[TCP - PT06] Heartbeat from ${sessionImei || 'unknown'}`);

            if (sessionImei) {
              connectedDevices.set(sessionImei, { socket: sock, clientId: cId, protocolName: 'PT06', lastPacket: new Date() });
              await publisher.publishHeartbeat(
                sessionImei, packet.battPercent, packet.gsmStrength, packet.ignition,
                packet.deviceTime, packet.rawPacket, packet.packetType
              );
            }
            if (protocolStats['PT06']) protocolStats['PT06'].lastSuccessfulPacketAt = new Date().toISOString();
            break;
          }

          case 'PT06_LOCATION': {
            if (!sessionImei) {
              console.warn(`[TCP - PT06] Location from ${cId} before login - dropping (no IMEI)`);
              break;
            }

            if (packet.gpsValid !== 'A') {
              console.log(`[TCP - PT06] Location from ${sessionImei}: GPS not fixed. Publishing heartbeat.`);
              if (sessionImei) {
                connectedDevices.set(sessionImei, { socket: sock, clientId: cId, protocolName: 'PT06', lastPacket: new Date() });
                await publisher.publishHeartbeat(
                  sessionImei, packet.battPercent, packet.gsmStrength, packet.ignition,
                  packet.deviceTime, packet.rawPacket, packet.packetType
                );
              }
              break;
            }

            const device = connectedDevices.get(sessionImei) || { clientId: cId, lastPacket: new Date() };
            device.socket = sock;
            device.protocolName = 'PT06';
            device.lat = packet.lat;
            device.lng = packet.lng;
            connectedDevices.set(sessionImei, device);

            await publisher.publishLocation({
              imei:      sessionImei,
              lat:       packet.lat,
              lng:       packet.lng,
              speed:     packet.speed,
              fuel:      packet.fuel,
              ignition:  packet.ignition,
              voltage:   packet.voltage || device.voltage || null,
              direction: packet.direction,
              odometer:  packet.odometer || 0,
              satellites: packet.satellites,
              gsmSignal: packet.gsmSignal,
              battery:   packet.battery,
              deviceTime: packet.deviceTime,
              isLive:    packet.isLive,
            });
            if (protocolStats['PT06']) protocolStats['PT06'].lastSuccessfulPacketAt = new Date().toISOString();
            break;
          }

          case 'PT06_ALARM': {
            if (!sessionImei) break;
            const ack = buildAlarmAck(packet.rawPacketType, packet.serialNumber);
            sock.write(ack);
            console.log(`[TCP - PT06] Alarm from ${sessionImei}: ${packet.alertText}`);

            const alarmDevice = connectedDevices.get(sessionImei) || {};
            alarmDevice.socket = sock;
            alarmDevice.protocolName = 'PT06';
            connectedDevices.set(sessionImei, alarmDevice);

            await publisher.publishAlert({
              imei:      sessionImei,
              alertType: packet.alertType,
              alertText: packet.alertText,
              lat:       packet.lat || alarmDevice.lat || 0,
              lng:       packet.lng || alarmDevice.lng || 0,
              speed:     packet.speed || 0,
              deviceTime: packet.deviceTime,
            });
            if (protocolStats['PT06']) protocolStats['PT06'].lastSuccessfulPacketAt = new Date().toISOString();
            break;
          }
        }
      } catch (err) {
        console.error(`[TCP - PT06] Inner process error:`, err.message);
      }
    }
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`============================================================`);
    console.log(`  [TCP - PT06] Server started`);
    console.log(`  Listening on port: ${port}`);
    console.log(`============================================================`);
  });

  return server;
}

module.exports = { initPt06Server };
