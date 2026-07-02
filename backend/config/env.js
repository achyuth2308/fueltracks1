// ============================================================
// ENVIRONMENT CONFIGURATION
// Validates and exports all env vars
// ============================================================

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const env = {
  // Node
  NODE_ENV: process.env.NODE_ENV || 'development',

  // API Server
  API_PORT: parseInt(process.env.API_PORT) || 3001,

  // TCP Server
  TCP_PORT: parseInt(process.env.TCP_PORT) || 5000,

  // PostgreSQL
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT) || 5432,
  DB_NAME: process.env.DB_NAME || 'fueltracks',
  DB_USER: process.env.DB_USER || 'postgres',
  DB_PASS: process.env.DB_PASS || 'postgres',
  PG_POOL_MAX: parseInt(process.env.PG_POOL_MAX) || 20,

  // Redis
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT) || 6379,

  // Batch writer
  WRITER_BATCH_MS:   parseInt(process.env.WRITER_BATCH_MS)   || 500,   // Flush every 500ms
  WRITER_BATCH_SIZE: parseInt(process.env.WRITER_BATCH_SIZE) || 100,   // Or when batch hits 100 rows

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'fueltracks-dev-secret-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',

  // Brevo Email Service
  BREVO_API_KEY: process.env.BREVO_API_KEY || '',
  BREVO_SENDER_EMAIL: process.env.BREVO_SENDER_EMAIL || '',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
};

// Known-bad placeholder values that should never reach production
const KNOWN_WEAK_SECRETS = [
  'fueltracks-dev-secret-change-in-production',
  'your_jwt_secret_here',
  'change_me_in_production_min_64_random_chars',
  '',
];

// Validate critical env vars in production
if (env.NODE_ENV === 'production') {
  const required = ['DB_HOST', 'DB_PASS', 'JWT_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`[ENV] Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  if (KNOWN_WEAK_SECRETS.includes(env.JWT_SECRET)) {
    console.error('[ENV] JWT_SECRET is a placeholder — generate a real secret with: openssl rand -hex 64');
    process.exit(1);
  }

  if (env.JWT_SECRET.length < 32) {
    console.error('[ENV] JWT_SECRET is too short — must be at least 32 characters');
    process.exit(1);
  }

  if (env.CORS_ORIGIN === '*') {
    console.warn('[ENV] WARNING: CORS_ORIGIN is set to * — all origins are accepted. Set to your domain in production.');
  }
}

module.exports = env;
