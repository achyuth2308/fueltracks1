const db = require('./config/db');

async function check() {
  try {
    const res = await db.query(`SELECT id, device_id, length(device_id) as len FROM devices WHERE device_id LIKE '%861329086656742%'`);
    console.log('Devices match:', res.rows);
    const veh = await db.query(`SELECT id, imei, length(imei) as len FROM vehicles WHERE imei LIKE '%861329086656742%'`);
    console.log('Vehicles match:', veh.rows);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
check();
