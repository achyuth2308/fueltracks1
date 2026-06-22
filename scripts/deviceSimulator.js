// ============================================================
// BSTPL-17 DEVICE SIMULATOR
// Simulates live GPS devices sending ASCII packets over TCP
// Sends data to TCP Server (port 5000)
// ============================================================

const net = require('net');

const TCP_HOST = '127.0.0.1';
const TCP_PORT = 5000;

// Seeded IMEIs in DB
const SIMULATED_DEVICES = [
  {
    imei: '865006049210220',
    lat: 17.207174,
    lng: 78.314323,
    speed: 0,
    fuel: 85.5,
    ignition: 0,
    stage: 0,         // Custom simulation stages (0: Stopped, 1: Started/Idle, 2: Active/Moving, 3: Deviated, 4: Stopped)
    stageCounter: 0
  },
  { imei: '865006049210216', lat: 12.971598, lng: 77.594562, speed: 0, fuel: 92.0, ignition: 0 },
  { imei: '865006049210217', lat: 19.076090, lng: 72.877726, speed: 60, fuel: 50.2, ignition: 1 },
];

/**
 * Format decimal coordinates to DDM (Degree Decimal Minutes)
 */
function convertToDdm(decimal, isLng = false) {
  const absVal = Math.abs(decimal);
  const degrees = Math.floor(absVal);
  const minutes = (absVal - degrees) * 60;

  let degStr = degrees.toString();
  if (isLng) {
    degStr = degStr.padStart(3, '0');
  } else {
    degStr = degStr.padStart(2, '0');
  }

  const minStr = minutes.toFixed(4).padStart(7, '0'); // e.g. 20.7174
  return `${degStr}${minStr}`;
}

function getLatDirection(lat) {
  return lat >= 0 ? 'N' : 'S';
}

function getLngDirection(lng) {
  return lng >= 0 ? 'E' : 'W';
}

function getBstplDateTime() {
  const now = new Date();
  const DD = now.getUTCDate().toString().padStart(2, '0');
  const MM = (now.getUTCMonth() + 1).toString().padStart(2, '0');
  const YY = now.getUTCFullYear().toString().slice(-2);

  const HH = now.getUTCHours().toString().padStart(2, '0');
  const mm = now.getUTCMinutes().toString().padStart(2, '0');
  const SS = now.getUTCSeconds().toString().padStart(2, '0');

  return {
    date: `${DD}${MM}${YY}`,
    time: `${HH}${mm}${SS}`
  };
}

/**
 * Update coordinates and state dynamically to test all alerts
 */
function updateDeviceState(device) {
  // Only apply state transitions for the primary testing device
  if (device.imei !== '865006049210220') {
    if (device.speed > 0) {
      device.lat += (Math.random() - 0.5) * 0.0003;
      device.lng += (Math.random() - 0.5) * 0.0003;
      device.fuel = Math.max(5, parseFloat((device.fuel - 0.01).toFixed(2)));
    }
    return;
  }

  device.stageCounter++;

  // Transition Stage Machine for e2e testing
  switch (device.stage) {
    case 0: // Resting State
      device.ignition = 0;
      device.speed = 0;
      device.lat = 17.207174;
      device.lng = 78.314323; // Inside Geofence (HQ)
      console.log(`[SIMULATOR-STATE] Stage 0 (Resting) - Ignition OFF, Stopped at Origin.`);
      
      if (device.stageCounter >= 2) {
        device.stage = 1;
        device.stageCounter = 0;
      }
      break;

    case 1: // Vehicle Started / Idling
      device.ignition = 1;
      device.speed = 0;
      console.log(`[SIMULATOR-STATE] Stage 1 (Started / Idling) - Ignition turned ON, Speed is 0.`);
      
      // Let it idle for 4 cycles (~40s) to trigger "Too Much Idle" alert
      if (device.stageCounter >= 4) {
        device.stage = 2;
        device.stageCounter = 0;
      }
      break;

    case 2: // Trip Started / Running on Route
      device.ignition = 1;
      device.speed = 45;
      // Move along route: from 17.207174, 78.314323 towards 17.209174, 78.316323
      device.lat += 0.0005;
      device.lng += 0.0005;
      console.log(`[SIMULATOR-STATE] Stage 2 (Active/Trip Running) - Ignition ON, Moving along route.`);
      
      if (device.stageCounter >= 3) {
        device.stage = 3;
        device.stageCounter = 0;
      }
      break;

    case 3: // Route Deviation and Exiting Geofence
      device.ignition = 1;
      device.speed = 60;
      // Depart wildly from the route and circle geofence
      device.lat = 17.237174;
      device.lng = 78.344323;
      console.log(`[SIMULATOR-STATE] Stage 3 (Route Deviation & Geofence Exit) - Deviated location.`);
      
      if (device.stageCounter >= 2) {
        device.stage = 4;
        device.stageCounter = 0;
      }
      break;

    case 4: // Stoppage
      device.ignition = 0;
      device.speed = 0;
      console.log(`[SIMULATOR-STATE] Stage 4 (Vehicle Stopped & Stoppage Alert).`);
      
      if (device.stageCounter >= 2) {
        // Reset cycle back to resting state
        device.stage = 0;
        device.stageCounter = 0;
      }
      break;
  }
}

/**
 * Generate a standard $10 normal packet
 */
function generateNormalPacket(device) {
  const { date, time } = getBstplDateTime();
  const rawLat = convertToDdm(device.lat, false);
  const latDir = getLatDirection(device.lat);
  const rawLng = convertToDdm(device.lng, true);
  const lngDir = getLngDirection(device.lng);

  const odometer = Math.round(54000 + (Date.now() / 10000) % 1000);
  const satCount = device.speed > 0 ? 12 : 8;
  const batteryPct = Math.round(80 + Math.random() * 20);

  return `$10,${device.imei},A,${date},${time},${rawLat},${latDir},${rawLng},${lngDir},${device.speed},${odometer},180,${satCount},31,${batteryPct},${device.ignition},0,0,0,00.0000,${device.fuel},12.15,L#`;
}

/**
 * Run simulator loop
 */
function runSimulator() {
  console.log(`[SIMULATOR] Starting BSTPL-17 device simulator...`);
  console.log(`[SIMULATOR] Connecting to TCP server at ${TCP_HOST}:${TCP_PORT}`);

  SIMULATED_DEVICES.forEach((device) => {
    const client = new net.Socket();

    client.connect(TCP_PORT, TCP_HOST, () => {
      console.log(`[SIMULATOR] Connected device ${device.imei}`);

      // Setup periodic packet transmissions (every 10 seconds)
      const intervalId = setInterval(() => {
        updateDeviceState(device);
        const packet = generateNormalPacket(device);
        client.write(packet);
        console.log(`[SIMULATOR] Send Packet [${device.imei}]: ${packet}`);
      }, 10000);

      device.intervalId = intervalId;
    });

    client.on('error', (err) => {
      console.error(`[SIMULATOR] Connection error for ${device.imei}:`, err.message);
      if (device.intervalId) {
        clearInterval(device.intervalId);
      }
    });

    client.on('close', () => {
      console.log(`[SIMULATOR] Disconnected device ${device.imei}`);
      if (device.intervalId) {
        clearInterval(device.intervalId);
      }
    });
  });
}

runSimulator();
