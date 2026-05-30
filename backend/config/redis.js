// ============================================================
// REDIS CLIENT CONFIGURATION
// Used for pub/sub, caching, and online status
// ============================================================

const Redis = require('ioredis');
const env = require('./env');

// Main client for general operations (GET, SET, etc.)
const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  retryStrategy: (times) => {
    const delay = Math.min(times * 100, 3000);
    console.log(`[REDIS] Reconnecting in ${delay}ms... (attempt ${times})`);
    return delay;
  },
  maxRetriesPerRequest: null,
  lazyConnect: false,
});

redis.on('connect', () => {
  console.log(`[REDIS] Connected to ${env.REDIS_HOST}:${env.REDIS_PORT}`);
});

redis.on('error', (err) => {
  console.error('[REDIS] Error:', err.message);
});

/**
 * Create a subscriber client (Redis requires separate connections for subscribe)
 */
function createSubscriber() {
  const subscriber = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    retryStrategy: (times) => {
      const delay = Math.min(times * 100, 3000);
      return delay;
    },
    maxRetriesPerRequest: null,
  });

  subscriber.on('error', (err) => {
    console.error('[REDIS] Subscriber error:', err.message);
  });

  return subscriber;
}

module.exports = { redis, createSubscriber };
