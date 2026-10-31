// ============================================================
// WHATSAPP INTEGRATION TEST: REFILL AGGREGATOR EDGE CASES
// Rigorous verification of all 10 refill edge cases:
// 1. Clean refill
// 2. Multi-step slow refill
// 3. Slosh while moving
// 4. Missing packet (time gap)
// 5. Sensor spikes (transient surge)
// 6. Two refills in 20 min
// 7. Vehicle moves mid-refill
// 8. Duplicate / out-of-order packets
// 9. Clock jumps (backward/excessive forward)
// 10. Null / 0 sensor readings
// Exactly one final alert per real refill!
// ============================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { redis } = require('../../backend/config/redis');
const FuelEventAggregator = require('../../backend/services/fuelEventAggregator');

const TEST_VEHICLE = {
  id: 'a0000000-0000-0000-0000-000000000001',
  imei: '860000000099991',
  plate: 'KA01TEST111',
  metadata: {
    tankSize: 100,
    fuelConfig: {
      minFilling: 15,
      refillSettleMinutes: 5
    }
  }
};

const sessionKey = `refill:session:${TEST_VEHICLE.id}`;

test.beforeEach(async () => {
  await redis.del(sessionKey);
});

test('Refill Aggregator: 1. Clean refill produces exactly ONE final alert', async () => {
  const baseTime = Date.now();
  let alert = null;

  // Packet 1: Parked, baseline fuel = 20L
  alert = await FuelEventAggregator.processRefillPacket(TEST_VEHICLE, 20.0, 20.0, 0, false, 12.9, 77.6, new Date(baseTime));
  assert.equal(alert, null);

  // Packet 2: Fuel starts rising: 20L -> 45L (+25L)
  alert = await FuelEventAggregator.processRefillPacket(TEST_VEHICLE, 45.0, 20.0, 0, false, 12.9, 77.6, new Date(baseTime + 10000));
  assert.equal(alert, null); // Session started, not finalized yet

  // Packet 3: Fuel peaks at 60L (+40L total)
  alert = await FuelEventAggregator.processRefillPacket(TEST_VEHICLE, 60.0, 45.0, 0, false, 12.9, 77.6, new Date(baseTime + 20000));
  assert.equal(alert, null);

  // Packet 4: Still parked, 2 min elapsed (stable at 60L)
  alert = await FuelEventAggregator.processRefillPacket(TEST_VEHICLE, 60.0, 60.0, 0, false, 12.9, 77.6, new Date(baseTime + 120000));
  assert.equal(alert, null);

  // Packet 5: Still parked, 5.5 min elapsed since peak (settle timeout reached)
  alert = await FuelEventAggregator.processRefillPacket(TEST_VEHICLE, 60.0, 60.0, 0, false, 12.9, 77.6, new Date(baseTime + 350000));
  assert.ok(alert, 'Final alert must be published on settlement');
  assert.equal(alert.alertType, 'fuel_refill_final');
  assert.equal(alert.alertPayload.addedLitres, 40);
  assert.equal(alert.alertPayload.startLevel, 20);
  assert.equal(alert.alertPayload.endLevel, 60);
  assert.equal(alert.alertPayload.reason, 'settle_timeout');

  // Verify session key cleaned up in Redis
  const remaining = await redis.get(sessionKey);
  assert.equal(remaining, null, 'Session key must be cleared from Redis');

  // Packet 6: Subsequent packet does not emit duplicate alert
  const postAlert = await FuelEventAggregator.processRefillPacket(TEST_VEHICLE, 60.0, 60.0, 0, false, 12.9, 77.6, new Date(baseTime + 360000));
  assert.equal(postAlert, null, 'No duplicate alert after finalization');
});

test('Refill Aggregator: 2. Multi-step slow refill accumulates to single alert', async () => {
  const baseTime = Date.now();
  let alert = null;

  // Step 1: Rise 20 -> 35 (+15L)
  await FuelEventAggregator.processRefillPacket(TEST_VEHICLE, 35.0, 20.0, 0, false, 12.9, 77.6, new Date(baseTime));

  // Pause 1 min, pump resumes: 35 -> 55 (+20L)
  await FuelEventAggregator.processRefillPacket(TEST_VEHICLE, 55.0, 35.0, 0, false, 12.9, 77.6, new Date(baseTime + 60000));

  // Pause 1 min, pump finishes: 55 -> 70 (+15L)
  await FuelEventAggregator.processRefillPacket(TEST_VEHICLE, 70.0, 55.0, 0, false, 12.9, 77.6, new Date(baseTime + 120000));

  // Settle 5 min later (T = 120000 + 310000 = 430000ms)
  alert = await FuelEventAggregator.processRefillPacket(TEST_VEHICLE, 70.0, 70.0, 0, false, 12.9, 77.6, new Date(baseTime + 440000));
  assert.ok(alert, 'Multi-step refill must finalize');
  assert.equal(alert.alertPayload.addedLitres, 50, 'Total added must accumulate all steps: 70 - 20 = 50L');
  assert.equal(alert.alertPayload.startLevel, 20);
  assert.equal(alert.alertPayload.endLevel, 70);
});

test('Refill Aggregator: 3. Slosh while moving does NOT start refill session', async () => {
  const baseTime = Date.now();

  // Speed = 35 km/h, fuel sloshes up +6L (from 40 to 46)
  const alert1 = await FuelEventAggregator.processRefillPacket(TEST_VEHICLE, 46.0, 40.0, 35, true, 12.9, 77.6, new Date(baseTime));
  assert.equal(alert1, null);

  // Slosh drops back to 40
  const alert2 = await FuelEventAggregator.processRefillPacket(TEST_VEHICLE, 40.0, 46.0, 40, true, 12.9, 77.6, new Date(baseTime + 5000));
  assert.equal(alert2, null);

  // Verify zero session key in Redis
  const session = await redis.get(sessionKey);
  assert.equal(session, null, 'No refill session must be created while vehicle is moving');
});

test('Refill Aggregator: 4. Missing packet (time gap) handled seamlessly', async () => {
  const baseTime = Date.now();

  // Refill starts
  await FuelEventAggregator.processRefillPacket(TEST_VEHICLE, 50.0, 20.0, 0, false, 12.9, 77.6, new Date(baseTime));

  // 3-minute network dropout occurs, next packet arrives at T+3min with steady fuel
  await FuelEventAggregator.processRefillPacket(TEST_VEHICLE, 50.0, 50.0, 0, false, 12.9, 77.6, new Date(baseTime + 180000));

  // Settles at T+6min
  const alert = await FuelEventAggregator.processRefillPacket(TEST_VEHICLE, 50.0, 50.0, 0, false, 12.9, 77.6, new Date(baseTime + 360000));
  assert.ok(alert, 'Refill must finalize despite packet time gap');
  assert.equal(alert.alertPayload.addedLitres, 30);
});

test('Refill Aggregator: 5. Sensor spikes (momentary surge) rejected without alerting', async () => {
  const baseTime = Date.now();

  // Packet 1: Baseline fuel 25L
  await FuelEventAggregator.processRefillPacket(TEST_VEHICLE, 25.0, 25.0, 0, false, 12.9, 77.6, new Date(baseTime));

  // Packet 2: Sensor spikes wildly to 85L (+60L glitch)
  await FuelEventAggregator.processRefillPacket(TEST_VEHICLE, 85.0, 25.0, 0, false, 12.9, 77.6, new Date(baseTime + 5000));

  // Packet 3: 5 seconds later, sensor drops back to baseline (25.2L)
  const alert = await FuelEventAggregator.processRefillPacket(TEST_VEHICLE, 25.2, 85.0, 0, false, 12.9, 77.6, new Date(baseTime + 10000));
  assert.equal(alert, null, 'Glitch packet must not alert');

  // Verify session was discarded
  const session = await redis.get(sessionKey);
  assert.equal(session, null, 'Session must be discarded when fuel drops back to baseline');
});

test('Refill Aggregator: 6. Two refills in 20 min produce exactly TWO distinct alerts', async () => {
  const baseTime = Date.now();

  // Refill 1: 20L -> 50L (+30L)
  await FuelEventAggregator.processRefillPacket(TEST_VEHICLE, 50.0, 20.0, 0, false, 12.9, 77.6, new Date(baseTime));
  const alert1 = await FuelEventAggregator.processRefillPacket(TEST_VEHICLE, 50.0, 50.0, 0, false, 12.9, 77.6, new Date(baseTime + 310000));
  assert.ok(alert1, 'Refill 1 must finalize');
  assert.equal(alert1.alertPayload.addedLitres, 30);

  // 10 minutes later (T = 600,000ms), Refill 2: 50L -> 85L (+35L)
  await FuelEventAggregator.processRefillPacket(TEST_VEHICLE, 85.0, 50.0, 0, false, 12.9, 77.6, new Date(baseTime + 600000));
  const alert2 = await FuelEventAggregator.processRefillPacket(TEST_VEHICLE, 85.0, 85.0, 0, false, 12.9, 77.6, new Date(baseTime + 910000));
  assert.ok(alert2, 'Refill 2 must finalize independently');
  assert.equal(alert2.alertPayload.addedLitres, 35);
  assert.equal(alert2.alertPayload.startLevel, 50);
  assert.equal(alert2.alertPayload.endLevel, 85);
});

test('Refill Aggregator: 7. Vehicle moves mid-refill finalizes immediately', async () => {
  const baseTime = Date.now();

  // Parked refill: 20L -> 55L (+35L)
  await FuelEventAggregator.processRefillPacket(TEST_VEHICLE, 55.0, 20.0, 0, false, 12.9, 77.6, new Date(baseTime));

  // Driver starts moving immediately (speed = 30 km/h, only 30s elapsed)
  const alert = await FuelEventAggregator.processRefillPacket(TEST_VEHICLE, 55.0, 55.0, 30, true, 12.9, 77.6, new Date(baseTime + 30000));
  assert.ok(alert, 'Moving vehicle must immediately trigger refill finalization');
  assert.equal(alert.alertPayload.reason, 'vehicle_moved');
  assert.equal(alert.alertPayload.addedLitres, 35);

  const session = await redis.get(sessionKey);
  assert.equal(session, null, 'Session must be cleaned up on drive-off');
});

test('Refill Aggregator: 8. Out-of-order and duplicate packets ignored', async () => {
  const baseTime = Date.now();

  await FuelEventAggregator.processRefillPacket(TEST_VEHICLE, 50.0, 20.0, 0, false, 12.9, 77.6, new Date(baseTime));

  // Older packet arriving from the past (T - 5000ms)
  const oldAlert = await FuelEventAggregator.processRefillPacket(TEST_VEHICLE, 45.0, 20.0, 0, false, 12.9, 77.6, new Date(baseTime - 5000));
  assert.equal(oldAlert, null, 'Out-of-order packet must be ignored');

  // Duplicate packet at same timestamp
  const dupAlert = await FuelEventAggregator.processRefillPacket(TEST_VEHICLE, 50.0, 50.0, 0, false, 12.9, 77.6, new Date(baseTime));
  assert.equal(dupAlert, null, 'Duplicate packet must be ignored');
});

test('Refill Aggregator: 9. Clock jump > 24 hours discards stale session', async () => {
  const baseTime = Date.now();

  await FuelEventAggregator.processRefillPacket(TEST_VEHICLE, 50.0, 20.0, 0, false, 12.9, 77.6, new Date(baseTime));

  // Time jumps forward 30 hours (GPS clock corruption / device jump)
  const alert = await FuelEventAggregator.processRefillPacket(TEST_VEHICLE, 50.0, 50.0, 0, false, 12.9, 77.6, new Date(baseTime + 30 * 3600 * 1000));
  assert.equal(alert, null, 'Excessive time jump must discard session rather than firing stale alert');

  const session = await redis.get(sessionKey);
  assert.equal(session, null, 'Session must be pruned');
});

test('Refill Aggregator: 10. Null / 0 sensor readings safely handled', async () => {
  const baseTime = Date.now();

  // Null fuel
  assert.equal(await FuelEventAggregator.processRefillPacket(TEST_VEHICLE, null, 20.0, 0, false, 12.9, 77.6, new Date(baseTime)), null);
  // NaN fuel
  assert.equal(await FuelEventAggregator.processRefillPacket(TEST_VEHICLE, NaN, 20.0, 0, false, 12.9, 77.6, new Date(baseTime)), null);
  // Zero fuel (disconnected wire)
  assert.equal(await FuelEventAggregator.processRefillPacket(TEST_VEHICLE, 0.0, 50.0, 0, false, 12.9, 77.6, new Date(baseTime)), null);

  const session = await redis.get(sessionKey);
  assert.equal(session, null, 'Zero or null fuel must never start a refill session');
});

test.after(async () => {
  await redis.quit();
});

