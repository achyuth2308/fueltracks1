// ============================================================
// MULTI-PROTOCOL DEVICE SIMULATOR — FuelTracks
// Simulates live GPS devices for ALL FOUR protocols:
//   Protocol 1: BSTPL-17      → Port 5000 (ASCII, # delimiter)
//   Protocol 2: AIS140 V1     → Port 5001 (ASCII, * delimiter)
//   Protocol 3: Concox Binary → Port 5002 (binary, 0x78/0x79 frames)
//   Protocol 4: AIS140 V2     → Port 5003 (ASCII, * delimiter)
//
// Usage:
//   node scripts/deviceSimulator.js              (all four protocols)
//   node scripts/deviceSimulator.js bstpl        (BSTPL only)
//   node scripts/deviceSimulator.js ais140       (AIS140 V1 only)
//   node scripts/deviceSimulator.js concox       (Concox only)
//   node scripts/deviceSimulator.js ais140v2     (AIS140 V2 only)
// ============================================================

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const net = require('net');
const { crcItu } = require('../tcp-server/parser/concoxCrc');

const TCP_HOST = process.env.TCP_SIM_HOST || '127.0.0.1';

const PORTS = {
  BSTPL:    parseInt(process.env.TCP_PORT)           || 5000,
  AIS140:   parseInt(process.env.AIS140_TCP_PORT)    || 5001,
  CONCOX:   parseInt(process.env.CONCOX_TCP_PORT)    || 5002,
  AIS140V2: parseInt(process.env.AIS140V2_TCP_PORT)  || 5003,
};

// Filter argument: run only one protocol if specified
const FILTER = (process.argv[2] || '').toLowerCase();

// ── ANSI colors for easy visual distinction ──────────────────
const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  // Protocol colors
  bstpl:    '\x1b[33m',   // yellow
  ais140:   '\x1b[36m',   // cyan
  concox:   '\x1b[35m',   // magenta
  ais140v2: '\x1b[96m',   // bright cyan
  // Status colors
  ok:       '\x1b[32m',   // green
  err:      '\x1b[31m',   // red
  ack:      '\x1b[34m',   // blue
  info:     '\x1b[90m',   // grey
};

function tag(protocol) {
  const color = C[protocol.toLowerCase()] || C.info;
  return `${color}${C.bold}[SIM-${protocol}]${C.reset}`;
}

function log(protocol, msg) {
  const ts = new Date().toISOString().replace('T', ' ').replace('Z', '');
  console.log(`${C.dim}${ts}${C.reset} ${tag(protocol)} ${msg}`);
}

// ── Shared GPS helpers ───────────────────────────────────────

function utcNow() {
  return new Date();
}

/** Nudge coordinates slightly to simulate movement */
function nudge(val, range = 0.0003) {
  return parseFloat((val + (Math.random() - 0.5) * range).toFixed(7));
}

// ============================================================
// BSTPL-17 SIMULATOR  (port 5000)
// ============================================================

const BSTPL_DEVICES = [
  {
    imei:    '865006049210220',
    lat:     17.207174,
    lng:     78.314323,
    speed:   0,
    fuel:    85.5,
    ignition: 0,
    stage:   0,
    stageCounter: 0,
  },
  {
    imei:    '865006049210216',
    lat:     12.971598,
    lng:     77.594562,
    speed:   55,
    fuel:    72.0,
    ignition: 1,
  },
  {
    imei:    '865006049210217',
    lat:     19.076090,
    lng:     72.877726,
    speed:   0,
    fuel:    50.2,
    ignition: 0,
  },
];

function toBstplDdm(decimal, isLng = false) {
  const abs = Math.abs(decimal);
  const deg = Math.floor(abs);
  const min = (abs - deg) * 60;
  const degStr = isLng ? deg.toString().padStart(3, '0') : deg.toString().padStart(2, '0');
  return `${degStr}${min.toFixed(4).padStart(7, '0')}`;
}

function bstplDateTime() {
  const n = utcNow();
  const pad = s => s.toString().padStart(2, '0');
  return {
    date: `${pad(n.getUTCDate())}${pad(n.getUTCMonth()+1)}${n.getUTCFullYear().toString().slice(-2)}`,
    time: `${pad(n.getUTCHours())}${pad(n.getUTCMinutes())}${pad(n.getUTCSeconds())}`,
  };
}

function updateBstplState(d) {
  if (d.imei !== '865006049210220') {
    if (d.speed > 0) {
      d.lat  = nudge(d.lat);
      d.lng  = nudge(d.lng);
      d.fuel = Math.max(5, parseFloat((d.fuel - 0.01).toFixed(2)));
    }
    return;
  }
  d.stageCounter++;
  switch (d.stage) {
    case 0: d.ignition = 0; d.speed = 0;
      if (d.stageCounter >= 2) { d.stage = 1; d.stageCounter = 0; } break;
    case 1: d.ignition = 1; d.speed = 0;
      if (d.stageCounter >= 3) { d.stage = 2; d.stageCounter = 0; } break;
    case 2: d.ignition = 1; d.speed = 45; d.lat += 0.0005; d.lng += 0.0005;
      if (d.stageCounter >= 3) { d.stage = 3; d.stageCounter = 0; } break;
    case 3: d.ignition = 1; d.speed = 65; d.lat = 17.237174; d.lng = 78.344323;
      if (d.stageCounter >= 2) { d.stage = 4; d.stageCounter = 0; } break;
    case 4: d.ignition = 0; d.speed = 0;
      if (d.stageCounter >= 2) { d.stage = 0; d.stageCounter = 0; } break;
  }
}

function makeBstplPacket(d) {
  const { date, time } = bstplDateTime();
  const lat  = toBstplDdm(d.lat, false);
  const lng  = toBstplDdm(d.lng, true);
  const latD = d.lat >= 0 ? 'N' : 'S';
  const lngD = d.lng >= 0 ? 'E' : 'W';
  const odo  = Math.round(54000 + (Date.now() / 10000) % 1000);
  const sat  = d.speed > 0 ? 12 : 8;
  const batt = Math.round(80 + Math.random() * 20);
  return `$10,${d.imei},A,${date},${time},${lat},${latD},${lng},${lngD},${d.speed},${odo},180,${sat},31,${batt},${d.ignition},0,0,0,00.0000,${d.fuel.toFixed(1)},12.15,L#`;
}

function startBstplSimulator() {
  log('BSTPL', `Starting — targeting ${TCP_HOST}:${PORTS.BSTPL}`);

  BSTPL_DEVICES.forEach((device) => {
    const client = new net.Socket();
    let intervalId = null;

    client.connect(PORTS.BSTPL, TCP_HOST, () => {
      log('BSTPL', `${C.ok}Connected${C.reset} IMEI=${device.imei}`);

      // Send first packet immediately, then every 10s
      sendBstpl();
      intervalId = setInterval(sendBstpl, 10000);

      function sendBstpl() {
        updateBstplState(device);
        const pkt = makeBstplPacket(device);
        client.write(pkt);
        log('BSTPL', `${C.ok}→ SENT${C.reset} ${C.dim}${pkt}${C.reset}`);
      }
    });

    client.on('data', (d) => {
      // BSTPL server doesn't ACK back, but log anything unexpected
      log('BSTPL', `${C.ack}← RECV${C.reset} ${d.toString().trim()}`);
    });

    client.on('error', (err) => {
      log('BSTPL', `${C.err}ERROR${C.reset} ${device.imei}: ${err.message}`);
      if (intervalId) clearInterval(intervalId);
      setTimeout(() => client.connect(PORTS.BSTPL, TCP_HOST), 5000);
    });

    client.on('close', () => {
      log('BSTPL', `${C.err}Disconnected${C.reset} ${device.imei}`);
      if (intervalId) clearInterval(intervalId);
    });
  });
}

// ============================================================
// AIS140 SIMULATOR  (port 5001)
// ============================================================

const AIS140_DEVICES = [
  {
    imei:    '865006049210220',
    vehReg:  'TS09EX1001',
    lat:     17.345378,
    lng:     78.523923,
    speed:   0,
    ignition: 1,
    alertCycle: 0,
    loggedIn: false,
  },
  {
    imei:    '865006049210216',
    vehReg:  'TS09EX1002',
    lat:     12.971598,
    lng:     77.594562,
    speed:   40,
    ignition: 1,
    loggedIn: false,
  },
];

function ais140DateTime() {
  const n = utcNow();
  const pad = s => s.toString().padStart(2, '0');
  return {
    date: `${pad(n.getUTCDate())}${pad(n.getUTCMonth()+1)}${n.getUTCFullYear()}`,
    time: `${pad(n.getUTCHours())}${pad(n.getUTCMinutes())}${pad(n.getUTCSeconds())}`,
  };
}

function makeAis140LoginPacket(d) {
  return `$LGN,${d.vehReg},${d.imei},1.0.0,${d.lat.toFixed(6)},N,${d.lng.toFixed(6)},E*`;
}

function makeAis140NormalPacket(d) {
  const { date, time } = ais140DateTime();
  const odo    = (54000 + Math.round((Date.now() / 10000) % 1000)).toFixed(3);
  const sat    = d.speed > 0 ? 12 : 8;
  const volt   = (12.0 + Math.random() * 0.5).toFixed(1);
  const battV  = (4.0 + Math.random() * 0.2).toFixed(1);
  // NRM format: header,vendor,sw,type,alertId,status,imei,vehReg,fix,date,time,lat,latDir,lng,lngDir,
  //             speed,heading,sats,alt,pdop,hdop,operator,ign,mainPwr,mainV,battV,emerg,tamper,
  //             gsm,mcc,mnc,lac,cellid,din,dout,ain1,ain2,frameNo,odo,debug,checksum*
  return `$NRM,TNOWTN,1.0.0,NR,1,L,${d.imei},${d.vehReg},1,${date},${time},${d.lat.toFixed(6)},N,${d.lng.toFixed(6)},E,${d.speed.toFixed(1)},180.00,${sat},500.0,1.1,0.9,Airtel,${d.ignition},1,${volt},${battV},0,C,31,404,98,AAAA,BBBB,0000,00,0,0,000001,${odo},SIM,ABCD1234*`;
}

function makeAis140AlertPacket(d, alertId) {
  const { date, time } = ais140DateTime();
  const alertIds = { sos: 10, geofence_in: 18, geofence_out: 19, overspeed: 17, ignition_on: 7, ignition_off: 8 };
  const id = alertIds[alertId] || 1;
  return `$ALT,TNOWTN,1.0.0,EA,${id},L,${d.imei},${d.vehReg},1,${date},${time},${d.lat.toFixed(6)},N,${d.lng.toFixed(6)},E,0.0,180.00,${d.speed > 0 ? 12 : 8},500.0,1.1,0.9,Airtel,${d.ignition},1,12.4,3.2,0,C,31,404,98,AAAA,BBBB,0000,00,0,0,000002,0.000,SIM,ABCD1234*`;
}

function startAis140Simulator() {
  log('AIS140', `Starting — targeting ${TCP_HOST}:${PORTS.AIS140}`);

  const ALERT_SEQUENCE = ['geofence_in', 'overspeed', 'geofence_out', 'sos'];

  AIS140_DEVICES.forEach((device) => {
    const client = new net.Socket();
    let intervalId = null;
    let tick = 0;

    client.connect(PORTS.AIS140, TCP_HOST, () => {
      log('AIS140', `${C.ok}Connected${C.reset} IMEI=${device.imei}`);

      // Send login first
      const loginPkt = makeAis140LoginPacket(device);
      client.write(loginPkt);
      log('AIS140', `${C.ok}→ LOGIN${C.reset} ${C.dim}${loginPkt}${C.reset}`);
      device.loggedIn = true;

      // Normal packets every 10s, occasional alert
      intervalId = setInterval(() => {
        tick++;
        if (device.speed > 0) {
          device.lat = nudge(device.lat);
          device.lng = nudge(device.lng);
        }

        // Send NRM packet
        const nrmPkt = makeAis140NormalPacket(device);
        client.write(nrmPkt);
        log('AIS140', `${C.ok}→ NRM  ${C.reset} ${C.dim}${nrmPkt.substring(0, 80)}...${C.reset}`);

        // Send an alert every 4 ticks
        if (tick % 4 === 0 && device.imei === '865006049210220') {
          const alertType = ALERT_SEQUENCE[(tick / 4 - 1) % ALERT_SEQUENCE.length];
          const altPkt    = makeAis140AlertPacket(device, alertType);
          client.write(altPkt);
          log('AIS140', `${C.ok}→ ALT  ${C.reset}(${alertType}) ${C.dim}${altPkt.substring(0, 70)}...${C.reset}`);
        }
      }, 10000);
    });

    client.on('data', (d) => {
      log('AIS140', `${C.ack}← RECV${C.reset} ${d.toString().trim()}`);
    });

    client.on('error', (err) => {
      log('AIS140', `${C.err}ERROR${C.reset} ${device.imei}: ${err.message}`);
      if (intervalId) clearInterval(intervalId);
    });

    client.on('close', () => {
      log('AIS140', `${C.err}Disconnected${C.reset} ${device.imei}`);
      if (intervalId) clearInterval(intervalId);
    });
  });
}

// ============================================================
// CONCOX BINARY SIMULATOR  (port 5002)
// ============================================================

const CONCOX_DEVICES = [
  {
    imei:      '865006049210220',  // same IMEI as above — Concox on different port
    imeiBytes: [0x86, 0x50, 0x06, 0x04, 0x92, 0x10, 0x22, 0x00], // packed BCD with leading 0
    lat:       17.345378,
    lng:       78.523923,
    speed:     0,
    ignition:  false,
    serial:    0,
    stage:     0,
    stageCtr:  0,
  },
  {
    imei:      '865006049210217',
    imeiBytes: [0x86, 0x50, 0x06, 0x04, 0x92, 0x10, 0x21, 0x70],
    lat:       19.076090,
    lng:       72.877726,
    speed:     60,
    ignition:  true,
    serial:    0,
  },
];

/**
 * Pack IMEI (15 digits) into 8 bytes of packed BCD with a leading zero nibble.
 * e.g. "865006049210220" → pad to 16 digits "0865006049210220"
 *   → bytes [0x08, 0x65, 0x00, 0x60, 0x49, 0x21, 0x02, 0x20]
 */
function packImei(imei) {
  const padded = imei.padStart(16, '0');  // 16 hex digits (8 bytes)
  const bytes  = [];
  for (let i = 0; i < 16; i += 2) {
    bytes.push(parseInt(padded[i], 10) << 4 | parseInt(padded[i + 1], 10));
  }
  return Buffer.from(bytes);
}

function nextSerial(device) {
  device.serial = (device.serial + 1) & 0xFFFF;
  return device.serial;
}

/**
 * Build a CRC'd 0x78 0x78 frame from protocol + info bytes + serial.
 */
function buildConcoxFrame(protocolNum, infoBytes, serialNum) {
  const info    = Buffer.isBuffer(infoBytes) ? infoBytes : Buffer.from(infoBytes);
  const pktLen  = 1 + info.length + 2 + 2;  // protocol + info + serial + crc

  const crcSlice = Buffer.concat([
    Buffer.from([pktLen, protocolNum]),
    info,
    Buffer.from([(serialNum >> 8) & 0xFF, serialNum & 0xFF]),
  ]);
  const crc = crcItu(crcSlice);

  return Buffer.concat([
    Buffer.from([0x78, 0x78, pktLen, protocolNum]),
    info,
    Buffer.from([(serialNum >> 8) & 0xFF, serialNum & 0xFF,
                 (crc >> 8) & 0xFF, crc & 0xFF, 0x0D, 0x0A]),
  ]);
}

/** Build a CRC'd 0x79 0x79 extended frame */
function buildConcoxExtendedFrame(protocolNum, infoBytes, serialNum) {
  const info    = Buffer.isBuffer(infoBytes) ? infoBytes : Buffer.from(infoBytes);
  const pktLen  = 1 + info.length + 2 + 2;  // protocol + info + serial + crc

  const crcSlice = Buffer.concat([
    Buffer.from([(pktLen >> 8) & 0xFF, pktLen & 0xFF, protocolNum]),
    info,
    Buffer.from([(serialNum >> 8) & 0xFF, serialNum & 0xFF]),
  ]);
  const crc = crcItu(crcSlice);

  return Buffer.concat([
    Buffer.from([0x79, 0x79, (pktLen >> 8) & 0xFF, pktLen & 0xFF, protocolNum]),
    info,
    Buffer.from([(serialNum >> 8) & 0xFF, serialNum & 0xFF,
                 (crc >> 8) & 0xFF, crc & 0xFF, 0x0D, 0x0A]),
  ]);
}

/** Build Login packet (0x01) */
function makeConcoxLogin(device) {
  const imeiBytes = packImei(device.imei);
  const model     = Buffer.from([0x00, 0x05]);   // model code 5
  const tzLang    = Buffer.from([0x00, 0x00]);   // UTC
  const info      = Buffer.concat([imeiBytes, model, tzLang]);
  return buildConcoxFrame(0x01, info, nextSerial(device));
}

/** Build Heartbeat packet (0x13) */
function makeConcoxHeartbeat(device) {
  // Terminal info: bit3=acc, bit1=gpsTracking → 0x0A if ignition on, 0x02 if off
  const termInfo = device.ignition ? 0x0A : 0x02;
  const battLvl  = 0x05;  // 80% (good battery)
  const gsmLvl   = 0x03;  // 75%
  const info     = Buffer.from([termInfo, battLvl, gsmLvl, 0x00, 0x00]);
  return buildConcoxFrame(0x13, info, nextSerial(device));
}

/** Build Info packet (0x94) for External Voltage */
function makeConcoxInfo(device) {
  // Voltage sub-type is 0x00, length 2 bytes. Let's send 12.86V
  // 12.86V * 100 = 1286 = 0x0506
  const subType = 0x00;
  const rawVolts = Math.round((12.5 + Math.random() * 0.5) * 100);
  const voltageBytes = Buffer.from([subType, (rawVolts >> 8) & 0xFF, rawVolts & 0xFF]);
  return buildConcoxExtendedFrame(0x94, voltageBytes, nextSerial(device));
}

/** Build Location packet (0x22) */
function makeConcoxLocation(device) {
  const now  = utcNow();
  const pad  = n => n & 0xFF;

  const dateBytes = Buffer.from([
    now.getUTCFullYear() - 2000,
    pad(now.getUTCMonth() + 1),
    pad(now.getUTCDate()),
    pad(now.getUTCHours()),
    pad(now.getUTCMinutes()),
    pad(now.getUTCSeconds()),
  ]);

  // GPS info byte: high nibble=12 (gps info length), low nibble=satellite count
  const satCount    = device.speed > 0 ? 12 : 8;
  const gpsInfoByte = (12 << 4) | (satCount & 0x0F);

  const rawLat = Math.round(Math.abs(device.lat) * 1800000);
  const rawLng = Math.round(Math.abs(device.lng) * 1800000);
  const latBuf = Buffer.alloc(4); latBuf.writeUInt32BE(rawLat);
  const lngBuf = Buffer.alloc(4); lngBuf.writeUInt32BE(rawLng);

  const speedByte = Math.min(255, Math.round(device.speed));

  // Course/Status:
  //   bit14 (byte0 bit6) = GPS fix (1 = fixed)
  //   bit13 (byte0 bit5) = longitude hemisphere (0=East)
  //   bit12 (byte0 bit4) = latitude hemisphere (1=North)
  //   bits9-0 = heading (use 180)
  const heading    = 180;
  const courseHigh = 0x50 | ((heading >> 8) & 0x03);  // fix=1, West=0, North=1
  const courseLow  = heading & 0xFF;

  const mcc    = Buffer.from([0x01, 0x94]);   // 404
  const mnc    = Buffer.from([0x62]);          // 98
  const lac    = Buffer.from([0xAA, 0xAA]);
  const cellId = Buffer.from([0xBB, 0xBB, 0xBB]);

  const acc        = device.ignition ? 0x01 : 0x00;
  const uploadMode = 0x00;  // timer
  const reUpload   = 0x00;  // live

  const odometer = Math.round((device.speed > 0 ? 5000 : 1000) * 1000);  // metres
  const milBuf   = Buffer.alloc(4); milBuf.writeUInt32BE(odometer);

  const info = Buffer.concat([
    dateBytes,
    Buffer.from([gpsInfoByte]),
    latBuf, lngBuf,
    Buffer.from([speedByte, courseHigh, courseLow]),
    mcc, mnc, lac, cellId,
    Buffer.from([acc, uploadMode, reUpload]),
    milBuf,
  ]);

  return buildConcoxFrame(0x22, info, nextSerial(device));
}

/** Build Alarm packet (0x26) — overspeed alarm */
function makeConcoxAlarm(device, alarmCode = 0x06) {
  const now  = utcNow();
  const pad  = n => n & 0xFF;

  const dateBytes = Buffer.from([
    now.getUTCFullYear() - 2000,
    pad(now.getUTCMonth() + 1),
    pad(now.getUTCDate()),
    pad(now.getUTCHours()),
    pad(now.getUTCMinutes()),
    pad(now.getUTCSeconds()),
  ]);

  const rawLat = Math.round(Math.abs(device.lat) * 1800000);
  const rawLng = Math.round(Math.abs(device.lng) * 1800000);
  const latBuf = Buffer.alloc(4); latBuf.writeUInt32BE(rawLat);
  const lngBuf = Buffer.alloc(4); lngBuf.writeUInt32BE(rawLng);

  const courseHigh = 0x50;
  const courseLow  = 0xB4;

  const lbsLen = 0x08;
  const lbs    = Buffer.from([lbsLen, 0x01, 0x94, 0x62, 0xAA, 0xAA, 0xBB, 0xBB, 0xBB]);

  // Terminal info: acc on
  const termInfo = 0x08;
  const battLvl  = 0x05;
  const gsmLvl   = 0x03;
  const lang     = 0x00;

  const milBuf = Buffer.alloc(4); milBuf.writeUInt32BE(5000 * 1000);

  const info = Buffer.concat([
    dateBytes,
    Buffer.from([0xC4]),   // GPS info: 4 sats
    latBuf, lngBuf,
    Buffer.from([Math.min(255, Math.round(device.speed)), courseHigh, courseLow]),
    lbs,
    Buffer.from([termInfo, battLvl, gsmLvl, alarmCode, lang]),
    milBuf,
  ]);

  return buildConcoxFrame(0x26, info, nextSerial(device));
}

function updateConcoxState(d) {
  if (!d.stage && d.stage !== 0) {
    // Secondary device — just move
    if (d.speed > 0) {
      d.lat = nudge(d.lat, 0.0005);
      d.lng = nudge(d.lng, 0.0005);
    }
    return;
  }

  d.stageCtr++;
  switch (d.stage) {
    case 0: d.ignition = false; d.speed = 0;
      if (d.stageCtr >= 2) { d.stage = 1; d.stageCtr = 0; } break;
    case 1: d.ignition = true;  d.speed = 0;
      if (d.stageCtr >= 3) { d.stage = 2; d.stageCtr = 0; } break;
    case 2: d.ignition = true;  d.speed = 45;
      d.lat = nudge(d.lat, 0.0005); d.lng = nudge(d.lng, 0.0005);
      if (d.stageCtr >= 3) { d.stage = 3; d.stageCtr = 0; } break;
    case 3: d.ignition = true;  d.speed = 90;  // trigger overspeed alarm
      d.lat = nudge(d.lat, 0.001);  d.lng = nudge(d.lng, 0.001);
      if (d.stageCtr >= 2) { d.stage = 4; d.stageCtr = 0; } break;
    case 4: d.ignition = false; d.speed = 0;
      if (d.stageCtr >= 2) { d.stage = 0; d.stageCtr = 0; } break;
  }
}

function startConcoxSimulator() {
  log('CONCOX', `Starting — targeting ${TCP_HOST}:${PORTS.CONCOX}`);

  CONCOX_DEVICES.forEach((device) => {
    const client = new net.Socket();
    let heartbeatId = null;
    let locationId  = null;
    let tick        = 0;

    client.connect(PORTS.CONCOX, TCP_HOST, () => {
      log('CONCOX', `${C.ok}Connected${C.reset} IMEI=${device.imei}`);

      // Step 1: Send login immediately (CRITICAL — device reboots if no ACK within 5s)
      const loginFrame = makeConcoxLogin(device);
      client.write(loginFrame);
      log('CONCOX', `${C.ok}→ LOGIN (0x01)${C.reset} IMEI=${device.imei} bytes=[${loginFrame.toString('hex').toUpperCase().match(/../g).join(' ')}]`);

      // Step 2: Heartbeat every 30s
      heartbeatId = setInterval(() => {
        const hbFrame = makeConcoxHeartbeat(device);
        client.write(hbFrame);
        log('CONCOX', `${C.ok}→ HEARTBEAT (0x13)${C.reset} ign=${device.ignition} batt=80%`);
      }, 30000);

      // Step 3: Location every 10s
      locationId = setInterval(() => {
        tick++;
        updateConcoxState(device);

        const locFrame = makeConcoxLocation(device);
        client.write(locFrame);
        log('CONCOX', `${C.ok}→ LOCATION (0x22)${C.reset} lat=${device.lat.toFixed(6)} lng=${device.lng.toFixed(6)} speed=${device.speed} ign=${device.ignition} isLive=true`);

        // Send Info packet immediately after Location
        const infoFrame = makeConcoxInfo(device);
        client.write(infoFrame);
        log('CONCOX', `${C.ok}→ INFO (0x94)${C.reset} external voltage`);

        // Send overspeed alarm when speed > 80
        if (device.speed > 80 && device.imei === '865006049210220') {
          const alarmFrame = makeConcoxAlarm(device, 0x06);  // 0x06 = overspeed
          client.write(alarmFrame);
          log('CONCOX', `${C.ok}→ ALARM (0x26)${C.reset} alarmCode=0x06 (Overspeed) speed=${device.speed}`);
        }

        // Send SOS alarm once per full stage cycle (stage 3)
        if (device.stage === 3 && device.stageCtr === 1 && device.imei === '865006049210220') {
          const sosFrame = makeConcoxAlarm(device, 0x01);  // 0x01 = SOS
          client.write(sosFrame);
          log('CONCOX', `${C.ok}→ ALARM (0x26)${C.reset} alarmCode=0x01 (SOS Alarm)`);
        }
      }, 10000);
    });

    // Handle ACK responses from server
    client.on('data', (data) => {
      let offset = 0;
      while (offset + 4 <= data.length) {
        // Parse response header
        if (data[offset] !== 0x78 || data[offset + 1] !== 0x78) { offset++; continue; }
        const pktLen = data[offset + 2];
        const proto  = data[offset + 3];
        const frameEnd = offset + 2 + 1 + pktLen + 2;  // start + lenField + pktLen + stop

        if (frameEnd > data.length) break;

        const protoNames = { 0x01: 'LOGIN ACK', 0x13: 'HEARTBEAT ACK', 0x26: 'ALARM ACK', 0x27: 'ALARM ACK' };
        const protoName  = protoNames[proto] || `ACK 0x${proto.toString(16).toUpperCase()}`;
        const frameHex   = data.slice(offset, frameEnd).toString('hex').toUpperCase().match(/../g).join(' ');
        log('CONCOX', `${C.ack}← ${protoName}${C.reset} bytes=[${frameHex}]`);
        offset = frameEnd;
      }
    });

    client.on('error', (err) => {
      log('CONCOX', `${C.err}ERROR${C.reset} ${device.imei}: ${err.message}`);
      if (heartbeatId) clearInterval(heartbeatId);
      if (locationId)  clearInterval(locationId);
    });

    client.on('close', () => {
      log('CONCOX', `${C.err}Disconnected${C.reset} ${device.imei}`);
      if (heartbeatId) clearInterval(heartbeatId);
      if (locationId)  clearInterval(locationId);
    });
  });
}

// ============================================================
// AIS140 V2 SIMULATOR  (port 5003)
// ============================================================

// V2 Device definitions
const AIS140V2_DEVICES = [
  {
    // Primary device: goes through a full scripted lifecycle
    imei:       '869247045236301',
    vehReg:     'TN01AA5678',
    vendor:     'APMK',
    firmware:   '1.1.2',
    lat:        12.971598,
    lng:        77.594562,
    speed:      0,
    ignition:   0,   // 0 = OFF, 1 = ON
    stage:      0,   // lifecycle stage
    stageCtr:   0,
    frameNo:    1,
    loggedIn:   false,
    tickCount:  0,
    battVolt:   4.05,
    mainsVolt:  13.8,
    gsmSignal:  28,
  },
  {
    // Secondary device: steady moving vehicle
    imei:       '864376047795371',
    vehReg:     'KA03MN9999',
    vendor:     'APMK',
    firmware:   '1.0.9',
    lat:        17.345378,
    lng:        78.523923,
    speed:      55,
    ignition:   1,
    frameNo:    100,
    loggedIn:   false,
    tickCount:  0,
    battVolt:   3.98,
    mainsVolt:  14.1,
    gsmSignal:  25,
  },
];

/** Pad a number with leading zeros to given length */
function padNum(n, len) { return String(n).padStart(len, '0'); }

/** Format current UTC as V2 date DDMMYYYY and time HHMMSS */
function v2DateTime() {
  const n   = utcNow();
  const pad = s => s.toString().padStart(2, '0');
  return {
    date: `${pad(n.getUTCDate())}${pad(n.getUTCMonth()+1)}${n.getUTCFullYear()}`,
    time: `${pad(n.getUTCHours())}${pad(n.getUTCMinutes())}${pad(n.getUTCSeconds())}`,
  };
}

/** Format current UTC as merged DDMMYYYYHHMMSS (for EPB emergency packets) */
function v2MergedDateTime() {
  const { date, time } = v2DateTime();
  return date + time;
}

/**
 * Build V2 LOGIN packet (dollar-delimited format)
 * $VehicleNo$IMEI$FirmwareVer$ProtocolVer$Lat$LatDir$Lng$LngDir$
 */
function makeV2LoginPacket(d) {
  return `$${d.vehReg}$${d.imei}$${d.firmware}$1.0$${d.lat.toFixed(6)}$N$${d.lng.toFixed(6)}$E$`;
}

/**
 * Build V2 GENERAL data packet ($,10 for live, $,200 for history)
 * Includes all 51 fields as per spec.
 */
function makeV2GeneralPacket(d, opts = {}) {
  const { date, time }  = v2DateTime();
  const header   = opts.history  ? '200' : '10';
  const pktType  = opts.pktType  || 'NR';
  const alertId  = opts.alertId  || '01';
  const status   = opts.history  ? 'H'  : 'L';
  const gpsFix   = d.speed > 0 || opts.gpsFix ? '1' : '0';
  const sats     = d.speed > 0 ? '09' : '08';
  const heading  = d.speed > 0 ? '180.00' : '000.00';
  const altitude = '183.5';
  const pdop     = '1.8';
  const hdop     = '1.0';
  const network  = 'AIRTEL';
  const mainsPwr = '1';
  const mainsV   = d.mainsVolt.toFixed(1);
  const battV    = d.battVolt.toFixed(1);
  const sos      = opts.sos ? '1' : '0';
  const gsm      = d.gsmSignal.toString();
  const mcc      = '404';
  const mnc      = '10';
  const lac      = '04F5';
  const cellId   = 'B1FB';
  // 4 neighbour cells
  const nbr      = 'B1FA,04F5,82,FA53,04F5,94,B95D,04F5,96,5DE4,04F5,31';
  const dinStatus  = '0000';
  const doutStatus = '00';
  const frameNo  = padNum(d.frameNo++, 6);

  return `$,${header},${d.vendor},${d.firmware},${pktType},${alertId},${status},` +
         `${d.imei},${d.vehReg},${gpsFix},${date},${time},` +
         `${d.lat.toFixed(6)},N,${d.lng.toFixed(6)},E,` +
         `${d.speed.toFixed(1)},${heading},${sats},${altitude},${pdop},${hdop},` +
         `${network},${d.ignition},${mainsPwr},${mainsV},${battV},${sos},${gsm},` +
         `${mcc},${mnc},${lac},${cellId},${nbr},` +
         `${dinStatus},${doutStatus},${frameNo},*`;
}

/**
 * Build V2 HEALTH packet ($,101)
 */
function makeV2HealthPacket(d) {
  const battPct    = Math.min(100, Math.max(0, Math.round(((d.battVolt - 3.0) / 1.2) * 100)));
  const memPct     = Math.round(10 + Math.random() * 5);  // 10-15% used
  const ignIntvl   = d.ignition ? '10' : '60';
  return `$,101,${d.vendor.substring(0,3)},${d.firmware},${d.imei},${battPct},20,${memPct},${ignIntvl},60,1000,${d.mainsVolt.toFixed(2)},0.00,*`;
}

/**
 * Build V2 EMERGENCY packet ($,EPB)
 * msgType: 'EMR' (SOS ON) or 'SEM' (SOS OFF)
 */
function makeV2EmergencyPacket(d, msgType = 'EMR') {
  const dt = v2MergedDateTime();
  return `$,EPB,${msgType},${d.imei},NM,${dt},A,` +
         `${d.lat.toFixed(6)},N,${d.lng.toFixed(6)},E,` +
         `183.5,0.0,${d.speed.toFixed(1)},G,${d.vehReg},0,*`;
}

/**
 * Build V2 DIAGNOSIS packet ($,500)
 */
function makeV2DiagnosisPacket(d) {
  const { date, time } = v2DateTime();
  // Dummy ICCID and sensor data
  return `$,500,${d.imei},89910473121803853296,${date},${time},0,0,1131,,*`;
}

/**
 * Build V2 OTA PARAMETER CHANGE packet ($,PC)
 */
function makeV2OtaPacket(d, paramStr = 'SETREPORT') {
  const { date, time } = v2DateTime();
  return `$,PC,12,${d.imei},1,136.243.105.103,${date},${time},${paramStr},*`;
}

/**
 * Scripted lifecycle stages for primary V2 device:
 * 0: Parked, IGN off  (2 ticks)
 * 1: IGN ON, idle     (2 ticks)
 * 2: Moving @ 45 km/h (4 ticks) — sends history packet on first tick
 * 3: Speeding 90 km/h (3 ticks) — sends overspeed alert
 * 4: SOS ON            (1 tick)  — sends EPB EMR
 * 5: SOS OFF           (1 tick)  — sends EPB SEM
 * 6: Health pkt        (1 tick)  — sends $,101
 * 7: OTA change        (1 tick)  — sends $,PC
 * 8: Diagnosis         (1 tick)  — sends $,500
 * 9: IGN OFF, parked  (2 ticks)  — cycle repeats
 */
function updateV2State(d) {
  if (typeof d.stage === 'undefined') {
    // Secondary device — just drift
    d.lat  = nudge(d.lat, 0.0004);
    d.lng  = nudge(d.lng, 0.0004);
    d.gsmSignal = Math.max(15, Math.min(31, d.gsmSignal + Math.round((Math.random()-0.5)*2)));
    d.battVolt  = parseFloat(Math.min(4.2, Math.max(3.2, d.battVolt + (Math.random()-0.5)*0.02)).toFixed(2));
    return;
  }
  d.stageCtr++;
  switch (d.stage) {
    case 0: d.ignition = 0; d.speed = 0;
      if (d.stageCtr >= 2) { d.stage = 1; d.stageCtr = 0; } break;
    case 1: d.ignition = 1; d.speed = 0;
      if (d.stageCtr >= 2) { d.stage = 2; d.stageCtr = 0; } break;
    case 2: d.ignition = 1; d.speed = 45;
      d.lat = nudge(d.lat, 0.0005); d.lng = nudge(d.lng, 0.0005);
      if (d.stageCtr >= 4) { d.stage = 3; d.stageCtr = 0; } break;
    case 3: d.ignition = 1; d.speed = 95;  // overspeed
      d.lat = nudge(d.lat, 0.001);  d.lng = nudge(d.lng, 0.001);
      if (d.stageCtr >= 3) { d.stage = 4; d.stageCtr = 0; } break;
    case 4: d.speed = 0;  // stopped for SOS
      if (d.stageCtr >= 1) { d.stage = 5; d.stageCtr = 0; } break;
    case 5:  // SOS ended
      if (d.stageCtr >= 1) { d.stage = 6; d.stageCtr = 0; } break;
    case 6:  // health
      if (d.stageCtr >= 1) { d.stage = 7; d.stageCtr = 0; } break;
    case 7:  // OTA
      if (d.stageCtr >= 1) { d.stage = 8; d.stageCtr = 0; } break;
    case 8:  // diagnosis
      if (d.stageCtr >= 1) { d.stage = 9; d.stageCtr = 0; } break;
    case 9: d.ignition = 0; d.speed = 0;
      if (d.stageCtr >= 2) { d.stage = 0; d.stageCtr = 0; } break;
  }
}

function startAis140V2Simulator() {
  log('AIS140V2', `Starting — targeting ${TCP_HOST}:${PORTS.AIS140V2}`);

  AIS140V2_DEVICES.forEach((device, devIdx) => {
    const client = new net.Socket();
    let intervalId = null;

    client.connect(PORTS.AIS140V2, TCP_HOST, () => {
      log('AIS140V2', `${C.ok}Connected${C.reset} IMEI=${device.imei}`);

      // ── Step 1: Send the V2 Login packet (dollar-delimited) ──
      const loginPkt = makeV2LoginPacket(device);
      // Login uses '$' as delimiter, but our TCP stream delimiter is '*'
      // Append a '*' so server's buffer flushes the login packet correctly
      client.write(loginPkt + '*');
      log('AIS140V2', `${C.ok}→ LOGIN${C.reset} ${C.dim}${loginPkt}${C.reset}`);
      device.loggedIn = true;

      // ── Step 2: Send initial health packet after 1s ──
      setTimeout(() => {
        const hpkt = makeV2HealthPacket(device);
        client.write(hpkt);
        log('AIS140V2', `${C.ok}→ HEALTH($,101)${C.reset} ${C.dim}${hpkt}${C.reset}`);
      }, 1000);

      // ── Step 3: Normal loop every 10 seconds ──
      intervalId = setInterval(() => {
        device.tickCount++;

        // Update movement/state for primary device
        if (typeof device.stage !== 'undefined') {
          updateV2State(device);
        } else {
          updateV2State(device);
        }

        // ── Always send a live general packet ──
        const nrmPkt = makeV2GeneralPacket(device, { gpsFix: true });
        client.write(nrmPkt);
        log('AIS140V2', `${C.ok}→ GENERAL($,10)${C.reset} stage=${device.stage ?? 'n/a'} ign=${device.ignition} spd=${device.speed} ${C.dim}${nrmPkt.substring(0, 90)}...${C.reset}`);

        // ── Primary device lifecycle events ──
        if (typeof device.stage !== 'undefined') {
          const stage = device.stage;

          // Send history (buffered) packet on every 5th tick
          if (device.tickCount % 5 === 0) {
            const histPkt = makeV2GeneralPacket(device, { history: true, gpsFix: true, alertId: '02' });
            client.write(histPkt);
            log('AIS140V2', `${C.ok}→ HISTORY($,200)${C.reset} ${C.dim}${histPkt.substring(0, 80)}...${C.reset}`);
          }

          // Overspeed alert in stage 3
          if (stage === 3 && device.stageCtr === 1) {
            const osPkt = makeV2GeneralPacket(device, { pktType: 'OS', alertId: '17', gpsFix: true });
            client.write(osPkt);
            log('AIS140V2', `${C.ok}→ OVERSPEED ALERT($,10 OS)${C.reset} speed=${device.speed}`);
          }

          // SOS ON in stage 4
          if (stage === 4 && device.stageCtr === 1) {
            const sosPkt = makeV2EmergencyPacket(device, 'EMR');
            client.write(sosPkt);
            log('AIS140V2', `${C.ok}→ SOS ON($,EPB,EMR)${C.reset} ${C.dim}${sosPkt}${C.reset}`);
          }

          // SOS OFF in stage 5
          if (stage === 5 && device.stageCtr === 1) {
            const semPkt = makeV2EmergencyPacket(device, 'SEM');
            client.write(semPkt);
            log('AIS140V2', `${C.ok}→ SOS OFF($,EPB,SEM)${C.reset} ${C.dim}${semPkt}${C.reset}`);
          }

          // Health packet in stage 6
          if (stage === 6 && device.stageCtr === 1) {
            const hpkt = makeV2HealthPacket(device);
            client.write(hpkt);
            log('AIS140V2', `${C.ok}→ HEALTH($,101)${C.reset} ${C.dim}${hpkt}${C.reset}`);
          }

          // OTA change in stage 7
          if (stage === 7 && device.stageCtr === 1) {
            const otaPkt = makeV2OtaPacket(device, 'SETREPORT,10,60,120,300,10');
            client.write(otaPkt);
            log('AIS140V2', `${C.ok}→ OTA CHANGE($,PC)${C.reset} ${C.dim}${otaPkt}${C.reset}`);
          }

          // Diagnosis in stage 8
          if (stage === 8 && device.stageCtr === 1) {
            const diagPkt = makeV2DiagnosisPacket(device);
            client.write(diagPkt);
            log('AIS140V2', `${C.ok}→ DIAGNOSIS($,500)${C.reset} ${C.dim}${diagPkt}${C.reset}`);
          }

          // Ignition OFF alert in stage 9
          if (stage === 9 && device.stageCtr === 1) {
            const ignOffPkt = makeV2GeneralPacket(device, { pktType: 'IF', alertId: '08', gpsFix: false });
            client.write(ignOffPkt);
            log('AIS140V2', `${C.ok}→ IGNITION OFF($,10 IF)${C.reset}`);
          }

          // Ignition ON alert at stage 1→2 transition
          if (stage === 1 && device.stageCtr === 1) {
            const ignOnPkt = makeV2GeneralPacket(device, { pktType: 'IN', alertId: '07', gpsFix: false });
            client.write(ignOnPkt);
            log('AIS140V2', `${C.ok}→ IGNITION ON($,10 IN)${C.reset}`);
          }
        }

        // ── Secondary device: send health every 6 ticks ──
        if (typeof device.stage === 'undefined' && device.tickCount % 6 === 0) {
          const hpkt = makeV2HealthPacket(device);
          client.write(hpkt);
          log('AIS140V2', `${C.ok}→ HEALTH($,101)${C.reset} batt=${device.battVolt}V IMEI=${device.imei}`);
        }

      }, 10000);
    });

    client.on('data', (data) => {
      // V2 server doesn't send ACKs but log anything received
      const str = data.toString().trim();
      if (str) log('AIS140V2', `${C.ack}← RECV${C.reset} ${str}`);
    });

    client.on('error', (err) => {
      log('AIS140V2', `${C.err}ERROR${C.reset} IMEI=${device.imei}: ${err.message}`);
      if (intervalId) clearInterval(intervalId);
      // Auto-reconnect after 5s
      setTimeout(() => {
        log('AIS140V2', `Reconnecting IMEI=${device.imei}...`);
        client.connect(PORTS.AIS140V2, TCP_HOST);
      }, 5000);
    });

    client.on('close', () => {
      log('AIS140V2', `${C.err}Disconnected${C.reset} IMEI=${device.imei}`);
      if (intervalId) clearInterval(intervalId);
    });
  });
}

// ============================================================
// MAIN
// ============================================================

console.log('');
console.log(`${C.bold}╔══════════════════════════════════════════════════════╗${C.reset}`);
console.log(`${C.bold}║    FuelTracks Multi-Protocol Device Simulator        ║${C.reset}`);
console.log(`${C.bold}╠══════════════════════════════════════════════════════╣${C.reset}`);
console.log(`${C.bold}║  ${C.bstpl}BSTPL-17   ${C.reset}${C.bold}→  port ${PORTS.BSTPL}  (ASCII # delimiter)        ║${C.reset}`);
console.log(`${C.bold}║  ${C.ais140}AIS140 V1  ${C.reset}${C.bold}→  port ${PORTS.AIS140}  (ASCII * delimiter)        ║${C.reset}`);
console.log(`${C.bold}║  ${C.concox}Concox     ${C.reset}${C.bold}→  port ${PORTS.CONCOX}  (Binary 0x78/0x79)         ║${C.reset}`);
console.log(`${C.bold}║  ${C.ais140v2}AIS140 V2  ${C.reset}${C.bold}→  port ${PORTS.AIS140V2}  (ASCII * delimiter, V2 spec) ║${C.reset}`);
console.log(`${C.bold}╚══════════════════════════════════════════════════════╝${C.reset}`);
console.log('');

if (!FILTER || FILTER === 'bstpl')    startBstplSimulator();
if (!FILTER || FILTER === 'ais140')   startAis140Simulator();
if (!FILTER || FILTER === 'concox')   startConcoxSimulator();
if (!FILTER || FILTER === 'ais140v2') startAis140V2Simulator();
