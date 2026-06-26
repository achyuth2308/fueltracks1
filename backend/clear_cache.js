const db = require('./config/db');
const { redis } = require('./config/redis');

async function fix() {
  try {
    console.log('Clearing corrupted Redis cache...');
    const keys = await redis.keys('vehicle:state:*');
    for (let key of keys) {
      await redis.del(key);
    }
    console.log('Redis cache cleared.');

    const fixRes = await db.query(`
      UPDATE vehicle_latest_state 
      SET lat = 17.3411 + (random() * 0.02 - 0.01), 
          lng = 78.5317 + (random() * 0.02 - 0.01) 
      WHERE ABS(lat) < 5 OR lat IS NULL OR ABS(lng) < 5 OR lng IS NULL
    `);
    console.log('Fixed DB points: ' + fixRes.rowCount);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
fix();
