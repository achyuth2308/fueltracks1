// ============================================================
// ENVIRONMENT CONFIGURATION
// Validates and exports all env vars
// ============================================================

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

// Helper to parse booleans strictly (only 'true', case-insensitive)
function parseStrictBoolean(val) {
  if (!val) return false;
  return String(val).trim().toLowerCase() === 'true';
}

const env = {
  parseStrictBoolean,
  isScannerEnabled: () => parseStrictBoolean(process.env.DOCUMENT_SCANNER_ENABLED),
  // Node
  NODE_ENV: process.env.NODE_ENV || 'development',

  // API Server
  API_PORT: parseInt(process.env.API_PORT) || 3001,

  // TCP Server
  TCP_PORT: parseInt(process.env.TCP_PORT) || 5000,
  FMB920_TCP_PORT: parseInt(process.env.FMB920_TCP_PORT) || 5005,

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

  // WhatsApp Cloud API (Meta Graph API)
  WHATSAPP_ENABLED: process.env.WHATSAPP_ENABLED === 'true',
  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN || '',
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  WHATSAPP_WABA_ID: process.env.WHATSAPP_WABA_ID || '',
  WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET || '',
  WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN || '',
  WHATSAPP_API_VERSION: process.env.WHATSAPP_API_VERSION || 'v21.0',
  WHATSAPP_API_BASE_URL: process.env.WHATSAPP_API_BASE_URL || 'https://graph.facebook.com',
  WHATSAPP_RATE_PER_SEC: parseInt(process.env.WHATSAPP_RATE_PER_SEC) || 20,

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',

  // Document Scanner & Extractor Module
  DOCUMENT_SCANNER_ENABLED: parseStrictBoolean(process.env.DOCUMENT_SCANNER_ENABLED),
  DOCUMENT_SCANNER_STORAGE_DIR: process.env.DOCUMENT_SCANNER_STORAGE_DIR || require('path').join(__dirname, '..', 'storage', 'document_scans'),
  DOCUMENT_SCANNER_CONFIDENCE_THRESHOLD: parseFloat(process.env.DOCUMENT_SCANNER_CONFIDENCE_THRESHOLD) || 0.85,
  DOCUMENT_SCANNER_WORKERS: parseInt(process.env.DOCUMENT_SCANNER_WORKERS, 10) || 1,
  AADHAAR_HMAC_PEPPER: process.env.AADHAAR_HMAC_PEPPER || 'fueltracks-dev-aadhaar-pepper-default-salt-value-change-in-prod-64c',
  AADHAAR_RETENTION_DAYS: parseInt(process.env.AADHAAR_RETENTION_DAYS, 10) || 7,
  SCAN_RETENTION_DAYS: parseInt(process.env.SCAN_RETENTION_DAYS, 10) || 90,
  DISK_GUARD_MIN_FREE_MB: parseInt(process.env.DISK_GUARD_MIN_FREE_MB, 10) || 500,
};

// Known-bad placeholder values that should never reach production
const KNOWN_WEAK_SECRETS = [
  'fueltracks-dev-secret-change-in-production',
  'your_jwt_secret_here',
  'change_me_in_production_min_64_random_chars',
  '',
];

// Validate critical env vars in production
if (env.DOCUMENT_SCANNER_ENABLED && env.NODE_ENV === 'production') {
  if (!process.env.AADHAAR_HMAC_PEPPER || process.env.AADHAAR_HMAC_PEPPER.length < 32) {
    console.error('[ENV] AADHAAR_HMAC_PEPPER must be set and at least 32 characters when DOCUMENT_SCANNER_ENABLED=true in production');
    process.exit(1);
  }
}

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

  if (env.WHATSAPP_API_BASE_URL && !env.WHATSAPP_API_BASE_URL.startsWith('https://')) {
    console.error(`[ENV] FATAL: WHATSAPP_API_BASE_URL must use HTTPS in production. Provided: ${env.WHATSAPP_API_BASE_URL}`);
    process.exit(1);
  }
}

// Validate WhatsApp credentials when WHATSAPP_ENABLED is true
env.WHATSAPP_CREDENTIALS_VALID = true;
if (env.WHATSAPP_ENABLED) {
  const waRequired = ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_WABA_ID', 'WHATSAPP_APP_SECRET', 'WHATSAPP_VERIFY_TOKEN'];
  const waMissing = waRequired.filter(key => !process.env[key]);
  if (waMissing.length > 0) {
    env.WHATSAPP_CREDENTIALS_VALID = false;
    if (env.NODE_ENV === 'production') {
      console.error(`[ENV] ERROR: WHATSAPP_ENABLED is true in production but missing credentials: ${waMissing.join(', ')}. WhatsApp outbox will be paused without crashing the API.`);
    } else {
      console.warn(`[ENV] WHATSAPP_ENABLED is true but missing credentials: ${waMissing.join(', ')}. Using mock mode in non-production.`);
    }
  }
}

module.exports = env;
