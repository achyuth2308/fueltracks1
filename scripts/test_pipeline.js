'use strict';

const { redis, createSubscriber } = require('../backend/config/redis');
const db = require('../backend/config/db');

async function testAlertPipeline() {
  console.log('Testing alert pipeline for TS08HH4684 (868329088498955)...');

  // Check DB state
  const res = await db.query('SELECT id, name, imei, metadata FROM vehicles WHERE imei = $1', ['868329088498955']);
  console.log('Vehicle DB metadata:', res.rows[0].metadata);

  // Subscribe to alerts channel
  const sub = createSubscriber();
  await sub.subscribe('alerts');
  console.log('Subscribed to Redis alerts channel...');

  sub.on('message', (ch, msg) => {
    console.log(`[ALERT RECEIVED on ${ch}]:`, msg);
  });

  // Start location subscriber standalone in this process
  const locationSubscriber = require('../backend/subscribers/locationSubscriber');
  const mockIo = {
    to: (room) => ({
      emit: (evt, data) => {
        console.log(`[SOCKET.IO EMIT to ${room}] ${evt}:`, data?.alertType || evt);
      }
    })
  };

  await locationSubscriber.start(mockIo);
  console.log('locationSubscriber started with mock socket.');

  // Send packet with speed=45, ignition=true
  console.log('Sending test packet (speed: 45, ignition: true)...');
  const packet = {
    imei: '868329088498955',
    lat: 17.4399,
    lng: 78.3812,
    speed: 45,
    direction: 180,
    ignition: true,
    voltage: 12.5,
    isLive: true,
    deviceTime: new Date().toISOString()
  };

  await redis.publish('tracking', JSON.stringify(packet));

  await new Promise(r => setTimeout(r, 3000));
  console.log('Done testing.');
  sub.disconnect();
  locationSubscriber.stop();
  process.exit(0);
}

testAlertPipeline().catch(err => {
  console.error(err);
  process.exit(1);
});
