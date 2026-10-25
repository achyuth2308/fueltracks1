'use strict';

// ============================================================
// SAFETY PARKING THEFT ALARM SIMULATOR
// Tests instant police siren alarm trigger when vehicle engine turns ON
// or vehicle moves (> 1 km/h) while Safety Parking is ACTIVE.
// ============================================================

const db = require('../backend/config/db');
const { redis, createSubscriber } = require('../backend/config/redis');

async function main() {
  console.log('🚨 ====================================================');
  console.log('🚨 SAFETY PARKING THEFT ALARM SIMULATOR');
  console.log('🚨 ====================================================\n');

  // 1. Fetch target vehicle
  const targetImei = process.argv[2] || '865006049210216';
  const vehRes = await db.query("SELECT id, name, plate, imei, metadata FROM vehicles WHERE imei = $1 LIMIT 1", [targetImei]);
  if (!vehRes.rows.length) {
    console.error(`Vehicle with IMEI ${targetImei} not found in database!`);
    process.exit(1);
  }
  const vehicle = vehRes.rows[0];
  console.log(`Target Vehicle : ${vehicle.name} (${vehicle.plate})`);
  console.log(`IMEI           : ${vehicle.imei}\n`);

  // 2. Arm Safety Parking
  console.log('[Step 1] Arming Safety Parking (metadata.safetyPark = YES)...');
  const meta = { ...(vehicle.metadata || {}), safetyPark: 'YES' };
  await db.query("UPDATE vehicles SET metadata = $1 WHERE id = $2", [JSON.stringify(meta), vehicle.id]);
  await redis.del('vehicle:safety_park_fired:' + vehicle.id);
  await redis.del('vehicle:safety_park_breach:' + vehicle.id);
  await redis.del('vehicles:all');
  await redis.del('vehicle:obj:' + vehicle.id);
  await redis.del('vehicle:imei:' + vehicle.imei);
  console.log('✅ Safety Parking is now ARMED.\n');

  // 3. Listen to Redis alerts channel
  console.log('[Step 2] Subscribing to live alerts channel to monitor police siren trigger...');
  const sub = createSubscriber();
  await sub.subscribe('alerts');

  let alertTriggered = false;
  sub.on('message', (ch, msg) => {
    try {
      const alert = JSON.parse(msg);
      if (alert.imei === vehicle.imei && alert.alertType === 'safety_park') {
        alertTriggered = true;
        console.log('\n🚨 >>> POLICE SIREN THEFT ALARM FIRED! <<< 🚨');
        console.log(`Type       : ${alert.alertType}`);
        console.log(`Alert Text : ${alert.alertText}`);
        console.log(`Speed      : ${alert.speed} km/h`);
        console.log(`DeviceTime : ${alert.deviceTime}`);
        console.log('----------------------------------------------------');
        console.log('🔊 The frontend is now sounding the continuous Police Siren wail');
        console.log('   and displaying the emergency theft alarm bar across all screens!\n');
      }
    } catch (e) {}
  });

  // 4. Send Simulated Breach Packet: Engine turned ON (Ignition: true, Speed: 0)
  console.log('[Step 3] Simulating thief turning Engine ON while parked...');
  const packet = {
    imei: vehicle.imei,
    lat: 17.4399,
    lng: 78.3812,
    speed: 0,
    direction: 180,
    ignition: true,
    voltage: 12.8,
    isLive: true,
    deviceTime: new Date().toISOString()
  };
  await redis.publish('tracking', JSON.stringify(packet));

  // Wait 4 seconds to observe alert
  await new Promise(r => setTimeout(r, 4000));

  if (!alertTriggered) {
    console.log('⚠️ Alert not observed from background server. Note: Please restart "npm run start:api"');
    console.log('   in your backend terminal so it reloads the updated locationSubscriber.js code.');
  }

  // 5. Cleanup option
  console.log('\n[Step 4] Simulator complete.');
  console.log('To disarm Safety Parking in the UI, click "Turn OFF Safety Parking & Stop Siren" in the top banner');
  console.log('or click "Safety Park: ARMED" on the vehicle detail page.\n');

  sub.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Simulator error:', err);
  process.exit(1);
});
