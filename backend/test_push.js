const { pushToCoromandel } = require('./services/sclenPushService');
const db = require('./config/db');

async function testPush() {
  const result = await db.query("SELECT * FROM vehicles WHERE plate = 'AP39TV7279' LIMIT 1");
  const vehicle = result.rows[0];
  
  if (vehicle) {
    const point = {
      lat: 16.3332,
      lng: 80.4400,
      deviceTime: new Date()
    };
    await pushToCoromandel(vehicle, point);
    console.log("Triggered push successfully. Waiting for axios to complete...");
    setTimeout(() => { process.exit(0); }, 6000);
  } else {
    console.log("Vehicle not found");
    process.exit(0);
  }
}

testPush();
