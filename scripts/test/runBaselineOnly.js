// ============================================================
// BASELINE ONLY: 500 VEHICLES x 1 PKT/5S FOR 8 MINUTES
// With 60s settling period before sampling
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

const DURATION_SEC = 480; // 8 minutes
const SETTLE_SEC = 60; // 60s settling
const SAMPLE_INTERVAL_MS = 10000; // 10s

const mockIo = {
  to: () => mockIo,
  emit: () => {}
};

async function seedTestFleet(vehicleCount = 500) {
  let orgRes = await db.query("SELECT id FROM organizations WHERE name = 'LoadTest Fleet Corp' LIMIT 1");
  let orgId;
  if (orgRes.rows.length === 0) {
    const ins = await db.query(`
      INSERT INTO organizations (name, type, settings)
      VALUES ('LoadTest Fleet Corp', 'fleet_owner', '{"alert_matrix":{"fuel_refill":{"whatsapp":true},"fuel_theft":{"whatsapp":true}}}')
      RETURNING id
    `);
    orgId = ins.rows[0].id;
  } else {
    orgId = orgRes.rows[0].id;
  }

  const existing = await db.query('SELECT id, imei, plate FROM vehicles WHERE org_id = $1 LIMIT $2', [orgId, vehicleCount]);
  if (existing.rows.length >= vehicleCount) {
    return existing.rows;
  }

  const needed = vehicleCount - existing.rows.length;
  for (let i = 0; i < needed; i++) {
    const idx = existing.rows.length + i;
    const imei = `999000000000${String(idx).padStart(3, '0')}`;
    const plate = `KA05LT${String(idx).padStart(4, '0')}`;
    await db.query(`
      INSERT INTO vehicles (org_id, name, imei, plate, status, metadata)
      VALUES ($1, $2, $3, $4, 'active', '{"tankSize":100,"fuelConfig":{"minFilling":15,"minTheft":10,"refillSettleMinutes":5}}')
      ON CONFLICT (imei) DO NOTHING
    `, [orgId, plate, imei, plate]);
  }

  const all = await db.query('SELECT id, imei, plate, metadata FROM vehicles WHERE org_id = $1 LIMIT $2', [orgId, vehicleCount]);
  return all.rows;
}

async function run() {
  env.WHATSAPP_ENABLED = false;
  console.log('[BASELINE] Seeding 500 fleet vehicles...');
  const vehicles = await seedTestFleet(500);

  console.log('[BASELINE] Starting subscribers...');
  await locationSubscriber.start(mockIo);
  await alertSubscriber.start(mockIo);

  console.log(`[BASELINE] Running 60s settling period at 100 pkt/s...`);
  const loopDelay = monitorEventLoopDelay({ resolution: 20 });
  loopDelay.enable();

  let running = true;
  let packetCounter = 0;
  const startTime = Date.now();

  const publisher = setInterval(async () => {
    if (!running) return;
    const elapsedMs = Date.now() - startTime;
    const targetPackets = Math.floor(elapsedMs * 0.1);
    const toSend = Math.max(0, Math.min(50, targetPackets - packetCounter));

    for (let i = 0; i < toSend; i++) {
      const v = vehicles[(packetCounter + i) % vehicles.length];
      const packet = {
        imei: v.imei,
        lat: 12.9716 + (Math.random() - 0.5) * 0.05,
        lng: 77.5946 + (Math.random() - 0.5) * 0.05,
        speed: 35,
        direction: 90,
        altitude: 900,
        ignition: true,
        voltage: 12.6,
        fuel: 50.0,
        odometer: 10000,
        deviceTime: new Date().toISOString(),
        isLive: true
      };
      redis.publish('tracking', JSON.stringify(packet)).catch(() => {});
    }
    packetCounter += toSend;
  }, 50);

  // Wait 60s settling
  await new Promise(r => setTimeout(r, SETTLE_SEC * 1000));
  loopDelay.reset();
  console.log(`[BASELINE] Settling complete. Sampling event-loop delay over ${DURATION_SEC}s...`);

  const p99Samples = [];
  const samplingStart = Date.now();

  const sampler = setInterval(() => {
    if (!running) return;
    if (global.gc) global.gc();
    const p99Ms = loopDelay.percentile(99) / 1e6;
    loopDelay.reset();
    p99Samples.push(parseFloat(p99Ms.toFixed(2)));
    const elapsed = Math.floor((Date.now() - samplingStart) / 1000);
    if (elapsed % 60 === 0) {
      console.log(`[BASELINE T+${elapsed}s] p99 lag: ${p99Ms.toFixed(2)} ms, packets: ${packetCounter}`);
    }
  }, SAMPLE_INTERVAL_MS);

  await new Promise(r => setTimeout(r, DURATION_SEC * 1000));

  running = false;
  clearInterval(publisher);
  clearInterval(sampler);
  loopDelay.disable();

  // Sort to compute median
  const sorted = [...p99Samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const medianP99 = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const peakP99 = Math.max(...p99Samples);

  console.log('\n========================================================================');
  console.log('BASELINE P99 RESULTS (8-MIN MEASUREMENT AFTER 60S SETTLING)');
  console.log('========================================================================');
  console.log(`Total Samples:       ${p99Samples.length}`);
  console.log(`Total Packets:       ${packetCounter}`);
  console.log(`Median p99 Lag:      ${medianP99.toFixed(2)} ms`);
  console.log(`Peak p99 Lag:        ${peakP99.toFixed(2)} ms`);
  console.log('========================================================================\n');

  await locationSubscriber.stop();
  await alertSubscriber.stop();
  await redis.quit();
  await db.pool.end();
  process.exit(0);
}

run().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});

