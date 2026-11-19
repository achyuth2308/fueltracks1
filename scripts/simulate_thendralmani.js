// ============================================================
// DEDICATED LIVE SIMULATOR FOR ALL VEHICLES OF USER: THENDRALMANI
// Vehicles:
// 1. TN34A4195    (IMEI: 861329087487006) - Volty / BSTPL
// 2. Truck Alpha  (IMEI: 865006049210215, Plate: MH12AB1234) - BSTPL
// 3. Truck Beta   (IMEI: 865006049210216, Plate: MH12CD5678) - BSTPL
// ============================================================

'use strict';

const net = require('net');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const TCP_HOST = process.env.TCP_SIM_HOST || '127.0.0.1';
const BSTPL_PORT = parseInt(process.env.TCP_PORT) || 5000;
const VOLTY_PORT = parseInt(process.env.VOLTY_TCP_PORT) || 5004;

// Helper to convert decimal degrees to BSTPL DDM format (DDMM.MMMM)
function toBstplDdm(decimal, isLng = false) {
  const abs = Math.abs(decimal);
  const deg = Math.floor(abs);
  const min = (abs - deg) * 60;
  const degStr = isLng ? deg.toString().padStart(3, '0') : deg.toString().padStart(2, '0');
  return `${degStr}${min.toFixed(4).padStart(7, '0')}`;
}

function bstplDateTime() {
  const now = new Date();
  const pad = s => s.toString().padStart(2, '0');
  return {
    date: `${pad(now.getUTCDate())}${pad(now.getUTCMonth() + 1)}${now.getUTCFullYear().toString().slice(-2)}`,
    time: `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`,
    dateFull: `${pad(now.getUTCDate())}${pad(now.getUTCMonth() + 1)}${now.getUTCFullYear()}`,
  };
}

const VEHICLES = [
  {
    name: 'TN34A4195',
    imei: '861329087487006',
    reg: 'TN34A4195',
    protocol: 'VOLTY',
    port: VOLTY_PORT,
    lat: 17.435421,
    lng: 78.490532,
    baseLat: 17.435421,
    baseLng: 78.490532,
    speed: 42,
    hdg: 90,
    ignition: 1,
    odometer: 14200,
    voltage: 12.8,
    fuel: 54.0,
    step: 0,
    radius: 0.008,
  },
  {
    name: 'Truck Alpha (MH12AB1234)',
    imei: '865006049210215',
    reg: 'MH12AB1234',
    protocol: 'BSTPL',
    port: BSTPL_PORT,
    lat: 17.3980,
    lng: 78.4720,
    baseLat: 17.3980,
    baseLng: 78.4720,
    speed: 48,
    hdg: 135,
    ignition: 1,
    odometer: 85200,
    voltage: 24.2,
    fuel: 82.5,
    step: 20,
    radius: 0.012,
  },
  {
    name: 'Truck Beta (MH12CD5678)',
    imei: '865006049210216',
    reg: 'MH12CD5678',
    protocol: 'BSTPL',
    port: BSTPL_PORT,
    lat: 17.4120,
    lng: 78.5150,
    baseLat: 17.4120,
    baseLng: 78.5150,
    speed: 55,
    hdg: 220,
    ignition: 1,
    odometer: 92450,
    voltage: 24.0,
    fuel: 71.0,
    step: 40,
    radius: 0.010,
  }
];

console.log('============================================================');
console.log('🚀 STARTING TELEMETRY SIMULATOR FOR ALL THENDRALMANI VEHICLES');
console.log(`📡 Connecting to TCP Servers at ${TCP_HOST}...`);
console.log('============================================================\n');

VEHICLES.forEach(veh => {
  let client = new net.Socket();

  function connect() {
    client = new net.Socket();

    client.connect(veh.port, TCP_HOST, () => {
      console.log(`[SIM CONNECTED] ${veh.name} (IMEI: ${veh.imei}) on port ${veh.port} [${veh.protocol}]`);
    });

    client.on('error', (err) => {
      console.warn(`[SIM RETRY] ${veh.name}: ${err.message}`);
      client.destroy();
      setTimeout(connect, 3000);
    });

    client.on('close', () => {
      setTimeout(connect, 3000);
    });
  }

  connect();

  // Transmit packets every 3 seconds
  setInterval(() => {
    if (!client || client.destroyed) return;

    veh.step++;
    const angle = (veh.step * 0.08) % (2 * Math.PI);

    // Realistic smooth vehicle movement in orbit
    veh.lat = veh.baseLat + Math.sin(angle) * veh.radius;
    veh.lng = veh.baseLng + Math.cos(angle) * veh.radius;
    veh.speed = Math.max(25, Math.round(veh.speed + (Math.random() - 0.5) * 6));
    veh.odometer += Math.round((veh.speed * 3) / 3600 * 1000);
    veh.fuel = Math.max(15, parseFloat((veh.fuel - 0.003).toFixed(2)));

    const { date, time, dateFull } = bstplDateTime();

    let packet = '';
    if (veh.protocol === 'VOLTY') {
      // Volty AIS-140 Packet Format ($PVT)
      packet = `$PVT,VLT1,M1.2.2,NR,01,L,${veh.imei},${veh.reg},1,${dateFull},${time},${veh.lat.toFixed(6)},N,${veh.lng.toFixed(6)},E,${veh.speed}.0,${veh.hdg}.0,10,500.0,1.0,1.0,INA Airtel,${veh.ignition},1,${veh.voltage},4.2,0,O,30,404,10,00D6,CFBD,NMR,0001,01,000005,16*\r\n`;
    } else {
      // BSTPL-17 Packet Format ($10)
      const latDdm = toBstplDdm(veh.lat, false);
      const lngDdm = toBstplDdm(veh.lng, true);
      packet = `$10,${veh.imei},A,${date},${time},${latDdm},N,${lngDdm},E,${veh.speed},${veh.odometer},${veh.hdg},12,30,95,${veh.ignition},0,0,0,00.0000,${veh.fuel.toFixed(1)},${veh.voltage},L#\r\n`;
    }

    try {
      client.write(packet);
      console.log(`[TRANSMIT] ${veh.name} | Lat: ${veh.lat.toFixed(5)}, Lng: ${veh.lng.toFixed(5)} | Spd: ${veh.speed} km/h | Ign: ON | Odo: ${veh.odometer}m`);
    } catch (err) {
      console.error(`[TRANSMIT ERROR] ${veh.name}:`, err.message);
    }
  }, 3000);
});
