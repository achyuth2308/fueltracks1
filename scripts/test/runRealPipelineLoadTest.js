// ============================================================
// REAL PIPELINE LOAD & SOAK TEST: 500 VEHICLES x 1 PKT/5S
// Full pipeline:
// Publisher -> Redis 'tracking' -> locationSubscriber -> gps_points & alerts
// -> alertSubscriber -> NotificationService -> whatsapp_messages (outbox)
// -> whatsappWorker -> Mock Meta Server (:3099)
// ============================================================

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { monitorEventLoopDelay } = require('perf_hooks');
const { redis } = require('../../backend/config/redis');
const db = require('../../backend/config/db');
const env = require('../../backend/config/env');
const locationSubscriber = require('../../backend/subscribers/locationSubscriber');
const alertSubscriber = require('../../backend/subscribers/alertSubscriber');
const { processOutboxBatch } = require('../../backend/jobs/whatsappWorker');
const { startMockServer, stopMockServer } = require('./mockMetaServer');

const MOCK_PORT = 3099;
// Phase duration: default 480s (8 min: 2m warmup + 6m measurement window)
const PHASE_DURATION_SEC = parseInt(process.env.LOAD_TEST_DURATION_SEC, 10) || 480;
const SAMPLE_INTERVAL_MS = 10000; // 10s sampling

function computeLinearRegressionSlope(xVals, yVals) {
  const n = xVals.length;
  if (n < 2) return 0;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += xVals[i];
    sumY += yVals[i];
    sumXY += xVals[i] * yVals[i];
    sumXX += xVals[i] * xVals[i];
  }
  const denominator = (n * sumXX - sumX * sumX);
  return denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
}

// Mock Socket.io
const mockIo = {
  to: () => mockIo,
  emit: () => {}
};

async function seedTestFleet(vehicleCount = 500) {
  // 1. Get or create test org with alert_matrix
  let orgRes = await db.query("SELECT id FROM organizations WHERE name = 'LoadTest Fleet Corp' LIMIT 1");
  let orgId;
  if (orgRes.rows.length === 0) {
    const ins = await db.query(`
      INSERT INTO organizations (name, type, settings)
      VALUES (
        'LoadTest Fleet Corp', 
        'customer', 
        '{"alert_matrix": {"fuel_theft": {"whatsapp": true}, "fuel_refill": {"whatsapp": true}, "fuel_refill_final": {"whatsapp": true}}}'::jsonb
      ) RETURNING id
    `);
    orgId = ins.rows[0].id;
  } else {
    orgId = orgRes.rows[0].id;
    await db.query(`
      UPDATE organizations 
      SET settings = '{"alert_matrix": {"fuel_theft": {"whatsapp": true}, "fuel_refill": {"whatsapp": true}, "fuel_refill_final": {"whatsapp": true}}}'::jsonb
      WHERE id = $1
    `, [orgId]);
  }

  // 2. Add WhatsApp Recipient
  const recipRes = await db.query("SELECT id FROM whatsapp_recipients WHERE org_id = $1 LIMIT 1", [orgId]);
  if (recipRes.rows.length === 0) {
    await db.query(`
      INSERT INTO whatsapp_recipients (org_id, name, phone_e164, opt_in, receive_refill, receive_theft, receive_daily_report)
      VALUES ($1, 'Fleet Manager', '+919876543210', true, true, true, true)
    `, [orgId]);
  }

  // 3. Bulk seed 500 vehicles with direct fuel calibration
  const vehicles = [];
  const baseImei = 880000000000000n;
  for (let i = 1; i <= vehicleCount; i++) {
    const imei = String(baseImei + BigInt(i));
    const plate = `KA05LT${String(i).padStart(4, '0')}`;
    vehicles.push({ index: i, imei, plate });
  }

  await db.query(`
    INSERT INTO vehicles (id, org_id, imei, plate, name, is_active, metadata)
    SELECT
      ('b0000000-0000-0000-0000-' || LPAD(i::text, 12, '0'))::uuid,
      $1,
      (880000000000000 + i)::text,
      'KA05LT' || LPAD(i::text, 4, '0'),
      'LoadTest Vehicle ' || i,
      true,
      '{"tankSize": 100, "fuelConfig": {"minFilling": 15, "minTheft": 10, "refillSettleMinutes": 1}, "fuelCalibration": {"calibrateType": "Direct", "directMultiplier": 1.0, "directOffset": 0.0}}'::jsonb
    FROM generate_series(1, $2::int) AS i
    ON CONFLICT (imei) DO UPDATE
    SET metadata = EXCLUDED.metadata;
  `, [orgId, vehicleCount]);

  // Seed latest state
  await db.query(`
    INSERT INTO vehicle_latest_state (vehicle_id, lat, lng, fuel, speed, ignition, is_online, last_seen)
    SELECT
      ('b0000000-0000-0000-0000-' || LPAD(i::text, 12, '0'))::uuid,
      12.9716 + (i % 100) * 0.001,
      77.5946 + FLOOR(i / 100) * 0.001,
      50.0,
      0,
      true,
      true,
      NOW()
    FROM generate_series(1, $1::int) AS i
    ON CONFLICT (vehicle_id) DO UPDATE
    SET lat = EXCLUDED.lat, lng = EXCLUDED.lng, fuel = 50.0, speed = 0, ignition = true, is_online = true, last_seen = NOW();
  `, [vehicleCount]);

  return vehicles;
}

async function runPhase(phaseName, whatsappEnabled, generateFuelEvents, vehicles, durationSec) {
  env.WHATSAPP_ENABLED = whatsappEnabled;
  process.env.WHATSAPP_ENABLED = whatsappEnabled ? 'true' : 'false';

  const loopDelay = monitorEventLoopDelay({ resolution: 20 });
  loopDelay.enable();

  let packetCounter = 0;
  let running = true;
  const startTime = Date.now();
  const samples = [];
  const targetTotalPackets = durationSec * 100; // 100 pkts/s target

  // Local state for vehicles to simulate continuous fuel changes
  const vehicleStates = new Map();
  for (const v of vehicles) {
    vehicleStates.set(v.imei, { 
      fuel: 50.0, 
      speed: 20,
      lat: 12.9716 + (v.index % 100) * 0.001,
      lng: 77.5946 + Math.floor(v.index / 100) * 0.001
    });
  }

  // Drift-compensated precision publisher loop: guarantees target = actual packets
  const publisherInterval = setInterval(() => {
    if (!running) return;
    const elapsedMs = Date.now() - startTime;
    const targetCount = Math.min(targetTotalPackets, Math.floor(elapsedMs * 0.1));

    while (packetCounter < targetCount && running) {
      const v = vehicles[packetCounter % vehicles.length];
      packetCounter++;

      const st = vehicleStates.get(v.imei);
      let speed = 25;
      let currFuel = st.fuel;

      if (generateFuelEvents) {
        const rand = Math.random();
        if (rand < 0.04) {
          currFuel = Math.min(100, st.fuel + 25);
          speed = 0;
        } else if (rand < 0.06) {
          currFuel = Math.max(5, st.fuel - 18);
          speed = 0;
        } else {
          currFuel = Math.max(10, st.fuel - 0.01);
        }
      }

      st.fuel = currFuel;
      st.speed = speed;
      if (speed > 0) {
        st.lat += 0.00005;
      }

      const trackingPacket = {
        imei: v.imei,
        lat: st.lat,
        lng: st.lng,
        speed,
        ignition: true,
        fuel: currFuel,
        deviceTime: new Date().toISOString(),
        device_time: new Date().toISOString(),
        isLive: true,
        is_live: true
      };

      redis.publish('tracking', JSON.stringify(trackingPacket)).catch(() => {});
    }
  }, 25);

  // Worker loop when WhatsApp enabled
  let workerInterval = null;
  if (whatsappEnabled) {
    workerInterval = setInterval(() => {
      processOutboxBatch().catch(() => {});
    }, 2000);
  }

  // 10s Metric Sampler with forced GC to measure true retained memory
  let previousCpu = process.cpuUsage();

  const samplerInterval = setInterval(async () => {
    if (global.gc) {
      global.gc();
    }

    const now = Date.now();
    const elapsedSec = Math.round((now - startTime) / 1000);

    const mem = process.memoryUsage();
    const currentCpu = process.cpuUsage(previousCpu);
    previousCpu = process.cpuUsage();
    const cpuPercent = ((currentCpu.user + currentCpu.system) / 1000000 / (SAMPLE_INTERVAL_MS / 1000) * 100).toFixed(1);

    const p50Lag = (loopDelay.percentile(50) / 1e6).toFixed(2);
    const p95Lag = (loopDelay.percentile(95) / 1e6).toFixed(2);
    const p99Lag = (loopDelay.percentile(99) / 1e6).toFixed(2);
    loopDelay.reset();

    // Redis key checks
    const sessionKeys = await redis.keys('refill:session:*');
    const cooldownKeys = await redis.keys('theft:cooldown:*');

    let ttlsValid = true;
    let keysWithoutTtl = 0;
    for (const k of sessionKeys) {
      const ttl = await redis.ttl(k);
      if (ttl === -1) { ttlsValid = false; keysWithoutTtl++; }
    }
    for (const k of cooldownKeys) {
      const ttl = await redis.ttl(k);
      if (ttl === -1) { ttlsValid = false; keysWithoutTtl++; }
    }

    const sample = {
      timeSec: elapsedSec,
      packets: packetCounter,
      rssMb: parseFloat((mem.rss / 1024 / 1024).toFixed(2)),
      heapUsedMb: parseFloat((mem.heapUsed / 1024 / 1024).toFixed(2)),
      cpuPercent: parseFloat(cpuPercent),
      p50Lag: parseFloat(p50Lag),
      p95Lag: parseFloat(p95Lag),
      p99Lag: parseFloat(p99Lag),
      pgTotal: db.pool.totalCount,
      pgIdle: db.pool.idleCount,
      pgWaiting: db.pool.waitingCount,
      redisSessions: sessionKeys.length,
      redisCooldowns: cooldownKeys.length,
      ttlsValid,
      keysWithoutTtl
    };

    samples.push(sample);
  }, SAMPLE_INTERVAL_MS);

  // Wait for duration
  await new Promise(r => setTimeout(r, durationSec * 1000));

  running = false;
  clearInterval(publisherInterval);
  clearInterval(samplerInterval);
  if (workerInterval) clearInterval(workerInterval);
  loopDelay.disable();

  // 5s drain
  await new Promise(r => setTimeout(r, 5000));

  // Compute post-warmup slope (warmup: 120s / 2m, measurement: remaining 6m)
  const warmupSec = 120;
  const postWarmupSamples = samples.filter(s => s.timeSec >= warmupSec);
  const timeMinutes = postWarmupSamples.map(s => s.timeSec / 60);
  const rssValues = postWarmupSamples.map(s => s.rssMb);
  const heapValues = postWarmupSamples.map(s => s.heapUsedMb);

  const rssSlope = computeLinearRegressionSlope(timeMinutes, rssValues);
  const heapSlope = computeLinearRegressionSlope(timeMinutes, heapValues);

  return {
    phaseName,
    targetPackets: targetTotalPackets,
    actualPackets: packetCounter,
    samples,
    startRss: samples[0]?.rssMb,
    endRss: samples[samples.length - 1]?.rssMb,
    postWarmupStartRss: postWarmupSamples[0]?.rssMb,
    postWarmupEndRss: postWarmupSamples[postWarmupSamples.length - 1]?.rssMb,
    rssSlopeMbPerMin: parseFloat(rssSlope.toFixed(4)),
    heapSlopeMbPerMin: parseFloat(heapSlope.toFixed(4)),
    maxLagP99: Math.max(...samples.map(s => s.p99Lag)),
    p99PostWarmupMax: Math.max(...postWarmupSamples.map(s => s.p99Lag)),
    pgTotal: samples[samples.length - 1]?.pgTotal,
    pgIdle: samples[samples.length - 1]?.pgIdle,
    pgWaiting: samples[samples.length - 1]?.pgWaiting,
    allTtlsValid: samples.every(s => s.ttlsValid),
    keysWithoutTtl: Math.max(...samples.map(s => s.keysWithoutTtl))
  };
}

async function main() {
  await startMockServer(MOCK_PORT);
  env.WHATSAPP_API_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`;
  env.WHATSAPP_ACCESS_TOKEN = 'load_test_real_pipeline_token';
  env.WHATSAPP_PHONE_NUMBER_ID = '109988776655443';

  // Seed 500 fleet vehicles
  const vehicles = await seedTestFleet(500);

  // Start subscribers
  await locationSubscriber.start(mockIo);
  await alertSubscriber.start(mockIo);

  const durationSec = PHASE_DURATION_SEC; // 480s (8 min)

  // Phase 1: Baseline (WHATSAPP_ENABLED = false)
  const baseline = await runPhase('Baseline (WHATSAPP_ENABLED=false)', false, false, vehicles, durationSec);

  // Clean redis keys between phases
  const keys = await redis.keys('refill:session:*');
  if (keys.length > 0) await redis.del(keys);

  // Phase 2: WhatsApp Enabled + Active Fuel Events (WHATSAPP_ENABLED = true)
  const enabled = await runPhase('WhatsApp Enabled (Active Fuel Events)', true, true, vehicles, durationSec);

  // Final Single Comparison Table
  console.log('\n========================================================================================');
  console.log('FINAL COMPARISON TABLE: BASELINE VS WHATSAPP ENABLED (8-MIN RUN, 2-MIN WARM-UP)');
  console.log('========================================================================================');
  console.log(`Metric                              | Baseline (Disabled) | WhatsApp Enabled    | Pass Criteria`);
  console.log(`------------------------------------|---------------------|---------------------|---------------`);
  console.log(`Packets (Target vs Actual)          | ${baseline.targetPackets} / ${baseline.actualPackets}`.padEnd(36) + `| ${enabled.targetPackets} / ${enabled.actualPackets}`.padEnd(22) + `| Target == Actual`);
  console.log(`RSS Memory (Start / End)            | ${baseline.startRss} / ${baseline.endRss} MB`.padEnd(36) + `| ${enabled.startRss} / ${enabled.endRss} MB`.padEnd(22) + `| Under PM2 512M`);
  console.log(`Post-Warmup RSS Slope (T >= 2m)     | ${baseline.rssSlopeMbPerMin} MB/min`.padEnd(36) + `| ${enabled.rssSlopeMbPerMin} MB/min`.padEnd(22) + `| < 0.5 MB/min`);
  console.log(`Post-Warmup HeapUsed Slope (T >= 2m)| ${baseline.heapSlopeMbPerMin} MB/min`.padEnd(36) + `| ${enabled.heapSlopeMbPerMin} MB/min`.padEnd(22) + `| < 0.5 MB/min`);
  console.log(`Event-Loop Lag p99 (Peak)           | ${baseline.maxLagP99} ms`.padEnd(36) + `| ${enabled.maxLagP99} ms`.padEnd(22) + `| < 100 ms & ~base`);
  console.log(`PG Pool (Total / Idle / Waiting)    | ${baseline.pgTotal} / ${baseline.pgIdle} / ${baseline.pgWaiting}`.padEnd(36) + `| ${enabled.pgTotal} / ${enabled.pgIdle} / ${enabled.pgWaiting}`.padEnd(22) + `| Waiting == 0`);
  console.log(`Redis Keys Without TTL              | ${baseline.keysWithoutTtl}`.padEnd(36) + `| ${enabled.keysWithoutTtl}`.padEnd(22) + `| 0 keys`);
  console.log('========================================================================================\n');

  // Teardown
  await locationSubscriber.stop();
  await alertSubscriber.stop();
  await stopMockServer();
  await redis.quit();
  await db.pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
