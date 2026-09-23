const db = require('./config/db');

async function cleanup() {
  try {
    await db.query("DELETE FROM devices WHERE device_id LIKE ' %' OR device_id LIKE '% '");
    await db.query("DELETE FROM vehicles WHERE imei LIKE ' %' OR imei LIKE '% '");
    console.log('Cleaned up space-padded devices and vehicles.');
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
cleanup();
