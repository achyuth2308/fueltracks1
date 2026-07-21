const Redis = require('ioredis');
const redis = new Redis();
const imei = '865006049210220';

const data1 = {
  imei, lat: 17.34, lng: 78.52, speed: 0, ignition: false,
  fuel: 40, voltage: 12.5, odometer: 12345, satellites: 10, gsmSignal: 31, battery: 100,
  deviceTime: new Date().toISOString(), isLive: true, packetType: '$10', isHeartbeat: false
};
const data2 = {
  ...data1, speed: 50, ignition: true, deviceTime: new Date(Date.now() + 2000).toISOString()
};

async function run() {
  console.log("Setting initial Redis state to parked so we bypass real tracker race condition...");
  await redis.set(`vehicle:state:${imei}`, JSON.stringify(data1));
  
  console.log("Publishing Packet 2 directly to trigger Safety Park...");
  await redis.publish('tracking', JSON.stringify(data2));
  
  setTimeout(() => {
    console.log("Done.");
    process.exit();
  }, 500);
}
run();
