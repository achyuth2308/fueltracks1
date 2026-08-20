#!/usr/bin/env node
// ============================================================
// API KEY GENERATOR — FuelTracks
// Run once to create a new API key for an organization.
// Usage: node scripts/createApiKey.js <org_id> <label>
// Example: node scripts/createApiKey.js a0000000-0000-0000-0000-000000000001 "Client Portal"
// ============================================================

const crypto = require('crypto');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'fueltracks',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
});

async function createApiKey(orgId, label) {
  const client = await pool.connect();
  try {
    // Verify org exists
    const orgCheck = await client.query(
      'SELECT id, name FROM organizations WHERE id = $1',
      [orgId]
    );
    if (orgCheck.rows.length === 0) {
      console.error(`❌  Organization not found: ${orgId}`);
      process.exit(1);
    }
    const org = orgCheck.rows[0];

    // Generate a random 32-byte raw key
    const rawKey     = 'ftkn_' + crypto.randomBytes(24).toString('hex'); // ftkn_ + 48 hex chars
    const keyHash    = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix  = rawKey.slice(0, 12); // e.g. "ftkn_ab12cd"

    await client.query(
      `INSERT INTO api_keys (org_id, key_hash, key_prefix, name)
       VALUES ($1, $2, $3, $4)`,
      [orgId, keyHash, keyPrefix, label]
    );

    console.log('');
    console.log('✅  API Key created successfully!');
    console.log('═══════════════════════════════════════════════');
    console.log(`   Organization : ${org.name}`);
    console.log(`   Label        : ${label}`);
    console.log(`   Key Prefix   : ${keyPrefix}...`);
    console.log('');
    console.log('   ⚠️  RAW KEY (shown ONCE — save this now!):');
    console.log('');
    console.log(`   ${rawKey}`);
    console.log('');
    console.log('   Send this to the client. The key is hashed in DB');
    console.log('   and cannot be recovered if lost.');
    console.log('═══════════════════════════════════════════════');

  } catch (err) {
    console.error('❌  Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

const [orgId, label] = process.argv.slice(2);
if (!orgId || !label) {
  console.error('Usage: node scripts/createApiKey.js <org_id> "<label>"');
  process.exit(1);
}
createApiKey(orgId, label);
