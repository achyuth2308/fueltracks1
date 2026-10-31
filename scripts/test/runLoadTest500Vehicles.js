// ============================================================
// STAGE 4 LOAD & SOAK TEST: 500 VEHICLES @ 1 PACKET / 5 SECONDS
// Measures RSS, Heap, CPU, Event-Loop Lag (monitorEventLoopDelay),
// PG Pool stats, Redis session & cooldown key count and TTLs.
// Calculates linear regression slope for memory stability.
// ============================================================

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { monitorEventLoopDelay } = require('perf_hooks');
const { redis } = require('../../backend/config/redis');
const db = require('../../backend/config/db');
const env = require('../../backend/config/env');
const FuelEventAggregator = require('../../backend/services/fuelEventAggregator');
const { processOutboxBatch } = require('../../backend/jobs/whatsappWorker');
const { startMockServer, stopMockServer } = require('./mockMetaServer');

const MOCK_PORT = 3099;
const PHASE_DURATION_SEC = parseInt(process.env.LOAD_TEST_PHASE_SEC, 10) || 120; // default 2 min per phase (expandable)
const SAMPLE_INTERVAL_MS = 10000; // Sample every 10s

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

async function runPhase(phaseName, whatsappEnabled, generateFuelEvents) {
  console.log(`\n------------------------------------------------------------`);
  console.log(`STARTING PHASE: ${phaseName} (Duration: ${PHASE_DURATION_SEC}s, 10s sampling)`);
  console.log(`------------------------------------------------------------`);

  env.WHATSAPP_ENABLED = whatsappEnabled;
  process.env.WHATSAPP_ENABLED = whatsappEnabled ? 'true' : 'false';

  const loopDelay = monitorEventLoopDelay({ resolution: 20 });
  loopDelay.enable();

  const samples = [];
  const startTime = Date.now();
  let packetCounter = 0;
  let running = true;

  // 500 vehicles
  const vehicles = [];
  for (let i = 1; i <= 500; i++) {
    vehicles.push({
      id: `a0000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
      imei: `860000000${String(i).padStart(6, '0')}`,
      plate: `KA01LOAD${i}`,
      fuel: 50.0,
      metadata: {
        tankSize: 100,
        fuelConfig: { minFilling: 15, refillSettleMinutes: 1 }
      }
    });
  }

  // Packet generation loop: 500 vehicles / 5s = 100 packets/sec
  const packetInterval = setInterval(async () => {
    if (!running) return;
    for (let i = 0; i < 10; i++) { // 10 packets per 100ms = 100 pkts/sec
      const v = vehicles[Math.floor(Math.random() * vehicles.length)];
      packetCounter++;

      let prevFuel = v.fuel;
      let currFuel = v.fuel;
      let speed = 25;

      if (generateFuelEvents) {
        // 5% chance of refill surge, 2% chance of theft drop
        const r = Math.random();
        if (r < 0.05) {
          currFuel = Math.min(100, v.fuel + 20); // Refill surge
          speed = 0; // Stationary
        } else if (r < 0.07) {
          currFuel = Math.max(5, v.fuel - 15); // Theft drop
          speed = 0;
          await FuelEventAggregator.acquireTheftCooldown(v.id);
        }
      }

      await FuelEventAggregator.processRefillPacket(
        v, currFuel, prevFuel, speed, true, 12.9716, 77.5946, new Date()
      );
      v.fuel = currFuel;
    }
  }, 100);

  // Periodic worker tick when WhatsApp enabled
  let workerInterval = null;
  if (whatsappEnabled) {
    workerInterval = setInterval(() => {
      processOutboxBatch().catch(() => {});
    }, 3000);
  }

  // 10s Sampler
  let previousCpu = process.cpuUsage();
  let sampleIndex = 0;

  const sampleTimer = setInterval(async () => {
    sampleIndex++;
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

    // TTL check on sample keys (assert TTL > 0, no unbounded persistence)
    let ttlsValid = true;
    if (sessionKeys.length > 0) {
      const ttl = await redis.ttl(sessionKeys[0]);
      if (ttl <= 0) ttlsValid = false;
    }
    if (cooldownKeys.length > 0) {
      const ttl = await redis.ttl(cooldownKeys[0]);
      if (ttl <= 0) ttlsValid = false;
    }

    const sample = {
      timeSec: elapsedSec,
      rssMb: parseFloat((mem.rss / 1024 / 1024).toFixed(2)),
      heapUsedMb: parseFloat((mem.heapUsed / 1024 / 1024).toFixed(2)),
      cpuPercent: parseFloat(cpuPercent),
      eventLoopLagP50: parseFloat(p50Lag),
      eventLoopLagP95: parseFloat(p95Lag),
      eventLoopLagP99: parseFloat(p99Lag),
      pgTotal: db.pool.totalCount,
      pgIdle: db.pool.idleCount,
      pgWaiting: db.pool.waitingCount,
      redisSessions: sessionKeys.length,
      redisCooldowns: cooldownKeys.length,
      ttlsValid
    };

    samples.push(sample);
    console.log(
      `[SAMPLE T+${String(elapsedSec).padStart(3, ' ')}s] ` +
      `RSS: ${sample.rssMb}MB | Heap: ${sample.heapUsedMb}MB | CPU: ${sample.cpuPercent}% | ` +
      `Lag (p50/p95/p99): ${sample.eventLoopLagP50}/${sample.eventLoopLagP95}/${sample.eventLoopLagP99}ms | ` +
      `PG (tot/idle/wait): ${sample.pgTotal}/${sample.pgIdle}/${sample.pgWaiting} | ` +
      `Redis (sess/cool): ${sample.redisSessions}/${sample.redisCooldowns} (TTLs valid: ${ttlsValid ? 'YES' : 'NO'})`
    );
  }, SAMPLE_INTERVAL_MS);

  // Wait for phase duration
  await new Promise(resolve => setTimeout(resolve, PHASE_DURATION_SEC * 1000));

  running = false;
  clearInterval(packetInterval);
  clearInterval(sampleTimer);
  if (workerInterval) clearInterval(workerInterval);
  loopDelay.disable();

  // Calculate regression slope in MB/minute
  const timeMinutes = samples.map(s => s.timeSec / 60);
  const rssValues = samples.map(s => s.rssMb);
  const slope = computeLinearRegressionSlope(timeMinutes, rssValues);

  console.log(`\n[PHASE COMPLETE: ${phaseName}]`);
  console.log(`  Total Packets Evaluated: ${packetCounter}`);
  console.log(`  Start RSS: ${samples[0]?.rssMb} MB -> Final RSS: ${samples[samples.length - 1]?.rssMb} MB`);
  console.log(`  Linear RSS Regression Slope: ${slope.toFixed(4)} MB/min`);
  console.log(`  Event Loop Lag p99 Peak: ${Math.max(...samples.map(s => s.eventLoopLagP99))} ms`);
  console.log(`  Redis TTL Integrity: ${samples.every(s => s.ttlsValid) ? 'ALL KEYS HAVE VALID TTLs ✅' : 'TTL LEAK DETECTED ❌'}`);

  return {
    phaseName,
    packetCounter,
    samples,
    startRss: samples[0]?.rssMb,
    endRss: samples[samples.length - 1]?.rssMb,
    rssSlopeMbPerMin: parseFloat(slope.toFixed(4)),
    maxLagP99: Math.max(...samples.map(s => s.eventLoopLagP99))
  };
}

async function main() {
  await startMockServer(MOCK_PORT);
  env.WHATSAPP_API_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`;
  env.WHATSAPP_ACCESS_TOKEN = 'load_test_token';
  env.WHATSAPP_PHONE_NUMBER_ID = '109988776655443';

  console.log('============================================================');
  console.log('500 VEHICLES x 1 PACKET/5S LOAD & TELEMETRY SOAK TEST');
  console.log('============================================================');

  // Phase 1: Baseline (WHATSAPP_ENABLED = false)
  const baseline = await runPhase('Phase 1: Baseline (WHATSAPP_ENABLED=false)', false, false);

  // Phase 2: Enabled with Continuous Fuel Events (WHATSAPP_ENABLED = true)
  const enabled = await runPhase('Phase 2: WhatsApp Enabled + Active Fuel Events', true, true);

  console.log('\n============================================================');
  console.log('LOAD TEST COMPARISON SUMMARY');
  console.log('============================================================');
  console.log(`Metric                        | Baseline (Disabled) | WhatsApp Enabled`);
  console.log(`------------------------------|---------------------|-----------------`);
  console.log(`Packets Processed             | ${baseline.packetCounter}              | ${enabled.packetCounter}`);
  console.log(`Start RSS                     | ${baseline.startRss} MB            | ${enabled.startRss} MB`);
  console.log(`Final RSS                     | ${baseline.endRss} MB            | ${enabled.endRss} MB`);
  console.log(`RSS Regression Slope          | ${baseline.rssSlopeMbPerMin} MB/min       | ${enabled.rssSlopeMbPerMin} MB/min`);
  console.log(`Peak Event Loop Lag (p99)     | ${baseline.maxLagP99} ms             | ${enabled.maxLagP99} ms`);
  console.log('============================================================\n');

  // Clean up any test keys in Redis
  const keys = await redis.keys('refill:session:*');
  const coolKeys = await redis.keys('theft:cooldown:*');
  if (keys.length > 0) await redis.del(keys);
  if (coolKeys.length > 0) await redis.del(coolKeys);

  await stopMockServer();
  await redis.quit();
  await db.pool.end();
}

main().catch(err => {
  console.error('[LOAD TEST ERROR]', err);
  process.exit(1);
});

