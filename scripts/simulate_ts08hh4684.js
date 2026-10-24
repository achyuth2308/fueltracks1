// ============================================================
// DEDICATED LIVE SIMULATOR FOR VEHICLE TS08HH4684
// IMEI: 868329088498955 | Plate: TS08HH4684
// Automatically tests geofence crossing, alerts & live map tracking
// ============================================================

'use strict';

const net = require('net');
const db = require('../backend/config/db');

const IMEI = '868329088498955';
const VEHICLE_NAME = 'TS08HH4684';
const TCP_HOST = '127.0.0.1';
const TCP_PORT = 5000; // BSTPL port

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
  };
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

let currentLat = 17.4399;
let currentLng = 78.3812;
let currentSpeed = 40;
let currentIgnition = 1;
let odometer = 12050;
let fuel = 85.0;

let stepIndex = 0;
let insideState = false;
let client = null;

// Connect to TCP server
function connectClient() {
  client = new net.Socket();

  client.connect(TCP_PORT, TCP_HOST, () => {
    console.log(`\n============================================================`);
    console.log(`[SIMULATOR] Connected to FuelTracks TCP Server on port ${TCP_PORT}`);
    console.log(`[SIMULATOR] Actively streaming GPS for Vehicle: ${VEHICLE_NAME} (IMEI: ${IMEI})`);
    console.log(`============================================================\n`);
  });

  client.on('error', (err) => {
    console.warn(`[SIMULATOR] TCP Socket warning (${err.message}), retrying in 3s...`);
    client.destroy();
    setTimeout(connectClient, 3000);
  });

  client.on('close', () => {
    setTimeout(connectClient, 3000);
  });
}

connectClient();

async function checkAssignedGeofences() {
  try {
    const res = await db.query(
      `SELECT g.id, g.name, g.type, g.center_lat, g.center_lng, g.radius
       FROM geofences g
       JOIN vehicle_geofences vg ON g.id = vg.geofence_id
       JOIN vehicles v ON v.id = vg.vehicle_id
       WHERE v.imei = $1`,
      [IMEI]
    );
    return res.rows;
  } catch (_) {
    return [];
  }
}

// Main simulation step (runs every 3 seconds)
setInterval(async () => {
  if (!client || client.destroyed) return;

  const geofences = await checkAssignedGeofences();
  const targetGeofence = geofences[0]; // test against first assigned geofence

  stepIndex++;

  if (targetGeofence && targetGeofence.center_lat && targetGeofence.center_lng) {
    const geoLat = parseFloat(targetGeofence.center_lat);
    const geoLng = parseFloat(targetGeofence.center_lng);
    const radius = parseFloat(targetGeofence.radius) || 250;

    // Smooth realistic driving path at ~45 km/h (approx 35 meters per 3s = 0.000315 deg)
    // Vehicle drives in a straight line from (geoLat - offset) through center to (geoLat + offset) and loops back
    const totalCycleSteps = 60; // 3 minutes cycle
    const loopProgress = (stepIndex % totalCycleSteps) / totalCycleSteps; // 0 to 1
    // Ping-pong between -2.0*radius and +2.0*radius
    const progress = loopProgress < 0.5 ? (loopProgress * 2) : ((1 - loopProgress) * 2); // 0 -> 1 -> 0
    const offsetMeters = (progress - 0.5) * 2.5 * radius; // from -1.25*radius to +1.25*radius
    
    // Angle of corridor (e.g. 45 degrees North-East)
    const angleRad = 0.785;
    const dLat = (offsetMeters * Math.cos(angleRad)) / 111320;
    const dLng = (offsetMeters * Math.sin(angleRad)) / (111320 * Math.cos(geoLat * Math.PI / 180));
    
    currentLat = geoLat + dLat;
    currentLng = geoLng + dLng;
    
    // Near center (within 30% radius), slow down slightly
    const distToCenter = Math.abs(offsetMeters);
    if (distToCenter < radius * 0.25) {
      currentSpeed = 20; // slowing down in loading bay
      currentIgnition = 1;
    } else {
      currentSpeed = 45;
      currentIgnition = 1;
    }

    const dist = haversineMeters(currentLat, currentLng, geoLat, geoLng);
    const isNowInside = dist <= radius;

    let alertNotice = '';
    if (isNowInside && !insideState) {
      alertNotice = `🚨 [ALERT TRIGGERED] ENTERED GEOFENCE: "${targetGeofence.name}"`;
      insideState = true;
    } else if (!isNowInside && insideState) {
      alertNotice = `🚨 [ALERT TRIGGERED] EXITED GEOFENCE: "${targetGeofence.name}"`;
      insideState = false;
    }

    console.log(
      `[SIM ${VEHICLE_NAME}] Lat: ${currentLat.toFixed(6)}, Lng: ${currentLng.toFixed(6)} | Spd: ${currentSpeed} km/h | ${
        isNowInside ? '🟢 INSIDE' : '⚪ OUTSIDE'
      } "${targetGeofence.name}" (${Math.round(dist)}m from center) ${alertNotice}`
    );
  } else {
    // No geofence assigned yet: simulate smooth drive around Hitec City Hyderabad
    const angle = (stepIndex * 0.1) % (2 * Math.PI);
    currentLat = 17.4399 + Math.sin(angle) * 0.003;
    currentLng = 78.3812 + Math.cos(angle) * 0.003;
    currentSpeed = 38 + Math.round(Math.random() * 8);
    currentIgnition = 1;

    console.log(
      `[SIM ${VEHICLE_NAME}] Lat: ${currentLat.toFixed(6)}, Lng: ${currentLng.toFixed(6)} | Spd: ${currentSpeed} km/h | Transmitting Live GPS (Waiting for geofence to be set in UI)`
    );
  }

  // Build and transmit BSTPL packet
  const { date, time } = bstplDateTime();
  const latDdm = toBstplDdm(currentLat, false);
  const lngDdm = toBstplDdm(currentLng, true);
  const latDir = currentLat >= 0 ? 'N' : 'S';
  const lngDir = currentLng >= 0 ? 'E' : 'W';
  odometer += Math.round((currentSpeed * 3) / 3600 * 1000);
  fuel = Math.max(10, parseFloat((fuel - 0.005).toFixed(2)));

  const packet = `$10,${IMEI},A,${date},${time},${latDdm},${latDir},${lngDdm},${lngDir},${currentSpeed},${odometer},90,12,30,95,${currentIgnition},0,0,0,00.0000,${fuel.toFixed(1)},12.5,L#`;

  try {
    client.write(packet);
  } catch (err) {
    console.error('[SIMULATOR] Write error:', err.message);
  }
}, 3000);
