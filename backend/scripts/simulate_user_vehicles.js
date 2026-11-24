/**
 * GPS & MANUAL FUEL SIMULATOR
 * Simulates real driving movement for:
 * 1. TS08UH1234 (IMEI: 861329085406982, Tank: 50L, Mileage: 4.5 km/l)
 * 2. Vehicle 867010074683211 (IMEI: 867010074683211, Tank: 330L, Mileage: 2.0 km/l)
 *
 * Each tick (every 3 seconds):
 * - Vehicle moves along a realistic GPS track at 40-55 km/h
 * - Distance accumulates
 * - Fuel decreases dynamically: Fuel Consumed = Distance / Mileage
 * - Live packets published to Redis 'tracking' channel
 * - Socket.io emits live updates to Customer Dashboard & Map
 */

const Redis = require('ioredis');
const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT) || 6379,
});

const vehicles = [
  {
    name: 'TS08UH1234',
    imei: '861329085406982',
    lat: 17.4435,
    lng: 78.3772,
    speed: 48,
    direction: 90,
    odometer: 143234.0,
    mileage: 4.5,
    latDelta: 0.00035, // ~38m per tick
    lngDelta: 0.00040,
    steps: 0,
    maxSteps: 120 // ~6 minutes of live driving
  },
  {
    name: 'Vehicle 867010074683211',
    imei: '867010074683211',
    lat: 17.4350,
    lng: 78.3650,
    speed: 52,
    direction: 135,
    odometer: 300.0,
    mileage: 2.0,
    latDelta: -0.00030,
    lngDelta: 0.00045,
    steps: 0,
    maxSteps: 120
  }
];

console.log('====================================================');
console.log('🚗 STARTING GPS SIMULATOR FOR MANUAL FUEL VEHICLES');
console.log('Target Vehicles:');
vehicles.forEach(v => {
  console.log(` • ${v.name} (IMEI: ${v.imei}) | Mileage: ${v.mileage} km/l`);
});
console.log('Publishing movement packets every 3 seconds to Redis...');
console.log('====================================================');

let tickCount = 0;

async function sendPacket(v) {
  // Nudge speed slightly for realism
  const currentSpeed = Math.max(30, Math.min(65, v.speed + (Math.random() - 0.5) * 6));
  
  // Calculate distance traveled in 3 seconds: (speed km/h * 1000m / 3600s) * 3s
  const distMeters = (currentSpeed * 1000 / 3600) * 3;
  const distKm = distMeters / 1000;
  
  v.odometer += distKm;
  v.lat += v.latDelta;
  v.lng += v.lngDelta;
  v.steps++;

  // Change heading every 20 steps to simulate turning streets
  if (v.steps % 20 === 0) {
    v.latDelta = (Math.random() - 0.5) * 0.0006;
    v.lngDelta = (Math.random() - 0.5) * 0.0006;
    v.direction = Math.round(Math.random() * 360);
  }

  const payload = {
    imei: v.imei,
    lat: parseFloat(v.lat.toFixed(6)),
    lng: parseFloat(v.lng.toFixed(6)),
    speed: Math.round(currentSpeed),
    direction: v.direction,
    odometer: parseFloat(v.odometer.toFixed(2)),
    ignition: true,
    voltage: 13.9,
    satellites: 14,
    gsmSignal: 29,
    battery: 100,
    deviceTime: new Date().toISOString(),
    isLive: true,
    packetType: 'NR'
  };

  await redis.publish('tracking', JSON.stringify(payload));

  const fuelBurnedThisTick = (distKm / v.mileage);
  console.log(`[TICK ${tickCount}] ${v.name}: Lat: ${payload.lat}, Lng: ${payload.lng} | Spd: ${payload.speed} km/h | Dist: +${(distKm * 1000).toFixed(0)}m (Total: ${v.odometer.toFixed(2)} km) | Est Burn: -${fuelBurnedThisTick.toFixed(4)}L`);
}

async function runTick() {
  tickCount++;
  try {
    for (const v of vehicles) {
      await sendPacket(v);
    }
  } catch (err) {
    console.error('Simulation tick error:', err.message);
  }
}

// Initial tick immediately
runTick();

// Recurring ticks every 3 seconds
const timer = setInterval(runTick, 3000);

process.on('SIGINT', () => {
  clearInterval(timer);
  redis.disconnect();
  console.log('\nSimulator stopped.');
  process.exit(0);
});
