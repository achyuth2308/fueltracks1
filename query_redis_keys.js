
const Redis = require('./fueltracks1/backend/node_modules/ioredis');
const redis = new Redis();
async function run() {
  try {
    const keys = await redis.keys('vehicle:online:*');
    console.log('ONLINE KEYS:', keys);
    for (const k of keys) {
      const val = await redis.get(k);
      console.log(k, val);
    }
  } catch(e) { console.error(e); }
  process.exit(0);
}
run();
