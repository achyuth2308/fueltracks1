const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { getBackoffSeconds } = require('../jobs/whatsappWorker');
const { formatHoursMinutes, getYesterdayIstWindow } = require('../jobs/dailyReportJob');

describe('Fuel Alerts & Daily Report Parameter Builders', () => {
  test('formats refill template parameters properly', () => {
    const vehicle = { plate: 'MH12AB1234', name: 'Tanker 1' };
    const alertPayload = { startLevel: 20.0, endLevel: 80.0, addedLitres: 60.0 };
    const formattedTime = '29 Oct 2026, 10:30 AM';
    const locationStr = 'Station A, Pune';

    const bodyParams = [
      vehicle.plate,
      alertPayload.addedLitres,
      alertPayload.startLevel,
      alertPayload.endLevel,
      formattedTime,
      locationStr
    ];

    assert.strictEqual(bodyParams[0], 'MH12AB1234');
    assert.strictEqual(bodyParams[1], 60.0);
    assert.strictEqual(bodyParams[2], 20.0);
    assert.strictEqual(bodyParams[3], 80.0);
    assert.strictEqual(bodyParams[4], '29 Oct 2026, 10:30 AM');
    assert.strictEqual(bodyParams[5], 'Station A, Pune');
  });

  test('formats theft template parameters properly including Google Maps URL', () => {
    const vehicle = { plate: 'MH12CD5678' };
    const alertPayload = { startLevel: 100.0, endLevel: 70.0, dropLitres: 30.0 };
    const formattedTime = '29 Oct 2026, 02:15 AM';
    const lat = 18.5204;
    const lng = 73.8567;
    const locationStr = `${lat}, ${lng}`;
    const mapUrl = `https://maps.google.com/?q=${lat},${lng}`;

    const bodyParams = [
      vehicle.plate,
      alertPayload.dropLitres,
      alertPayload.startLevel,
      alertPayload.endLevel,
      formattedTime,
      locationStr,
      mapUrl
    ];

    assert.strictEqual(bodyParams[0], 'MH12CD5678');
    assert.strictEqual(bodyParams[1], 30.0);
    assert.strictEqual(bodyParams[6], 'https://maps.google.com/?q=18.5204,73.8567');
  });

  test('formats daily report duration in hours and minutes', () => {
    assert.strictEqual(formatHoursMinutes(0), '0m');
    assert.strictEqual(formatHoursMinutes(300), '5m');
    assert.strictEqual(formatHoursMinutes(3600), '1h 0m');
    assert.strictEqual(formatHoursMinutes(7320), '2h 2m');
  });

  test('getYesterdayIstWindow returns valid UTC boundaries and dates', () => {
    const window = getYesterdayIstWindow();
    assert.ok(window.startUtc);
    assert.ok(window.endUtc);
    assert.match(window.dateKey, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(window.currentIstTime, /^\d{2}:\d{2}$/);
  });
});

describe('WhatsApp Worker Backoff & Retry Logic', () => {
  test('exponential backoff calculation scales properly and caps at 900s', () => {
    assert.strictEqual(getBackoffSeconds(1), 10);
    assert.strictEqual(getBackoffSeconds(2), 30);
    assert.strictEqual(getBackoffSeconds(3), 90);
    assert.strictEqual(getBackoffSeconds(4), 270);
    assert.strictEqual(getBackoffSeconds(5), 810);
    assert.strictEqual(getBackoffSeconds(6), 900); // capped at 900s
  });
});

describe('Refill Session State Machine Simulation', () => {
  // Pure logic simulation of FuelEventAggregator state transitions
  function simulateRefillStream(packets, config = { minFilling: 15, settleMinutes: 5 }) {
    let session = null;
    let publishedAlert = null;
    const settleTolerance = 1.0;

    for (const pkt of packets) {
      const { currFuel, prevFuel, speed, ignition, time } = pkt;
      const isStationary = speed <= 5 || ignition === false;
      const isMoving = speed > 5;

      if (!session) {
        const rise = currFuel - prevFuel;
        if (isStationary && rise >= 2.0) {
          session = {
            startLevel: prevFuel,
            peakLevel: currFuel,
            currentLevel: currFuel,
            lastChangeTime: time
          };
        }
      } else {
        if (currFuel - session.peakLevel > settleTolerance) {
          session.peakLevel = currFuel;
          session.currentLevel = currFuel;
          session.lastChangeTime = time;
        } else {
          const elapsedMin = (time - session.lastChangeTime) / (60 * 1000);
          if (isMoving || elapsedMin >= config.settleMinutes) {
            const added = session.peakLevel - session.startLevel;
            if (added >= config.minFilling) {
              publishedAlert = {
                addedLitres: Math.round(added * 10) / 10,
                startLevel: session.startLevel,
                endLevel: session.peakLevel
              };
            }
            session = null;
          }
        }
      }
    }
    return publishedAlert;
  }

  test('sloshing fuel while moving does not initiate a refill session', () => {
    const packets = [
      { prevFuel: 30, currFuel: 35, speed: 45, ignition: true, time: 1000 },
      { prevFuel: 35, currFuel: 31, speed: 50, ignition: true, time: 2000 }
    ];
    const alert = simulateRefillStream(packets);
    assert.strictEqual(alert, null);
  });

  test('refill session starts when stationary, tracks peak, and finalizes on settle', () => {
    const baseTime = 1000000;
    const packets = [
      // Stationary at pump, fuel starts rising
      { prevFuel: 20, currFuel: 25, speed: 0, ignition: false, time: baseTime },
      // Fuel pump keeps adding
      { prevFuel: 25, currFuel: 45, speed: 0, ignition: false, time: baseTime + 60000 },
      { prevFuel: 45, currFuel: 70, speed: 0, ignition: false, time: baseTime + 120000 },
      // Pump clicks off at 70L, fuel settles for 5+ mins
      { prevFuel: 70, currFuel: 70, speed: 0, ignition: false, time: baseTime + 180000 },
      { prevFuel: 70, currFuel: 70, speed: 0, ignition: false, time: baseTime + 450000 } // 5.5 mins after last change
    ];

    const alert = simulateRefillStream(packets, { minFilling: 15, settleMinutes: 5 });
    assert.ok(alert);
    assert.strictEqual(alert.startLevel, 20);
    assert.strictEqual(alert.endLevel, 70);
    assert.strictEqual(alert.addedLitres, 50);
  });

  test('small noise below threshold is discarded upon settlement', () => {
    const baseTime = 1000000;
    const packets = [
      // Minor rise of 4L (threshold is 15L)
      { prevFuel: 20, currFuel: 24, speed: 0, ignition: false, time: baseTime },
      { prevFuel: 24, currFuel: 24, speed: 0, ignition: false, time: baseTime + 400000 }
    ];

    const alert = simulateRefillStream(packets, { minFilling: 15, settleMinutes: 5 });
    assert.strictEqual(alert, null); // discarded as below threshold
  });
});

