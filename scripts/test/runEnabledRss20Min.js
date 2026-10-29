// ============================================================
// 20-MINUTE ENABLED PHASE SOAK TEST WITH EXPOSE-GC
// Samples RSS, external, and arrayBuffers every 30s
// Evaluates flat plateau over the last 10 minutes
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
const DURATION_SEC = parseInt(process.env.SOAK_DURATION_SEC, 10) || 1200; // 20 minutes (1200s)
const SAMPLE_INTERVAL_MS = 30000; // 30s sampling

function computeSlope(xVals, yVals) {
  const n = xVals.length;
  if (n < 2) return 0;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += xVals[i];
    sumY += yVals[i];
    sumXY += xVals[i] * yVals[i];
    sumXX += xVals[i] * xVals[i];
  }
  const denom = (n * sumXX - sumX * sumX);
  return denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
}

const mockIo = {
  to: () => mockIo,
  emit: () => {}
};

async function seedTestFleet(vehicleCount = 500) {
  let orgRes = await db.query("SELECT id FROM organizations WHERE name = 'LoadTest Fleet Corp' LIMIT 1");
  let orgId = orgRes.rows[0]?.id;
  if (!orgId) {
    const ins = await db.query(`
      INSERT INTO organizations (name, type, settings)
      VALUES ('LoadTest Fleet Corp', 'fleet_owner', '{"alert_matrix":{"fuel_refill":{"whatsapp":true},"fuel_theft":{"whatsapp":true}}}')
      RETURNING id
    `);
    orgId = ins.rows[0].id;
  }
  const vehicles = await db.query('SELECT id, imei, plate, metadata FROM vehicles WHERE org_id = $1 LIMIT $2', [orgId, vehicleCount]);
  return vehicles.rows;
}

async function run() {
  await startMockServer(MOCK_PORT);
  env.WHATSAPP_ENABLED = true;
  env.WHATSAPP_API_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`;
  env.WHATSAPP_ACCESS_TOKEN = 'soak_20m_test_token';
  env.WHATSAPP_PHONE_NUMBER_ID = '109988776655443';

  console.log('[SOAK-20M] Seeding/verifying fleet vehicles...');
  const vehicles = await seedTestFleet(500);

  console.log('[SOAK-20M] Starting subscribers & outbox worker...');
  await locationSubscriber.start(mockIo);
  await alertSubscriber.start(mockIo);

  const workerInterval = setInterval(async () => {
    try { await processOutboxBatch(); } catch (_) {}
  }, 2000);

  const loopDelay = monitorEventLoopDelay({ resolution: 20 });
  loopDelay.enable();

  let running = true;
  let packetCounter = 0;
  const startTime = Date.now();
  const samples = [];

  // Packet publisher (100 pkt/s drift-compensated)
  const publisher = setInterval(async () => {
    if (!running) return;
    const elapsedMs = Date.now() - startTime;
    const targetPackets = Math.floor(elapsedMs * 0.1);
    const toSend = Math.max(0, Math.min(50, targetPackets - packetCounter));

    for (let i = 0; i < toSend; i++) {
      const v = vehicles[(packetCounter + i) % vehicles.length];
      const isTheft = (packetCounter + i) % 800 === 0;
      const isRefill = (packetCounter + i) % 1500 === 0;

      let fuel = 50.0;
      let speed = 30;
      if (isTheft) {
        fuel = 30.0; // 20L drop -> theft alert
        speed = 0;
      } else if (isRefill) {
        fuel = 75.0; // 25L rise -> refill session
        speed = 0;
      }

      const packet = {
        imei: v.imei,
        lat: 12.9716,
        lng: 77.5946,
        speed,
        direction: 90,
        altitude: 900,
        ignition: speed > 0,
        voltage: 12.6,
        fuel,
        odometer: 10000,
        deviceTime: new Date().toISOString(),
        isLive: true
      };
      redis.publish('tracking', JSON.stringify(packet)).catch(() => {});
    }
    packetCounter += toSend;
  }, 50);

  // 30s Sampler
  const sampler = setInterval(() => {
    if (!running) return;
    if (global.gc) global.gc();

    const mem = process.memoryUsage();
    const elapsedSec = Math.round((Date.now() - startTime) / 1000);
    const rssMb = parseFloat((mem.rss / 1024 / 1024).toFixed(2));
    const heapUsedMb = parseFloat((mem.heapUsed / 1024 / 1024).toFixed(2));
    const externalMb = parseFloat((mem.external / 1024 / 1024).toFixed(2));
    const arrayBuffersMb = parseFloat((mem.arrayBuffers / 1024 / 1024).toFixed(2));
    const p99Lag = parseFloat((loopDelay.percentile(99) / 1e6).toFixed(2));
    loopDelay.reset();

    const sample = {
      elapsedSec,
      minute: (elapsedSec / 60).toFixed(1),
      rssMb,
      heapUsedMb,
      externalMb,
      arrayBuffersMb,
      p99Lag,
      packets: packetCounter
    };
    samples.push(sample);

    console.log(`[SOAK T+${sample.minute}m] RSS: ${rssMb}MB, Heap: ${heapUsedMb}MB, Ext: ${externalMb}MB, ArrBuf: ${arrayBuffersMb}MB, p99: ${p99Lag}ms, pkts: ${packetCounter}`);
  }, SAMPLE_INTERVAL_MS);

  // Wait for 20 minutes
  await new Promise(r => setTimeout(r, DURATION_SEC * 1000));

  running = false;
  clearInterval(publisher);
  clearInterval(sampler);
  clearInterval(workerInterval);
  loopDelay.disable();

  // Analyze First 10m vs Last 10m
  const first10m = samples.filter(s => s.elapsedSec <= 600);
  const last10m = samples.filter(s => s.elapsedSec > 600);

  const tFirstMin = first10m.map(s => s.elapsedSec / 60);
  const rssFirst = first10m.map(s => s.rssMb);
  const slopeFirst10 = computeSlope(tFirstMin, rssFirst);

  const tLastMin = last10m.map(s => s.elapsedSec / 60);
  const rssLast = last10m.map(s => s.rssMb);
  const slopeLast10 = computeSlope(tLastMin, rssLast);

  const extLast = last10m.map(s => s.externalMb);
  const slopeExtLast10 = computeSlope(tLastMin, extLast);

  const abLast = last10m.map(s => s.arrayBuffersMb);
  const slopeAbLast10 = computeSlope(tLastMin, abLast);

  console.log('\n========================================================================');
  console.log('20-MINUTE SOAK MEMORY ANALYSIS (ENABLED PHASE WITH --EXPOSE-GC)');
  console.log('========================================================================');
  console.log(`Total Duration:            ${(DURATION_SEC / 60).toFixed(0)} minutes`);
  console.log(`Total Packets Processed:   ${packetCounter}`);
  console.log(`Initial RSS (T=0.5m):      ${samples[0]?.rssMb} MB`);
  console.log(`Midpoint RSS (T=10m):      ${first10m[first10m.length - 1]?.rssMb} MB`);
  console.log(`Final RSS (T=20m):         ${samples[samples.length - 1]?.rssMb} MB`);
  console.log(`First 10-Min RSS Slope:    ${slopeFirst10.toFixed(4)} MB/min`);
  console.log(`Last 10-Min RSS Slope:     ${slopeLast10.toFixed(4)} MB/min (Plateau check: ${Math.abs(slopeLast10) < 0.2 ? 'FLAT PLATEAU ✅' : 'CLIMBING ⚠️'})`);
  console.log(`Last 10-Min External Slope:${slopeExtLast10.toFixed(4)} MB/min (Start: ${last10m[0]?.externalMb} MB, End: ${last10m[last10m.length - 1]?.externalMb} MB)`);
  console.log(`Last 10-Min ArrBuf Slope:  ${slopeAbLast10.toFixed(4)} MB/min (Start: ${last10m[0]?.arrayBuffersMb} MB, End: ${last10m[last10m.length - 1]?.arrayBuffersMb} MB)`);
  console.log('========================================================================\n');

  await locationSubscriber.stop();
  await alertSubscriber.stop();
  await stopMockServer();
  await redis.quit();
  await db.pool.end();
  process.exit(0);
}

run().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});

