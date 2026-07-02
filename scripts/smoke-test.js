// ============================================================
// SMOKE TEST — FuelTracks
// Run before going live to verify all services are operational.
//
// Usage:
//   node scripts/smoke-test.js
//
// Exit code 0 = all pass | Exit code 1 = one or more failed
// ============================================================

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const http  = require('http');
const net   = require('net');
const { Pool } = require('pg');
const Redis = require('ioredis');

const API_PORT    = parseInt(process.env.API_PORT)  || 3001;
const TCP_PORT    = parseInt(process.env.TCP_PORT)  || 5000;
const AIS_PORT    = parseInt(process.env.AIS140_TCP_PORT) || 5001;
const CONCOX_PORT = parseInt(process.env.CONCOX_TCP_PORT) || 5002;
const HEALTH_PORT = parseInt(process.env.TCP_HEALTH_PORT) || 5050;

let passed = 0;
let failed = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────

function pass(label) {
  console.log(`  ✅ PASS  ${label}`);
  passed++;
}

function fail(label, reason) {
  console.error(`  ❌ FAIL  ${label}`);
  console.error(`          └─ ${reason}`);
  failed++;
}

/** Make an HTTP GET request — resolves with status code */
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 5000 }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

/** Make an HTTP POST request with JSON body */
function httpPost(url, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const opts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 5000,
    };
    const req = http.request(url, opts, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, body }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data);
    req.end();
  });
}

/** Check that a TCP port is open and accepting connections */
function checkTcpPort(host, port) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(3000);
    s.connect(port, host, () => { s.destroy(); resolve(true); });
    s.on('error', () => resolve(false));
    s.on('timeout', () => { s.destroy(); resolve(false); });
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

async function testPostgres() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    connectionTimeoutMillis: 5000,
  });
  try {
    const res = await pool.query('SELECT 1 AS ok');
    if (res.rows[0].ok === 1) pass('PostgreSQL: connection and query');
    else fail('PostgreSQL: connection and query', 'Unexpected result');
  } catch (err) {
    fail('PostgreSQL: connection and query', err.message);
  } finally {
    await pool.end();
  }
}

async function testTimescaleHypertable() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    connectionTimeoutMillis: 5000,
  });
  try {
    const res = await pool.query(`
      SELECT hypertable_name FROM timescaledb_information.hypertables
      WHERE hypertable_name = 'gps_points'
    `);
    if (res.rows.length > 0) pass('TimescaleDB: gps_points is a hypertable');
    else fail('TimescaleDB: gps_points is a hypertable', 'Not found — run database/timescale_migration.sql');
  } catch (err) {
    fail('TimescaleDB: gps_points is a hypertable', err.message);
  } finally {
    await pool.end();
  }
}

async function testTimescalePolicies() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    connectionTimeoutMillis: 5000,
  });
  try {
    const res = await pool.query(`
      SELECT proc_name FROM timescaledb_information.jobs
      WHERE proc_name IN ('policy_compression', 'policy_retention')
    `);
    const names = res.rows.map(r => r.proc_name);
    if (names.includes('policy_compression')) pass('TimescaleDB: compression policy active');
    else fail('TimescaleDB: compression policy active', 'Run database/timescale_migration.sql');
    if (names.includes('policy_retention')) pass('TimescaleDB: retention policy active');
    else fail('TimescaleDB: retention policy active', 'Run database/timescale_migration.sql');
  } catch (err) {
    fail('TimescaleDB: policies', err.message);
  } finally {
    await pool.end();
  }
}

async function testRedis() {
  const client = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    connectTimeout: 3000,
    maxRetriesPerRequest: 1,
  });
  try {
    const pong = await client.ping();
    if (pong === 'PONG') pass('Redis: ping/pong');
    else fail('Redis: ping/pong', `Unexpected response: ${pong}`);
    const mem = await client.info('memory');
    const match = mem.match(/used_memory_human:(.+)/);
    if (match) console.log(`         Redis memory: ${match[1].trim()}`);
  } catch (err) {
    fail('Redis: ping/pong', err.message);
  } finally {
    client.disconnect();
  }
}

async function testApiHealth() {
  try {
    const res = await httpGet(`http://localhost:${API_PORT}/health`);
    if (res.status === 200) pass('API: /health endpoint returns 200');
    else fail('API: /health endpoint returns 200', `Got ${res.status}`);
  } catch (err) {
    fail('API: /health endpoint returns 200', err.message);
  }
}

async function testApiRateLimit() {
  try {
    const res = await httpPost(`http://localhost:${API_PORT}/api/auth/login`, {
      identifier: 'nonexistent@test.invalid', password: 'wrongpassword'
    });
    // Should return 401 (not 500, not crash)
    if (res.status === 401) pass('API: login endpoint rejects invalid credentials with 401');
    else if (res.status === 429) pass('API: rate limiter active (429 returned)');
    else fail('API: login endpoint', `Expected 401 or 429, got ${res.status}`);
  } catch (err) {
    fail('API: login endpoint reachable', err.message);
  }
}

async function testApiAuthRequired() {
  try {
    const res = await httpGet(`http://localhost:${API_PORT}/api/vehicles`);
    if (res.status === 401) pass('API: protected route returns 401 without token');
    else fail('API: protected route returns 401 without token', `Got ${res.status}`);
  } catch (err) {
    fail('API: protected route auth guard', err.message);
  }
}

async function testTcpPorts() {
  const ports = [
    { port: TCP_PORT,    label: `TCP BSTPL port ${TCP_PORT}` },
    { port: AIS_PORT,   label: `TCP AIS140 port ${AIS_PORT}` },
    { port: CONCOX_PORT, label: `TCP Concox port ${CONCOX_PORT}` },
    { port: HEALTH_PORT, label: `TCP health port ${HEALTH_PORT}` },
  ];
  for (const { port, label } of ports) {
    const open = await checkTcpPort('localhost', port);
    if (open) pass(`TCP: ${label} is open`);
    else fail(`TCP: ${label} is open`, 'Connection refused — is the TCP server running?');
  }
}

async function testJwtSecret() {
  const secret = process.env.JWT_SECRET || '';
  const WEAK = ['your_jwt_secret_here', 'fueltracks-dev-secret-change-in-production',
                 'change_me_in_production_min_64_random_chars', ''];
  if (WEAK.includes(secret)) fail('Security: JWT_SECRET is not a placeholder', 'Update .env with: openssl rand -hex 64');
  else if (secret.length < 32) fail('Security: JWT_SECRET length', `Only ${secret.length} chars — need at least 32`);
  else pass(`Security: JWT_SECRET is set (${secret.length} chars)`);
}

async function testDefaultPasswords() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    connectionTimeoutMillis: 5000,
  });
  try {
    const bcrypt = require('bcryptjs');
    const res = await pool.query(
      `SELECT email, password FROM users WHERE email = ANY($1)`,
      [['admin@fueltracks.in', 'dealer@abclogistics.com',
        'dealer@xyztransport.com', 'customer@abcfleet.com']]
    );
    let anyDefault = false;
    for (const row of res.rows) {
      const isDefault = await bcrypt.compare('password123', row.password);
      if (isDefault) { anyDefault = true; console.error(`         └─ ${row.email} still has default password!`); }
    }
    if (!anyDefault) pass('Security: no seed accounts have default password123');
    else fail('Security: no seed accounts have default password123', 'Run: node scripts/change-default-passwords.js');
  } catch (err) {
    fail('Security: default password check', err.message);
  } finally {
    await pool.end();
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n============================================================');
  console.log('  FuelTracks Smoke Test');
  console.log('============================================================\n');

  const suites = [
    ['SECURITY CHECKS', [testJwtSecret, testDefaultPasswords]],
    ['POSTGRES',        [testPostgres]],
    ['TIMESCALEDB',     [testTimescaleHypertable, testTimescalePolicies]],
    ['REDIS',           [testRedis]],
    ['API SERVER',      [testApiHealth, testApiRateLimit, testApiAuthRequired]],
    ['TCP SERVER',      [testTcpPorts]],
  ];

  for (const [suiteName, tests] of suites) {
    console.log(`\n[${suiteName}]`);
    for (const test of tests) {
      try { await test(); }
      catch (err) { fail(test.name, `Unhandled error: ${err.message}`); }
    }
  }

  console.log('\n============================================================');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('============================================================\n');

  if (failed > 0) {
    console.error('❌ Smoke test FAILED — do NOT connect real devices until all checks pass.\n');
    process.exit(1);
  } else {
    console.log('✅ All checks passed — system looks production-ready.\n');
    process.exit(0);
  }
}

main();
