// ============================================================
// REFILL AGGREGATOR HISTORICAL BACKTEST TOOL
// Replays historical fuel telemetry from gps_points through
// FuelEventAggregator to evaluate refill detection accuracy.
// Usage: node scripts/test/backtestRefills.js [--vehicles 5] [--days 7]
// ============================================================

'use strict';

const db = require('../../backend/config/db');
const { redis } = require('../../backend/config/redis');
const FuelEventAggregator = require('../../backend/services/fuelEventAggregator');

async function ensureSeedTelemetry(vehicleId, imei) {
  // Check if gps_points has points for this vehicle
  const check = await db.query(
    'SELECT COUNT(*)::int as count FROM gps_points WHERE vehicle_id = $1 AND fuel > 0',
    [vehicleId]
  );

  if (check.rows[0].count > 10) {
    console.log(`Found ${check.rows[0].count} existing telemetry points for vehicle ${imei}. Replaying existing points.`);
    return;
  }

  console.log(`Seeding realistic multi-day fuel telemetry for vehicle ${imei} (${vehicleId})...`);
  // Generate realistic timeline:
  // Day 1:
  // - 08:00 Driving (fuel drops from 60L to 35L)
  // - 11:00 Station stop: speed = 0, ignition = false.
  // - 11:02 Pump start: 35L -> 50L -> 75L -> 95L (Multi-step refill +60L)
  // - 11:03 to 11:09: Stationary settlement (6 minutes quiet > 5 min settleMinutes) -> Refill #1 finalized!
  // - 11:10 Drive away: speed = 45 km/h, fuel = 95L
  // Day 2:
  // - Normal driving with slosh while moving (fuel oscillates 80L -> 85L -> 79L at 50 km/h) -> Should NOT trigger refill
  // - Sensor spike while stationary (momentary glitch 60L -> 90L -> 60L within 20s) -> Should NOT trigger refill
  // - 16:00 Second legitimate refill (+30L from 40L to 70L, drives away after 2 mins) -> Finalized on drive-off!

  const points = [];
  let baseTime = new Date(Date.now() - 2 * 86400000); // 2 days ago

  const addPoint = (minutesOffset, speed, ignition, fuel, lat = 17.44, lng = 78.38) => {
    const ptTime = new Date(baseTime.getTime() + minutesOffset * 60000);
    points.push({
      vehicle_id: vehicleId,
      lat, lng, speed, direction: 90, odometer: Math.round(10000 + minutesOffset),
      fuel, ignition: Boolean(ignition), satellites: 12, gsm_signal: 25, battery: 100,
      voltage: 12.6, is_live: true, is_valid: true,
      device_time: ptTime, server_time: ptTime
    });
  };

  // Phase 1: Driving (0 to 60 mins)
  for (let m = 0; m <= 60; m += 2) {
    addPoint(m, 40, 1, 60 - (m * 0.4)); // drops from 60L to ~36L
  }

  // Phase 2: Refill #1 at minute 70 (Stationary)
  addPoint(68, 0, 0, 35.0);
  addPoint(70, 0, 0, 35.0); // start
  addPoint(71, 0, 0, 55.0); // step 1
  addPoint(72, 0, 0, 75.0); // step 2
  addPoint(73, 0, 0, 95.0); // peak reached (+60L)
  // Quiet settle period: 6 mins (from min 73 to 79)
  addPoint(75, 0, 0, 95.0);
  addPoint(77, 0, 0, 94.8);
  addPoint(79, 0, 0, 95.0); // 6 mins since peak -> settleMinutes=5 satisfied!
  addPoint(82, 35, 1, 94.5); // drives off

  // Phase 3: Day 2 Slosh & Sensor Glitch (minute 1400 to 1430)
  for (let m = 1400; m <= 1420; m += 2) {
    const slosh = (m % 4 === 0) ? 6 : -3;
    addPoint(m, 50, 1, 80.0 + slosh); // slosh while moving -> rejected
  }
  // Sensor glitch while stationary (minute 1440)
  addPoint(1438, 0, 0, 60.0);
  addPoint(1440, 0, 0, 90.0); // momentary jump +30L
  addPoint(1440.5, 0, 0, 60.2); // drops immediately back -> spike rejected!

  // Phase 4: Refill #2 at minute 1600 (+30L from 40L to 70L, drives away mid-session)
  addPoint(1598, 0, 0, 40.0);
  addPoint(1600, 0, 0, 40.0);
  addPoint(1601, 0, 0, 55.0);
  addPoint(1602, 0, 0, 70.0); // +30L
  addPoint(1604, 30, 1, 69.8); // vehicle drives off before settle timeout -> finalizes on vehicle_moved!

  // Bulk insert into gps_points
  for (const pt of points) {
    await db.query(`
      INSERT INTO gps_points (
        vehicle_id, lat, lng, speed, direction, odometer, fuel, ignition,
        satellites, gsm_signal, battery, voltage, is_live, is_valid, device_time, server_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    `, [
      pt.vehicle_id, pt.lat, pt.lng, pt.speed, pt.direction, pt.odometer, pt.fuel,
      pt.ignition, pt.satellites, pt.gsm_signal, pt.battery, pt.voltage,
      pt.is_live, pt.is_valid, pt.device_time, pt.server_time
    ]);
  }

  console.log(`Seeded ${points.length} telemetry points.`);
}

async function runBacktest() {
  console.log('============================================================');
  console.log('  🧪 FUEL REFILL AGGREGATOR HISTORICAL BACKTEST ENGINE');
  console.log('============================================================');

  // Load target vehicles
  const vRes = await db.query(`
    SELECT id, imei, plate, name, metadata
    FROM vehicles
    LIMIT 3
  `);

  if (vRes.rows.length === 0) {
    console.error('No vehicles found in database.');
    return;
  }

  const results = [];

  for (const vehicle of vRes.rows) {
    // Ensure vehicle has fuelConfig
    vehicle.metadata = vehicle.metadata || {};
    vehicle.metadata.tankSize = vehicle.metadata.tankSize || 100;
    vehicle.metadata.fuelConfig = vehicle.metadata.fuelConfig || {
      minFilling: 15,
      minTheft: 15,
      refillSettleMinutes: 5
    };

    console.log(`\nReplaying vehicle: ${vehicle.plate || vehicle.name} (${vehicle.imei})`);
    console.log(`Tank Size: ${vehicle.metadata.tankSize}L | minFilling: ${vehicle.metadata.fuelConfig.minFilling}L | settleMinutes: ${vehicle.metadata.fuelConfig.refillSettleMinutes}m`);

    // Ensure seed points exist
    await ensureSeedTelemetry(vehicle.id, vehicle.imei);

    // Fetch chronological points
    const ptsRes = await db.query(`
      SELECT lat, lng, speed, ignition, fuel, device_time
      FROM gps_points
      WHERE vehicle_id = $1 AND fuel IS NOT NULL
      ORDER BY device_time ASC
    `, [vehicle.id]);

    const pts = ptsRes.rows;
    console.log(`Loaded ${pts.length} chronological telemetry packets.`);

    // Reset Redis session key for vehicle before replaying
    await redis.del(`refill:session:${vehicle.id}`);

    const detectedRefills = [];
    let prevFuel = null;

    for (let i = 0; i < pts.length; i++) {
      const pt = pts[i];
      const currFuel = parseFloat(pt.fuel);
      if (prevFuel === null) {
        prevFuel = currFuel;
        continue;
      }

      const alert = await FuelEventAggregator.processRefillPacket(
        vehicle,
        currFuel,
        prevFuel,
        pt.speed || 0,
        pt.ignition !== false,
        parseFloat(pt.lat) || 17.44,
        parseFloat(pt.lng) || 78.38,
        pt.device_time
      );

      if (alert) {
        detectedRefills.push(alert);
      }

      prevFuel = currFuel;
    }

    console.log(`\n--- Backtest Detection Results for ${vehicle.plate || vehicle.imei} ---`);
    console.log(`Total detected confirmed refills: ${detectedRefills.length}`);

    detectedRefills.forEach((refill, idx) => {
      const p = refill.alertPayload;
      const durationMin = ((new Date(p.endTime).getTime() - new Date(p.startTime).getTime()) / 60000).toFixed(1);
      console.log(`  [Refill #${idx + 1}]`);
      console.log(`    Start Time:   ${new Date(p.startTime).toISOString()} (Start Level: ${p.startLevel}L)`);
      console.log(`    End Time:     ${new Date(p.endTime).toISOString()} (End Level: ${p.endLevel}L)`);
      console.log(`    Added Litres: +${p.addedLitres}L`);
      console.log(`    Duration:     ${durationMin} minutes`);
      console.log(`    Finalized By: ${p.reason}`);
      console.log(`    Alert Text:   ${refill.alertText}`);
    });

    results.push({
      vehicle: vehicle.plate || vehicle.imei,
      packetsReplayed: pts.length,
      refillsDetected: detectedRefills.length,
      refills: detectedRefills
    });
  }

  console.log('\n============================================================');
  console.log('  ✅ BACKTEST RUN COMPLETED SUCCESSFULLY');
  console.log('============================================================');
  await db.pool.end();
  try { redis.client.disconnect(); } catch (_) {}
  process.exit(0);
}

runBacktest().catch(err => {
  console.error('Backtest error:', err);
  process.exit(1);
});
