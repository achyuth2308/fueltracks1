// ============================================================
// TCP SERVER - FuelTracks
// Receives raw GPS packets from devices on isolated ports:
// - Port 5000: BSTPL-17 (uses # delimiter)
// - Port 5001: AIS140 V1 / tNavIC (uses * delimiter)
// - Port 5002: Concox V5/VL149/GT800 (binary protocol)
// - Port 5003: AIS140 V2 (MODEL NO:1819001A) (uses * or $ delimiter)
// - Port 5005: Teltonika FMB920 (binary protocol)
// ============================================================

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const net = require('net');
const http = require('http');
const { parsePacket } = require('./parser');

const protocolStats = {
  'BSTPL-17':  { totalConnectionAttempts: 0, lastSuccessfulPacketAt: null, connections: 0 },
  'AIS140':    { totalConnectionAttempts: 0, lastSuccessfulPacketAt: null, connections: 0 },
  'AIS140V2':  { totalConnectionAttempts: 0, lastSuccessfulPacketAt: null, connections: 0 },
  'CONCOX':    { totalConnectionAttempts: 0, lastSuccessfulPacketAt: null, connections: 0 },
  'VOLTY':     { totalConnectionAttempts: 0, lastSuccessfulPacketAt: null, connections: 0 },
  'FMB920':    { totalConnectionAttempts: 0, lastSuccessfulPacketAt: null, connections: 0 }
};
const Redis = require('ioredis');
const { validateNormalPacket, validateAlertPacket, validateAis140EmergencyPacket } = require('./utils/packetValidator');
const publisher = require('./publisher');
const voltyRelay = require('./voltyRelay');

const BSTPL_PORT    = process.env.TCP_PORT || 5000;
const AIS140_PORT   = process.env.AIS140_TCP_PORT || 5001;
const CONCOX_PORT   = parseInt(process.env.CONCOX_TCP_PORT) || 5002;
const AIS140V2_PORT = parseInt(process.env.AIS140V2_TCP_PORT) || 5003;
const VOLTY_PORT    = parseInt(process.env.VOLTY_TCP_PORT) || 5004;
const FMB920_PORT   = parseInt(process.env.FMB920_TCP_PORT) || 5005;

// Concox binary parser + ACK & command builders
const {
  parseConcoxBuffer,
  buildLoginAck,
  buildHeartbeatAck,
  buildAlarmAck,
  buildOnlineCommand
} = require('./parser/concoxParser');

// FMB920 binary parser + Codec 12 command builder
const {
  isImeiPacket,
  parseImeiPacket,
  parseCodec8Packet,
  buildCodec12Command
} = require('./parser/fmb920Parser');

// Track connected devices
const connectedDevices = new Map(); // imei → { socket, clientId, protocolName, lastPacket }
let totalPacketsReceived = 0;
let totalPacketsParsed = 0;
let totalPacketsInvalid = 0;

// ============================================================
// COMMAND ADAPTERS  (Fix 4)
// One entry per protocol. Each adapter exposes immobilize() and
// mobilize() returning the exact ASCII string to write to the socket.
// Add a new entry here when onboarding a new vendor — do NOT add
// another branch to the dispatch logic below.
// ============================================================
const commandAdapters = {
  CONCOX: {
    // Binary — handled separately via buildOnlineCommand(); sentinel value
    immobilize: () => '__CONCOX_BINARY__',
    mobilize:   () => '__CONCOX_BINARY__',
  },
  FMB920: {
    // Binary — handled separately via buildCodec12Command(); sentinel value
    immobilize: () => '__FMB920_BINARY_IMMOBILIZE__',
    mobilize:   () => '__FMB920_BINARY_MOBILIZE__',
  },
  'BSTPL-17': {
    immobilize: () => '$SET,RL,1#\r\n',
    mobilize:   () => '$SET,RL,0#\r\n',
  },
  AIS140: {
    // TNavic relay — NC (Normally Closed) wiring
    // RL:1 = energize coil → NC OPENS → power CUT   → IMMOBILIZE
    // RL:0 = de-energize  → NC CLOSES → power FLOWS → MOBILIZE
    immobilize: () => 'RL:1\r\n',
    mobilize:   () => 'RL:0\r\n',
  },
  AIS140V2: {
    // Model No: 1819001A (AIS140 Protocol Document V2.0)
    // Section 36: STARTELEC1 (turn on relay) / STOPELEC1 (turn off relay)
    immobilize: () => 'STOPELEC1\r\n',
    mobilize:   () => 'STARTELEC1\r\n',
  },
  VOLTY: {
    // Volty/TNavic relay — NC (Normally Closed) wiring
    // RL:1 = energize coil → NC OPENS → power CUT   → IMMOBILIZE
    // RL:0 = de-energize  → NC CLOSES → power FLOWS → MOBILIZE
    immobilize: () => 'RL:1\r\n',
    mobilize:   () => 'RL:0\r\n',
  },
};

// ============================================================
// PENDING COMMAND QUEUE  (Fix 3)
// When a command arrives but the device is offline, we park it here.
// When that IMEI registers a new socket we auto-fire and clear it.
// Entries older than PENDING_CMD_TTL_MS are silently expired.
// ============================================================
const PENDING_CMD_TTL_MS = 2 * 60 * 1000; // 2 minutes
const pendingCommands = new Map(); // imei → { action, protocol, queuedAt }

/**
 * Register (or replace) a device socket in connectedDevices.
 * Called synchronously as soon as we know the IMEI — before any async work.
 * If a pending command exists for this IMEI and it's still fresh, auto-fires it.
 */
function registerDeviceSocket(imei, socket, clientId, protocolName) {
  // CRITICAL FIX: Destroy stale socket to prevent silent file descriptor / memory leak
  const existing = connectedDevices.get(imei);
  if (existing && existing.socket && existing.socket !== socket) {
    console.log(`[TCP - SYSTEM] Destroying stale zombie socket for IMEI ${imei} (${existing.clientId}) to prevent file descriptor leak.`);
    try { existing.socket.destroy(); } catch (e) {}
  }

  // Always replace stale entry — old socket from previous connection is dead
  connectedDevices.set(imei, { socket, clientId, protocolName, lastPacket: new Date() });

  // Auto-fire pending command if one was queued while the device was offline (Fix 3)
  const pending = pendingCommands.get(imei);
  if (pending) {
    const ageMs = Date.now() - pending.queuedAt;
    if (ageMs > PENDING_CMD_TTL_MS) {
      console.log(`[TCP - COMMAND] Pending command for IMEI ${imei} expired (age=${Math.round(ageMs/1000)}s) — discarding`);
      pendingCommands.delete(imei);
      return;
    }
    pendingCommands.delete(imei);
    // Resolve the actual protocol if it was 'AUTO' when queued
    const actualProto = pending.protocol === 'AUTO' ? protocolName : pending.protocol;
    // Fire asynchronously — do not block the socket registration path
    setImmediate(() => dispatchCommand(imei, pending.action, actualProto, socket));
  }
}

// Initialize Redis publisher
publisher.init();

// Initialize Redis command subscriber for downlink commands (Immobilizer / Relay)
let commandSubscriber = null;
startCommandSubscriber();

// Start the BSTPL-17 Server on Port 5000
const bstplServer = createProtocolServer(
  BSTPL_PORT,
  '#',
  'BSTPL-17',
  ['$10', '$11']
);

// Start the AIS140 V1 Server on Port 5001
const ais140Server = createProtocolServer(
  AIS140_PORT,
  '*',
  'AIS140',
  ['$NRM', '$ALT', '$EPB', '$LGN', '$HLM']
);

// Start the Concox Server on Port 5002 (binary protocol — separate handler)
const concoxServer = createConcoxServer(CONCOX_PORT);

// Start the AIS140 V2 Server on Port 5003
// V2 uses '*' as a packet terminator for general packets, and '$' for login packets.
// We use '*' as the primary stream delimiter; the login packet fallback is handled
// inside processPacket via the isV2LoginPacket() heuristic.
const ais140V2Server = createProtocolServer(
  AIS140V2_PORT,
  '*',
  'AIS140V2',
  // AIS140 V2 valid first-field headers:
  //   '$,'     = general/health/emergency/OTA/diagnosis (e.g. $,10 / $,101 / $,EPB)
  //   'ACTVR'  = activation response
  //   'HCHKR'  = health check response
  //   '$'      = dollar-delimited login packet (matched by prefix)
  ['$,', 'ACTVR', 'HCHKR', '$']
);

// Start the Volty Server on Port 5004
// Volty packets are terminated with \r\n (not '*' like AIS140).
// The OC handshake uses: $PVT,VLT1,M1.2.2,OC,...\r\n
// Normal location packets also end with \r\n.
const voltyServer = createProtocolServer(
  VOLTY_PORT,
  '*',
  'VOLTY',
  ['$']
);

// Start the FMB920 Server on Port 5005
const fmb920Server = startFmb920Server(FMB920_PORT);

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
    let sessionImei = null;

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

        // Find the start of the packet ($ for standard protocols, or ACTVR/HCHKR for AIS140V2)
        let startIndex = packet.lastIndexOf('$');
        if (startIndex === -1) {
          const actvrIdx = packet.indexOf('ACTVR');
          const hchkrIdx = packet.indexOf('HCHKR');
          if (actvrIdx !== -1) {
            startIndex = actvrIdx;
          } else if (hchkrIdx !== -1) {
            startIndex = hchkrIdx;
          } else {
            console.log(`[TCP - ${protocolName}] Dropped unparseable data (no valid start byte): HEX=${Buffer.from(packet).toString('hex')} ASCII=${packet.replace(/\r/g, '\\r').replace(/\n/g, '\\n')}`);
            continue; // No valid packet start found
          }
        }
        packet = packet.substring(startIndex);

        totalPacketsReceived++;

        // Process the packet
        processPacket(packet, socket, clientId, protocolName, allowedHeaders,
          () => sessionImei,
          (val) => {
            if (val && val !== sessionImei) {
              // Always use the port's assigned protocolName — do NOT override based on packet format
              sessionImei = val;
              registerDeviceSocket(val, socket, clientId, protocolName);
            }
          }
        );
      }

      // Safety: prevent buffer overflow from malformed data
      if (buffer.length > 10000) {
        console.warn(`[TCP - ${protocolName}] Buffer overflow from ${clientId}, clearing`);
        buffer = '';
      }
    });

    socket.on('close', () => {
      if (protocolStats[protocolName]) protocolStats[protocolName].connections--;
      console.log(`[TCP - ${protocolName}] Device disconnected: ${clientId} (IMEI: ${sessionImei || 'unknown'})`);
      if (sessionImei) {
        const existing = connectedDevices.get(sessionImei);
        if (existing && existing.socket === socket) {
          connectedDevices.delete(sessionImei);
        }
      }
      // Remove from connected devices
      for (const [imei, info] of connectedDevices.entries()) {
        if (info.socket === socket || info.clientId === clientId) {
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
async function processPacket(raw, socket, clientId, protocolName, allowedHeaders, getSessionImei, setSessionImei) {
  try {
    // Check if packet header is allowed on this port.
    // For AIS140 V2 we use prefix matching instead of exact match because the
    // general packet header is '$,' (which varies) and the login packet begins
    // with '$' followed by vehicle reg no (also variable).
    const header = raw.split(',')[0].trim();
    const headerAllowed = allowedHeaders.some(allowed => header.startsWith(allowed));

    // Parse the packet
    const parsed = parsePacket(raw);

    // Session IMEI resolution
    let currentImei = (parsed && parsed.imei) || (getSessionImei && getSessionImei()) || null;
    
    // If IMEI not yet resolved, attempt to extract 14-16 digit IMEI pattern from raw packet
    if (!currentImei) {
      const match = raw.match(/\b(\d{14,16})\b/);
      if (match) currentImei = match[1];
    }

    if (!headerAllowed) {
      totalPacketsInvalid++;
      console.debug(`[TCP - ${protocolName}] Disallowed packet header '${header}' received on port. Ignoring.`);
      if (currentImei) {
        await publisher.publishRawMessage({
          imei: currentImei,
          packetType: header || 'DISALLOWED',
          rawString: raw,
          rawPacket: raw,
          parsed: false,
          error: `Disallowed packet header '${header}' on ${protocolName} port`
        }).catch(err => console.error(err));
      }
      return;
    }

    if (!parsed) {
      totalPacketsInvalid++;
      console.warn(`[TCP - ${protocolName}] Unrecognized packet from ${clientId}: ${raw.substring(0, 50)}`);
      if (currentImei) {
        await publisher.publishRawMessage({
          imei: currentImei,
          packetType: header || 'UNRECOGNIZED',
          rawString: raw,
          rawPacket: raw,
          parsed: false,
          error: 'Unrecognized packet format'
        }).catch(err => console.error(err));
      }
      return;
    }

    if (!parsed.imei && currentImei) {
      parsed.imei = currentImei;
    }

    parsed.rawString = raw;
    parsed.packetType = parsed.packetType || header;

    if (currentImei && setSessionImei) {
      setSessionImei(currentImei);
    }

    if (parsed.imei) {
      publisher.publishRawMessage(parsed).catch(err => console.error('[RAW-LOG] Publish failed:', err.message));
      
      // RELAY TO VOLTYSOFT
      // Only forward if the vehicle is explicitly marked for Sand Mining
      publisher.getClient().sismember('volty:mining_imeis', parsed.imei).then(isMining => {
        if (isMining === 1) {
          voltyRelay.forwardToVoltysoft(parsed.imei, raw);
        }
      }).catch(err => console.error('[TCP RELAY] Redis check failed:', err.message));
    }

    // Process based on packet type
    if (parsed.packetType === '$10' || parsed.packetType === '$NRM') {
      const validation = validateNormalPacket(parsed);
      if (!validation.valid) {
        totalPacketsInvalid++;
        console.warn(`[TCP - ${protocolName}] Invalid location packet from ${parsed.imei || 'unknown'}: ${validation.reason}`);
        return;
      }

      // Check for 0,0 coordinates — device has network but no GPS fix yet.
      // Also check if the device explicitly marked the GPS as invalid (gpsValid === 'V').
      // Publish as heartbeat so the vehicle shows ONLINE without corrupting map.
      const fLat = parseFloat(parsed.lat);
      const fLng = parseFloat(parsed.lng);
      const isZeroCoords = (fLat === 0 && fLng === 0);
      const isInvalidGpsFlag = parsed.gpsValid === 'V';

      // Track the connected device
      connectedDevices.set(parsed.imei, {
        socket,
        clientId,
        protocolName,
        lastPacket: new Date(),
        lat: isZeroCoords ? undefined : parsed.lat,
        lng: isZeroCoords ? undefined : parsed.lng,
      });

      if (isZeroCoords || isInvalidGpsFlag) {
        console.log(`[TCP - ${protocolName}] IMEI ${parsed.imei}: GPS fix not yet acquired (0,0) or marked Invalid (V). Publishing heartbeat only.`);
        await publisher.publishHeartbeat(
          parsed.imei, parsed.battery, parsed.gsmSignal,
          parsed.ignition, parsed.deviceTime, parsed.rawPacket, parsed.packetType
        );
      } else {
        // Publish to Redis
        await publisher.publishLocation(parsed);
      }
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

      // If alert has valid GPS data, publish as a location update too
      if (parsed.lat && parsed.lng && Math.abs(parsed.lat) <= 90 && Math.abs(parsed.lng) <= 180) {
        connectedDevices.set(parsed.imei, {
          socket,
          clientId,
          protocolName,
          lastPacket: new Date(),
          lat: parsed.lat,
          lng: parsed.lng,
        });
        await publisher.publishLocation({ ...parsed, gpsValid: 'A', speed: parsed.speed || 0, odometer: 0, direction: 0 }).catch(() => {});
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
        socket,
        clientId,
        protocolName,
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
      if (parsed.imei) {
        connectedDevices.set(parsed.imei, {
          socket,
          clientId,
          protocolName,
          lastPacket: new Date()
        });
      }
      console.log(`[TCP - ${protocolName}] Login received from device ${parsed.imei} (${parsed.vehicleRegNo || 'No Reg'})`);
      if (typeof protocolName !== 'undefined' && protocolStats[protocolName]) {
        protocolStats[protocolName].lastSuccessfulPacketAt = new Date().toISOString();
      } else if (protocolStats['CONCOX']) {
        protocolStats['CONCOX'].lastSuccessfulPacketAt = new Date().toISOString();
      }
      totalPacketsParsed++;

    } else if (parsed.packetType === '$HLM') {
      console.log(`[TCP - ${protocolName}] Health status received from device ${parsed.imei}. Battery: ${parsed.batteryPercent}%`);
      if (parsed.imei) {
        connectedDevices.set(parsed.imei, {
          socket,
          clientId,
          protocolName,
          lastPacket: new Date()
        });
        await publisher.publishHeartbeat(
          parsed.imei, 
          parsed.batteryPercent, 
          undefined, 
          undefined, 
          parsed.deviceTime,
          parsed.rawString,
          parsed.packetType
        );
      }
      if (typeof protocolName !== 'undefined' && protocolStats[protocolName]) {
        protocolStats[protocolName].lastSuccessfulPacketAt = new Date().toISOString();
      } else if (protocolStats['CONCOX']) {
        protocolStats['CONCOX'].lastSuccessfulPacketAt = new Date().toISOString();
      }
      totalPacketsParsed++;

    } else if (parsed.packetType === 'VOLTY_OPEN_CONN') {
      // ================================================================
      // VOLTY OPEN CONNECTION HANDSHAKE (OC packet)
      // The device ALWAYS sends this first before any GPS data.
      // We MUST reply with "OK\r\n" otherwise the device closes the
      // TCP connection immediately and never sends location packets.
      // ================================================================
      console.log(`[TCP - ${protocolName}] Volty OC handshake from ${clientId} (IMEI: ${parsed.imei || 'pending'}). Sending ACK.`);
      try {
        socket.write('OK\r\n');
      } catch (e) {
        console.error(`[TCP - ${protocolName}] Failed to send OC ACK: ${e.message}`);
      }
      if (parsed.imei) {
        connectedDevices.set(parsed.imei, {
          socket,
          clientId,
          protocolName,
          lastPacket: new Date()
        });
        await publisher.publishHeartbeat(
          parsed.imei,
          100,
          undefined,
          undefined,
          parsed.deviceTime,
          parsed.rawPacket,
          'VOLTY_OPEN_CONN'
        ).catch(() => {});
      }
      if (protocolStats['VOLTY']) protocolStats['VOLTY'].lastSuccessfulPacketAt = new Date().toISOString();
      totalPacketsParsed++;

    } else if (parsed.packetType === 'VOLTY_NORMAL') {
      const isValidGps = parsed.gpsValid === 'A' && parsed.lat !== null && parsed.lng !== null &&
                         Math.abs(parsed.lat) <= 90 && Math.abs(parsed.lng) <= 180;
                         
      connectedDevices.set(parsed.imei, {
        socket,
        clientId,
        protocolName,
        lastPacket: new Date(),
        lat: isValidGps ? parsed.lat : undefined,
        lng: isValidGps ? parsed.lng : undefined,
      });

      // ── ACK the data packet so the device stops retrying ──────────
      // Volty devices expect an "OK\r\n" acknowledgement after every
      // data packet they send. Without it the device queues the packet
      // as unacknowledged and re-transmits it endlessly, which is the
      // source of the repeated errors you were seeing.
      try {
        if (!socket.destroyed) socket.write('OK\r\n');
      } catch (ackErr) {
        console.warn(`[TCP - ${protocolName}] Failed to ACK VOLTY_NORMAL for ${parsed.imei}: ${ackErr.message}`);
      }

      if (!isValidGps) {
        console.log(`[TCP - ${protocolName}] Volty: GPS not fixed for ${parsed.imei}. Publishing heartbeat.`);
        await publisher.publishHeartbeat(
          parsed.imei,
          parsed.battery,
          parsed.ignition,
          parsed.voltage,
          parsed.deviceTime,
          parsed.rawPacket,
          'VOLTY_HEARTBEAT'
        );
      } else {
        await publisher.publishLocation(parsed);
      }
      totalPacketsParsed++;
      if (protocolStats['VOLTY']) protocolStats['VOLTY'].lastSuccessfulPacketAt = new Date().toISOString();

      if (parsed.alertText) {
        await publisher.publishAlert(parsed);
        console.log(`[TCP - ${protocolName}] Volty Alert from ${parsed.imei}: ${parsed.alertText}`);
      }

      
    // ================================================================
    // AIS140 V2 PACKET TYPES
    // ================================================================

    } else if (parsed.packetType === 'AIS140V2_GENERAL') {
      // General/Normal packet — treat the same as $NRM for location tracking
      const fLat = parseFloat(parsed.lat);
      const fLng = parseFloat(parsed.lng);
      const isValidGps = parsed.gpsValid === 'A' && parsed.lat !== null && parsed.lng !== null &&
                         Math.abs(fLat) <= 90 && Math.abs(fLng) <= 180;
      const isZeroCoords = (fLat === 0 && fLng === 0);

      if (!isValidGps || isZeroCoords) {
        // GPS not fixed — still mark device as online via heartbeat
        console.log(`[TCP - ${protocolName}] V2 General: GPS not fixed for ${parsed.imei} (valid=${isValidGps}, zero=${isZeroCoords}). Publishing heartbeat.`);
        connectedDevices.set(parsed.imei, { socket, clientId, protocolName, lastPacket: new Date() });
        await publisher.publishHeartbeat(
          parsed.imei, parsed.battery, parsed.gsmSignal,
          parsed.ignition, parsed.deviceTime, parsed.rawPacket, parsed.packetType
        );
        totalPacketsParsed++;
        if (protocolStats['AIS140V2']) protocolStats['AIS140V2'].lastSuccessfulPacketAt = new Date().toISOString();
      } else {
        connectedDevices.set(parsed.imei, {
          socket,
          clientId,
          protocolName,
          lastPacket: new Date(),
          lat: parsed.lat,
          lng: parsed.lng,
        });
        await publisher.publishLocation(parsed);
        totalPacketsParsed++;
        if (protocolStats['AIS140V2']) protocolStats['AIS140V2'].lastSuccessfulPacketAt = new Date().toISOString();
      }

      // If the general packet carries an alert (pktTypeCode != NR), also publish alert
      if (parsed.pktTypeCode && parsed.pktTypeCode !== 'NR' && parsed.alertText) {
        await publisher.publishAlert(parsed);
        console.log(`[TCP - ${protocolName}] V2 Alert from ${parsed.imei}: ${parsed.pktTypeCode} - ${parsed.alertText}`);
      }

    } else if (parsed.packetType === 'AIS140V2_HEALTH') {
      console.log(`[TCP - ${protocolName}] V2 Health from ${parsed.imei}: Battery ${parsed.batteryPercent}%, Mem ${parsed.memoryPercent}%`);
      if (parsed.imei) {
        connectedDevices.set(parsed.imei, {
          socket,
          clientId,
          protocolName,
          lastPacket: new Date()
        });
        await publisher.publishHeartbeat(
          parsed.imei,
          parsed.batteryPercent,
          undefined,
          undefined,
          parsed.deviceTime,
          parsed.rawPacket,
          parsed.packetType
        );
      }
      if (protocolStats['AIS140V2']) protocolStats['AIS140V2'].lastSuccessfulPacketAt = new Date().toISOString();
      totalPacketsParsed++;

    } else if (parsed.packetType === 'AIS140V2_EMERGENCY') {
      // Emergency (SOS) with GPS fix
      const isValidGps = parsed.gpsValid === 'A' && parsed.lat !== null && parsed.lng !== null &&
                         Math.abs(parsed.lat) <= 90 && Math.abs(parsed.lng) <= 180;
      if (isValidGps) {
        connectedDevices.set(parsed.imei, { socket, clientId, protocolName, lastPacket: new Date(), lat: parsed.lat, lng: parsed.lng });
        await publisher.publishLocation(parsed);
      }
      await publisher.publishAlert(parsed);
      if (protocolStats['AIS140V2']) protocolStats['AIS140V2'].lastSuccessfulPacketAt = new Date().toISOString();
      totalPacketsParsed++;
      console.log(`[TCP - ${protocolName}] V2 Emergency from ${parsed.imei}: ${parsed.alertText}`);

    } else if (parsed.packetType === 'AIS140V2_OTA_CHANGE') {
      // OTA parameter change — log and publish as alert
      console.log(`[TCP - ${protocolName}] V2 OTA Change from ${parsed.imei}: ${parsed.paramStr}`);
      if (parsed.imei && parsed.alertText) {
        await publisher.publishAlert(parsed);
      }
      if (protocolStats['AIS140V2']) protocolStats['AIS140V2'].lastSuccessfulPacketAt = new Date().toISOString();
      totalPacketsParsed++;

    } else if (parsed.packetType === 'AIS140V2_DIAGNOSIS') {
      // Diagnosis packet — log only, no location/alert publish
      console.log(`[TCP - ${protocolName}] V2 Diagnosis from ${parsed.imei}: ICCID=${parsed.iccid}, Flash=${parsed.flashValue}`);
      if (protocolStats['AIS140V2']) protocolStats['AIS140V2'].lastSuccessfulPacketAt = new Date().toISOString();
      totalPacketsParsed++;

    } else if (parsed.packetType === 'AIS140V2_ACTIVATION' || parsed.packetType === 'AIS140V2_HEALTH_CHECK') {
      // Activation / health check response — log and publish heartbeat
      console.log(`[TCP - ${protocolName}] V2 ${parsed.packetType} from ${parsed.imei}: Battery=${parsed.battVoltage}V, IGN=${parsed.ignition}`);
      if (parsed.imei) {
        const battPct = Math.min(100, Math.max(0, Math.round(((parsed.battVoltage - 3.0) / 1.2) * 100)));
        await publisher.publishHeartbeat(
          parsed.imei,
          battPct,
          parsed.gsmSignal,
          parsed.ignition,
          parsed.deviceTime,
          parsed.rawPacket,
          parsed.packetType
        );
      }
      if (protocolStats['AIS140V2']) protocolStats['AIS140V2'].lastSuccessfulPacketAt = new Date().toISOString();
      totalPacketsParsed++;

    } else if (parsed.packetType === 'AIS140V2_LOGIN') {
      console.log(`[TCP - ${protocolName}] V2 Login from ${parsed.imei} (VehicleNo: ${parsed.vehicleRegNo || 'N/A'}, FW: ${parsed.firmwareVer})`);
      if (protocolStats['AIS140V2']) protocolStats['AIS140V2'].lastSuccessfulPacketAt = new Date().toISOString();
      totalPacketsParsed++;
    }

  } catch (err) {
    totalPacketsInvalid++;
    console.error(`[TCP - ${protocolName}] Parse error from ${clientId}:`, err.message);
  }
}



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
            // Store IMEI and socket for this session
            sessionImei = packet.imei;
            connectedDevices.set(sessionImei, { socket: sock, clientId: cId, protocolName: 'CONCOX', lastPacket: new Date() });
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
              connectedDevices.set(sessionImei, { socket: sock, clientId: cId, protocolName: 'CONCOX', lastPacket: new Date() });
              await publisher.publishHeartbeat(
                sessionImei, 
                packet.battPercent, 
                packet.gsmStrength, 
                packet.ignition,
                packet.deviceTime,
                packet.rawPacket,
                packet.packetType
              );
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
              // GPS not fixed — still mark device online via heartbeat
              console.log(`[TCP - CONCOX] Location from ${sessionImei}: GPS not fixed (Status: ${packet.gpsValid}). Publishing heartbeat.`);
              if (sessionImei) {
                connectedDevices.set(sessionImei, { socket: sock, clientId: cId, protocolName: 'CONCOX', lastPacket: new Date() });
                await publisher.publishHeartbeat(
                  sessionImei, packet.battPercent, packet.gsmStrength,
                  packet.ignition, packet.deviceTime, packet.rawPacket, packet.packetType
                );
              }
              totalPacketsParsed++;
              break;
            }
            if (packet.lat === null || packet.lng === null ||
                Math.abs(packet.lat) > 90 || Math.abs(packet.lng) > 180 ||
                (parseFloat(packet.lat) === 0 && parseFloat(packet.lng) === 0)) {
              // 0,0 or invalid range — Indian Ocean / null island bug. Publish heartbeat only.
              console.log(`[TCP - CONCOX] Location from ${sessionImei}: coords invalid or 0,0 (lat=${packet.lat},lng=${packet.lng}). Publishing heartbeat.`);
              if (sessionImei) {
                connectedDevices.set(sessionImei, { socket: sock, clientId: cId, protocolName: 'CONCOX', lastPacket: new Date() });
                await publisher.publishHeartbeat(
                  sessionImei, packet.battPercent, packet.gsmStrength,
                  packet.ignition, packet.deviceTime, packet.rawPacket, packet.packetType
                );
              }
              totalPacketsParsed++;
              break;
            }

            const device = connectedDevices.get(sessionImei) || { clientId: cId, lastPacket: new Date() };
            device.socket = sock;
            device.protocolName = 'CONCOX';
            device.lat = packet.lat;
            device.lng = packet.lng;
            connectedDevices.set(sessionImei, device);

            // Publish to Redis tracking channel (same as BSTPL/AIS140)
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

          case 'CONCOX_ALARM': {
            if (!sessionImei) {
              console.warn(`[TCP - CONCOX] Alarm from ${cId} before login — dropping`);
              totalPacketsInvalid++;
              break;
            }

            // Send ACK — some firmware variants expect it even though spec says optional
            const ack = buildAlarmAck(packet.rawPacketType, packet.serialNumber);
            sock.write(ack);

            console.log(`[TCP - CONCOX] Alarm ACK sent (0x${packet.rawPacketType.toString(16)}) to ${sessionImei}`);

            const alarmDevice = connectedDevices.get(sessionImei) || {};
            alarmDevice.socket = sock;
            alarmDevice.protocolName = 'CONCOX';
            connectedDevices.set(sessionImei, alarmDevice);

            // Also publish location if GPS fix is valid (alarm packets carry GPS data)
            if (packet.gpsValid === 'A' &&
                packet.lat !== null && packet.lng !== null &&
                Math.abs(packet.lat) <= 90 && Math.abs(packet.lng) <= 180) {
              alarmDevice.lat = packet.lat;
              alarmDevice.lng = packet.lng;
              connectedDevices.set(sessionImei, alarmDevice);
              await publisher.publishLocation({
                imei:      sessionImei,
                lat:       packet.lat,
                lng:       packet.lng,
                speed:     packet.speed || 0,
                fuel:      packet.fuel,
                ignition:  packet.ignition,
                voltage:   packet.voltage || alarmDevice.voltage || null,
                direction: packet.direction || 0,
                odometer:  packet.odometer || 0,
                satellites: packet.satellites || 0,
                gsmSignal: packet.gsmSignal || 0,
                battery:   packet.battery,
                deviceTime: packet.deviceTime,
                isLive:    packet.isLive,
              }).catch(() => {});
            }

            // Publish alert
            await publisher.publishAlert({
              imei:      sessionImei,
              alertType: packet.alertType,
              alertText: packet.alertText,
              lat:       packet.lat || alarmDevice.lat || 0,
              lng:       packet.lng || alarmDevice.lng || 0,
              speed:     packet.speed || 0,
              deviceTime: packet.deviceTime,
            });
            if (typeof protocolName !== 'undefined' && protocolStats[protocolName]) {
              protocolStats[protocolName].lastSuccessfulPacketAt = new Date().toISOString();
            } else if (protocolStats['CONCOX']) {
              protocolStats['CONCOX'].lastSuccessfulPacketAt = new Date().toISOString();
            }
            totalPacketsParsed++;
            console.log(`[TCP - CONCOX] Alarm processed: ${sessionImei} - ${packet.alertType} (${packet.alertText})`);
            break;
          }

          case 'CONCOX_INFO': {
            // Information transmission (0x94): metadata enrichment only.
            if (packet.voltage !== null && sessionImei) {
              const dev = connectedDevices.get(sessionImei) || { socket: sock, clientId: cId, protocolName: 'CONCOX', lastPacket: new Date() };
              dev.voltage = packet.voltage;
              connectedDevices.set(sessionImei, dev);
              console.log(`[TCP - CONCOX] External voltage for ${sessionImei}: ${packet.voltage} V`);
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

          case 'CONCOX_HEARTBEAT': {
            // MUST ACK — device reboots after 3x missed heartbeats
            const ack = buildHeartbeatAck(packet.serialNumber, packet.rawPacketType);
            sock.write(ack);
            console.log(`[TCP - CONCOX] Heartbeat from ${sessionImei || 'unknown'} (batt: ${packet.battPercent}%, gsm: ${packet.gsmStrength}%)`);

            if (sessionImei) {
              connectedDevices.set(sessionImei, { socket: sock, clientId: cId, protocolName: 'CONCOX', lastPacket: new Date() });
              await publisher.publishHeartbeat(
                sessionImei, 
                packet.battPercent, 
                packet.gsmStrength, 
                packet.ignition,
                packet.deviceTime,
                packet.rawPacket,
                packet.packetType
              );
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
            device.socket = sock;
            device.protocolName = 'CONCOX';
            device.lat = packet.lat;
            device.lng = packet.lng;
            connectedDevices.set(sessionImei, device);

            // Publish to Redis tracking channel (same as BSTPL/AIS140)
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

          case 'CONCOX_ALARM': {
            if (!sessionImei) {
              console.warn(`[TCP - CONCOX] Alarm from ${cId} before login — dropping`);
              totalPacketsInvalid++;
              break;
            }

            // Send ACK — some firmware variants expect it even though spec says optional
            const ack = buildAlarmAck(packet.rawPacketType, packet.serialNumber);
            sock.write(ack);

            console.log(`[TCP - CONCOX] Alarm ACK sent (0x${packet.rawPacketType.toString(16)}) to ${sessionImei}`);

            const alarmDevice = connectedDevices.get(sessionImei) || {};
            alarmDevice.socket = sock;
            alarmDevice.protocolName = 'CONCOX';
            connectedDevices.set(sessionImei, alarmDevice);

            // Also publish location if GPS fix is valid (alarm packets carry GPS data)
            if (packet.gpsValid === 'A' &&
                packet.lat !== null && packet.lng !== null &&
                Math.abs(packet.lat) <= 90 && Math.abs(packet.lng) <= 180) {
              alarmDevice.lat = packet.lat;
              alarmDevice.lng = packet.lng;
              connectedDevices.set(sessionImei, alarmDevice);
              await publisher.publishLocation({
                imei:      sessionImei,
                lat:       packet.lat,
                lng:       packet.lng,
                speed:     packet.speed || 0,
                fuel:      packet.fuel,
                ignition:  packet.ignition,
                voltage:   packet.voltage || alarmDevice.voltage || null,
                direction: packet.direction || 0,
                odometer:  packet.odometer || 0,
                satellites: packet.satellites || 0,
                gsmSignal: packet.gsmSignal || 0,
                battery:   packet.battery,
                deviceTime: packet.deviceTime,
                isLive:    packet.isLive,
              }).catch(() => {});
            }

            // Publish alert
            await publisher.publishAlert({
              imei:      sessionImei,
              alertType: packet.alertType,
              alertText: packet.alertText,
              lat:       packet.lat || alarmDevice.lat || 0,
              lng:       packet.lng || alarmDevice.lng || 0,
              speed:     packet.speed || 0,
              deviceTime: packet.deviceTime,
            });
            if (typeof protocolName !== 'undefined' && protocolStats[protocolName]) {
              protocolStats[protocolName].lastSuccessfulPacketAt = new Date().toISOString();
            } else if (protocolStats['CONCOX']) {
              protocolStats['CONCOX'].lastSuccessfulPacketAt = new Date().toISOString();
            }
            totalPacketsParsed++;
            console.log(`[TCP - CONCOX] Alarm processed: ${sessionImei} - ${packet.alertType} (${packet.alertText})`);
            break;
          }

          case 'CONCOX_INFO': {
            // Information transmission (0x94): metadata enrichment only.
            if (packet.voltage !== null && sessionImei) {
              const dev = connectedDevices.get(sessionImei) || { socket: sock, clientId: cId, protocolName: 'CONCOX', lastPacket: new Date() };
              dev.voltage = packet.voltage;
              connectedDevices.set(sessionImei, dev);
              console.log(`[TCP - CONCOX] External voltage for ${sessionImei}: ${packet.voltage} V`);
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

/**
 * Dispatch a relay command to a device socket using its protocol adapter.
 * Extracted so it can be called both from the Redis subscriber (normal path)
 * and from registerDeviceSocket (pending-command auto-fire path).
 *
 * @param {string}     imei
 * @param {string}     action        'IMMOBILIZE' | 'MOBILIZE'
 * @param {string}     proto         Protocol name key (e.g. 'VOLTY', 'CONCOX')
 * @param {net.Socket} socket        Active, non-destroyed socket to write to
 */
async function dispatchCommand(imei, action, proto, socket, overrideCommand = null) {
  const isImmobilize = action === 'IMMOBILIZE';

  let cmdStr = '';
  let sendBuffer;
  let rawRepresentation;

  if (overrideCommand) {
    cmdStr = overrideCommand;
    rawRepresentation = `[OVERRIDE] ${cmdStr}`;
    sendBuffer = Buffer.from(cmdStr, 'ascii');
  } else {
    // Fix 4: look up adapter — fail loudly if protocol is unknown
    const adapter = commandAdapters[proto];
    if (!adapter) {
      console.error(`[TCP - COMMAND] No command adapter for protocol '${proto}' (IMEI ${imei}) — command NOT sent. Add an entry to commandAdapters.`);
      await publisher.publishRawMessage({
        imei,
        packetType: 'DOWNLINK_CMD_ERROR',
        rawString: `No adapter for protocol '${proto}'`,
        parsed: false,
        error: `Unknown protocol: ${proto}`
      }).catch(() => {});
      return;
    }

    cmdStr = isImmobilize ? adapter.immobilize() : adapter.mobilize();
  }

  if (proto === 'CONCOX') {
    // Concox uses its own binary builder — sentinel value triggers this branch
    const relayStr = isImmobilize ? 'RELAY,1#' : 'RELAY,0#';
    rawRepresentation = `[CONCOX 0x80] ${relayStr}`;
    sendBuffer = buildOnlineCommand(relayStr, Math.floor(Math.random() * 65535) + 1, 0);
  } else if (proto === 'FMB920') {
    // FMB920 uses Codec 12 for remote commands
    const relayStr = isImmobilize ? 'setdigout 1' : 'setdigout 0';
    rawRepresentation = `[FMB920 Codec 12] ${relayStr}`;
    sendBuffer = buildCodec12Command(relayStr);
  } else {
    rawRepresentation = cmdStr.trim();
    sendBuffer = Buffer.from(cmdStr, 'ascii');
  }

  socket.write(sendBuffer, (writeErr) => {
    if (writeErr) {
      console.error(`[TCP - COMMAND] Socket write error to IMEI ${imei} (${proto}):`, writeErr.message);
    } else {
      console.log(`[TCP - COMMAND] Sent ${action} to IMEI ${imei} (${proto}): ${rawRepresentation}`);
    }
  });

  await publisher.publishRawMessage({
    imei,
    packetType: isImmobilize ? 'DOWNLINK_IMMOBILIZE' : 'DOWNLINK_MOBILIZE',
    rawPacket: Buffer.isBuffer(sendBuffer) ? sendBuffer.toString('hex').toUpperCase() : String(sendBuffer),
    rawString: rawRepresentation,
    parsed: true
  }).catch(() => {});
}

/**
 * Initialize FMB920 (Teltonika) Protocol Server
 */
function startFmb920Server(port) {
  const server = net.createServer((sock) => {
    const cId = `${sock.remoteAddress}:${sock.remotePort}`;
    let sessionImei = null;
    const protocolName = 'FMB920';

    protocolStats[protocolName].connections++;
    protocolStats[protocolName].totalConnectionAttempts++;
    console.log(`[TCP - ${protocolName}] Connected: ${cId}`);

    // Buffer to handle TCP fragmentation
    let dataBuffer = Buffer.alloc(0);

    sock.on('data', async (chunk) => {
      dataBuffer = Buffer.concat([dataBuffer, chunk]);
      totalPacketsReceived++;
      if (protocolStats[protocolName]) protocolStats[protocolName].lastSuccessfulPacketAt = new Date().toISOString();

      try {
        // Parse while we have data
        while (dataBuffer.length > 0) {
          // If no session IMEI, expect IMEI handshake (2 bytes length + IMEI string)
          if (!sessionImei) {
            if (isImeiPacket(dataBuffer)) {
              const { imei, response } = parseImeiPacket(dataBuffer);
              sessionImei = imei;
              
              registerDeviceSocket(sessionImei, sock, cId, protocolName);

              sock.write(response); // \x01 Accept
              console.log(`[TCP - ${protocolName}] Authorized IMEI: ${sessionImei}`);
              
              // Remove handshake from buffer
              const len = dataBuffer.readUInt16BE(0);
              dataBuffer = dataBuffer.subarray(len + 2);
              continue;
            } else {
              // Wait for more data if it looks like an incomplete handshake
              break;
            }
          }

          // We have sessionImei, so we expect Codec 8 packets.
          const parseResult = parseCodec8Packet(dataBuffer);

          if (parseResult.error === 'Incomplete packet' || parseResult.error === 'Buffer too small for AVL packet') {
            // Need more data from TCP stream
            break;
          }

          if (parseResult.error) {
            console.warn(`[TCP - ${protocolName}] Parse error from ${sessionImei}: ${parseResult.error}`);
            totalPacketsInvalid++;
            // If it's a CRC error or unsupported codec, we should probably drop the connection or flush buffer
            dataBuffer = Buffer.alloc(0);
            break;
          }

          // Successfully parsed a Codec 8 packet
          if (parseResult.response) {
            sock.write(parseResult.response);
          }

          dataBuffer = dataBuffer.subarray(parseResult.bytesConsumed);
          totalPacketsParsed++;

          // Process the parsed records
          for (const record of parseResult.records) {
            const lat = record.lat;
            const lng = record.lng;
            const isValidGps = (lat !== 0 || lng !== 0);

            // Update connected device state
            const devInfo = connectedDevices.get(sessionImei) || { socket: sock, clientId: cId, protocolName };
            if (isValidGps) {
              devInfo.lat = lat;
              devInfo.lng = lng;
            }
            devInfo.lastPacket = new Date();
            connectedDevices.set(sessionImei, devInfo);

            const ignition = record.ioMap[239] === 1;
            const speed = record.speed;
            const batteryVolt = record.ioMap[67] ? record.ioMap[67] / 1000 : 0;
            const extVolt = record.ioMap[66] ? record.ioMap[66] / 1000 : 0;
            const odometer = record.ioMap[16] || 0;

            const payload = {
              imei: sessionImei,
              lat,
              lng,
              speed,
              ignition,
              direction: record.direction,
              satellites: record.satellites,
              battery: batteryVolt,
              voltage: extVolt,
              odometer,
              deviceTime: record.timestamp.toISOString(),
              isLive: 1, // Codec 8 packets are usually realtime, Priority=1 means high
              gpsValid: isValidGps ? 'A' : 'V'
            };

            await publisher.publishLocation(payload).catch(() => {});

            // Optional: Handle event IO (Panic button, etc.)
            // If eventIoId is not 0, it means an event triggered this record.
            if (record.eventIoId !== 0) {
              // Map Teltonika Event IO to Alert Types if needed.
              // e.g. 253 = green driving, 239 = ignition change
              if (record.eventIoId === 239) {
                const text = ignition ? 'Ignition ON' : 'Ignition OFF';
                await publisher.publishAlert({
                  imei: sessionImei,
                  alertType: 'stoppage',
                  alertText: text,
                  lat, lng, speed,
                  deviceTime: record.timestamp.toISOString()
                }).catch(() => {});
              }
            }
          }
        }
      } catch (err) {
        totalPacketsInvalid++;
        console.error(`[TCP - ${protocolName}] Stream parsing error for ${cId}:`, err.message);
        dataBuffer = Buffer.alloc(0); // flush corrupted buffer
      }
    });

    sock.on('close', () => {
      protocolStats[protocolName].connections = Math.max(0, protocolStats[protocolName].connections - 1);
      console.log(`[TCP - ${protocolName}] Disconnected: ${cId}`);
    });

    sock.on('error', (err) => {
      console.error(`[TCP - ${protocolName}] Socket error ${cId}:`, err.message);
    });

    sock.setTimeout(300000); // 5 mins
    sock.on('timeout', () => {
      console.log(`[TCP - ${protocolName}] Timeout: ${cId}`);
      sock.destroy();
    });
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`============================================================`);
    console.log(`  [TCP - FMB920] Server started successfully`);
    console.log(`  Listening on port: ${port}`);
    console.log(`  Protocol: Codec 8 Binary`);
    console.log(`============================================================`);
  });

  return server;
}

/**
 * Initialize Redis subscription for downlink commands (Immobilizer, Relay control, etc.)
 */
function startCommandSubscriber() {
  const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
  const REDIS_PORT = process.env.REDIS_PORT || 6379;

  commandSubscriber = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    retryStrategy: (times) => Math.min(times * 100, 3000),
    maxRetriesPerRequest: null,
  });

  commandSubscriber.on('connect', () => {
    console.log(`[REDIS] Command subscriber connected to ${REDIS_HOST}:${REDIS_PORT}`);
  });

  commandSubscriber.on('error', (err) => {
    console.error('[REDIS] Command subscriber error:', err.message);
  });

  commandSubscriber.subscribe('device_commands', (err, count) => {
    if (err) {
      console.error('[REDIS] Failed to subscribe to device_commands:', err.message);
    } else {
      console.log(`[REDIS] Successfully subscribed to device_commands channel (${count} active)`);
    }
  });

  commandSubscriber.on('message', async (channel, message) => {
    if (channel !== 'device_commands') return;
    try {
      const data = JSON.parse(message);
      const { imei, action, protocol, command } = data;
      if (!imei || !action) return;

      console.log(`[TCP - COMMAND] Received downlink request for IMEI ${imei}: action=${action}, protocol=${protocol || 'AUTO'}, override=${command || 'none'}`);

      const devInfo = connectedDevices.get(imei);
      // Resolve protocol: prefer live registry (set from actual connect), fall back to what API sent
      const activeProto = (devInfo && devInfo.protocolName) || protocol || 'AUTO';

      // Fix 2 + 3: device offline — queue the command and return a signal
      if (!devInfo || !devInfo.socket || devInfo.socket.destroyed) {
        console.warn(`[TCP - COMMAND] Device ${imei} offline — queuing ${action} for up to ${PENDING_CMD_TTL_MS/1000}s`);
        pendingCommands.set(imei, { action, protocol: activeProto, queuedAt: Date.now() });
        // Signal the API by publishing a special packet type it can check
        await publisher.publishRawMessage({
          imei,
          packetType: 'DOWNLINK_CMD_QUEUED',
          rawString: `Device offline — ${action} queued (will auto-fire on reconnect)`,
          parsed: true,
          error: 'device_offline'
        }).catch(() => {});
        return;
      }

      await dispatchCommand(imei, action, activeProto, devInfo.socket, command);

    } catch (cmdErr) {
      console.error('[TCP - COMMAND] Error handling device command:', cmdErr.message);
    }
  });
}

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
      bstplConnections:    protocolStats['BSTPL-17'].connections,
      ais140Connections:   protocolStats['AIS140'].connections,
      ais140V2Connections: protocolStats['AIS140V2'].connections,
      concoxConnections:   protocolStats['CONCOX'].connections,
      voltyConnections:    protocolStats['VOLTY'].connections,
      fmb920Connections:   protocolStats['FMB920'].connections,
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

function shutdown() {
  console.log('\n[TCP] Gracefully shutting down servers...');
  if (commandSubscriber) commandSubscriber.quit().catch(() => {});
  bstplServer.close();
  ais140Server.close();
  concoxServer.close();
  ais140V2Server.close();
  voltyServer.close();
  fmb920Server.close();
  healthServer.close();
  setTimeout(() => process.exit(0), 1000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ============================================================
// PROCESS-LEVEL ERROR GUARDS
// An uncaught exception in any packet handler path triggers a clean
// shutdown so PM2 can restart the ingestion process quickly.
// unhandledRejection is logged only — a single missed .catch() in a
// per-packet handler should not kill the whole TCP server.
// ============================================================
process.on('uncaughtException', (err) => {
  console.error('[TCP] Uncaught exception — initiating graceful shutdown:', err.stack || err.message);
  shutdown();
});

process.on('unhandledRejection', (reason) => {
  console.error('[TCP] Unhandled promise rejection (non-fatal, logged for investigation):', reason);
});


module.exports = { bstplServer, ais140Server, ais140V2Server, concoxServer, voltyServer, fmb920Server, healthServer };
