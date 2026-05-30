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

  // Redis
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT) || 6379,

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'fueltracks-dev-secret-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
};

// Validate critical env vars in production
if (env.NODE_ENV === 'production') {
  const required = ['DB_HOST', 'DB_PASS', 'JWT_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`[ENV] Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  }
  if (env.JWT_SECRET === 'fueltracks-dev-secret-change-in-production') {
    console.error('[ENV] JWT_SECRET must be changed in production!');
    process.exit(1);
  }
}

module.exports = env;
