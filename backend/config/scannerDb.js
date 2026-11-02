// ============================================================
// SCANNER DB POOL
// Dedicated connection pool for Document Scanner subsystem
// Ensures zero connection contention with API or GPS pools
// ============================================================

const { Pool, types } = require('pg');
const env = require('./env');

// Parse PostgreSQL NUMERIC/DECIMAL column types (OID 1700) as floats
types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));

// Parse PostgreSQL TIMESTAMP WITHOUT TIME ZONE (OID 1114) as UTC
types.setTypeParser(1114, (val) => (val === null ? null : new Date(val + 'Z')));

let scannerPool = null;

/**
 * Get or create isolated scannerPool
 *
 * @param {string} appName - application_name for pg_stat_activity tracing
 * @param {number} maxConnections - max pool connections
 */
function getScannerPool(appName = 'fueltracks-scanner-api', maxConnections = 3) {
  if (!scannerPool) {
    const defaultAppName = process.env.SCANNER_PROCESS_NAME || appName || 'fueltracks-scanner-api';
    scannerPool = new Pool({
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASS,
      max: maxConnections,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000,
      options: `-c timezone=UTC -c application_name=${defaultAppName}`
    });

    scannerPool.on('error', (err) => {
      console.error('[DB-SCANNER] Unexpected scanner pool error:', err.message);
    });
  }
  return scannerPool;
}

async function scannerQuery(text, params) {
  const p = getScannerPool();
  return p.query(text, params);
}

module.exports = {
  getScannerPool,
  scannerQuery
};

