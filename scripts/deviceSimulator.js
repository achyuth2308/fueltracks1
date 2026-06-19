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
  { imei: '865006049210220', lat: 17.207174, lng: 78.314323, speed: 45, fuel: 85.5 },
  { imei: '865006049210216', lat: 12.971598, lng: 77.594562, speed: 0, fuel: 92.0 },  // Idle/stopped
  { imei: '865006049210217', lat: 19.076090, lng: 72.877726, speed: 60, fuel: 50.2 },
];

/**
 * Format decimal coordinates to DDM (Degree Decimal Minutes)
 * Latitude DDM Format: DDMM.MMMM (e.g. 1720.7174)
 * Longitude DDM Format: DDDMM.MMMM (e.g. 07831.4323)
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

/**
 * Get direction labels
 */
function getLatDirection(lat) {
  return lat >= 0 ? 'N' : 'S';
}

function getLngDirection(lng) {
  return lng >= 0 ? 'E' : 'W';
}

/**
 * Get formatted Date and Time for BSTPL-17
 * Date: DDMMYY
 * Time: HHMMSS
 */
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
 * Generate a standard $10 normal packet
 */
function generateNormalPacket(device) {
  const { date, time } = getBstplDateTime();
  const rawLat = convertToDdm(device.lat, false);
  const latDir = getLatDirection(device.lat);
  const rawLng = convertToDdm(device.lng, true);
  const lngDir = getLngDirection(device.lng);

  // Modulate speed, odometer, and coordinate values slightly to simulate movement
  if (device.speed > 0) {
    // Coordinate movement (approx 10-50 meters)
    device.lat += (Math.random() - 0.5) * 0.0003;
    device.lng += (Math.random() - 0.5) * 0.0003;
    // Speed fluctuations
    device.speed = Math.max(10, Math.min(100, Math.round(device.speed + (Math.random() - 0.5) * 10)));
    // Fuel drop slowly
    device.fuel = Math.max(5, parseFloat((device.fuel - 0.01).toFixed(2)));
  }

  const odometer = Math.round(54000 + (Date.now() / 10000) % 1000);
  const ignition = device.speed > 0 ? 1 : 0;
  const satCount = device.speed > 0 ? 12 : 8;
  const batteryPct = Math.round(80 + Math.random() * 20);

  return `$10,${device.imei},A,${date},${time},${rawLat},${latDir},${rawLng},${lngDir},${device.speed},${odometer},180,${satCount},31,${batteryPct},${ignition},0,0,0,00.0000,${device.fuel},12.15,L#`;
}

/**
 * Generate an alert packet ($11)
 */
function generateAlertPacket(device, alertText) {
  const { date, time } = getBstplDateTime();
  const rawLat = convertToDdm(device.lat, false);
  const latDir = getLatDirection(device.lat);
  const rawLng = convertToDdm(device.lng, true);
  const lngDir = getLngDirection(device.lng);

  return `$11,${device.imei},${date},${time},${rawLat},${latDir},${rawLng},${lngDir},${alertText}#`;
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

      // Send initial login/ignition alert
      const loginAlert = generateAlertPacket(device, 'Ignition ON Alert');
      client.write(loginAlert);
      console.log(`[SIMULATOR] Send Alert [${device.imei}]: ${loginAlert}`);

      // Setup periodic packet transmissions (every 10 seconds)
      const intervalId = setInterval(() => {
        const packet = generateNormalPacket(device);
        client.write(packet);
        console.log(`[SIMULATOR] Send Packet [${device.imei}]: ${packet}`);

        // Randomly trigger an alert (1% chance per packet)
        if (Math.random() < 0.01) {
          const alert = generateAlertPacket(device, 'SOS Alert Pressed');
          client.write(alert);
          console.log(`[SIMULATOR] Send ALERT [${device.imei}]: ${alert}`);
        }
      }, 10000);

      // Save interval reference to clean up
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
