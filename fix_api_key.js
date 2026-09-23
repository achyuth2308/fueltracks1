/**
 * FuelTracks API Key Diagnostic & Fix Script
 * --------------------------------------------------
 * Run: node fix_api_key.js
 *
 * This script:
 *  1. Shows all organizations in the DB
 *  2. Shows all API keys and which org they are linked to
 *  3. Shows which org the TS29TA*** vehicles belong to
 *  4. Detects the mismatch (why /api/v1/vehicles returns [])
 *  5. Fixes the API key to point to the correct org_id
 *  6. Adds the missing group_id column to api_keys if not present
 */

const { Pool } = require('pg');
const crypto = require('crypto');
const readline = require('readline');

// Load env
let env;
try {
  env = require('./backend/config/env');
} catch (e) {
  // fallback: read .env manually
  require('fs').readFileSync('./.env', 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
  env = {
    DB_HOST: process.env.DB_HOST || '127.0.0.1',
    DB_PORT: parseInt(process.env.DB_PORT) || 5432,
    DB_NAME: process.env.DB_NAME || 'fueltracks',
    DB_USER: process.env.DB_USER || 'postgres',
    DB_PASS: process.env.DB_PASS || process.env.DB_PASSWORD || '',
  };
}

const pool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASS,
});

async function run() {
  const client = await pool.connect();
  console.log('\n✅ Connected to PostgreSQL:', env.DB_NAME, 'on', env.DB_HOST);

  try {
    // ── Step 1: List all organizations ──────────────────────────────────────
    console.log('\n══════════════════════════════════════════════════════');
    console.log('📋 STEP 1 — ALL ORGANIZATIONS');
    console.log('══════════════════════════════════════════════════════');
    const orgs = await client.query(
      `SELECT id, name, type, is_active FROM organizations ORDER BY name`
    );
    if (orgs.rows.length === 0) {
      console.log('  ❌ No organizations found in DB!');
    } else {
      orgs.rows.forEach(o => {
        console.log(`  • [${o.type.toUpperCase()}] ${o.name}  (id=${o.id})  active=${o.is_active}`);
      });
    }

    // ── Step 2: List all API keys ──────────────────────────────────────────
    console.log('\n══════════════════════════════════════════════════════');
    console.log('🔑 STEP 2 — ALL API KEYS');
    console.log('══════════════════════════════════════════════════════');

    // Check if group_id column exists
    const colCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'api_keys' AND column_name = 'group_id'
    `);
    const hasGroupId = colCheck.rows.length > 0;

    if (!hasGroupId) {
      console.log('  ⚠️  group_id column MISSING from api_keys table — will add it.');
      await client.query(`ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL`);
      console.log('  ✅ group_id column added to api_keys.');
    }

    const keysQuery = `
      SELECT ak.id, ak.key_prefix, ak.name, ak.is_active,
             ak.org_id, ak.group_id, ak.last_used_at,
             o.name AS org_name
      FROM api_keys ak
      JOIN organizations o ON o.id = ak.org_id
      ORDER BY ak.created_at
    `;
    const keys = await client.query(keysQuery);

    if (keys.rows.length === 0) {
      console.log('  ❌ No API keys found in DB!');
      console.log('\n  To create one, run: node generate_api_key.js');
    } else {
      keys.rows.forEach(k => {
        console.log(`\n  🔑 Key: ${k.key_prefix}...`);
        console.log(`     Name:     ${k.name}`);
        console.log(`     Org:      ${k.org_name} (id=${k.org_id})`);
        console.log(`     Group ID: ${k.group_id || 'null (org-wide)'}`);
        console.log(`     Active:   ${k.is_active}`);
        console.log(`     Last Used:${k.last_used_at || 'never'}`);
      });
    }

    // ── Step 3: Find Satyadeva vehicles ──────────────────────────────────────
    console.log('\n══════════════════════════════════════════════════════');
    console.log('🚛 STEP 3 — VEHICLES WITH TS29TA PLATES (Satyadeva fleet)');
    console.log('══════════════════════════════════════════════════════');
    const vehicles = await client.query(`
      SELECT v.id, v.plate, v.imei, v.is_active, v.org_id, o.name AS org_name
      FROM vehicles v
      JOIN organizations o ON o.id = v.org_id
      WHERE v.plate ILIKE 'TS29TA%' OR v.name ILIKE '%satyadeva%' OR v.name ILIKE '%TS29%'
      ORDER BY v.plate
    `);

    if (vehicles.rows.length === 0) {
      console.log('  ⚠️  No TS29TA vehicles found by plate. Showing all vehicles:');
      const allV = await client.query(
        `SELECT v.plate, v.imei, v.is_active, v.org_id, o.name AS org_name
         FROM vehicles v JOIN organizations o ON o.id = v.org_id
         ORDER BY v.plate LIMIT 20`
      );
      allV.rows.forEach(v => {
        console.log(`  • ${v.plate || '(no plate)'}  IMEI:${v.imei}  Org:${v.org_name}  active:${v.is_active}`);
      });
    } else {
      vehicles.rows.forEach(v => {
        console.log(`  • ${v.plate}  IMEI:${v.imei}  Org:${v.org_name} (${v.org_id})  active:${v.is_active}`);
      });
    }

    // ── Step 4: Detect mismatch ──────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════════════════');
    console.log('🔍 STEP 4 — MISMATCH DIAGNOSIS');
    console.log('══════════════════════════════════════════════════════');

    if (keys.rows.length > 0 && vehicles.rows.length > 0) {
      const apiKeyOrgIds = new Set(keys.rows.map(k => k.org_id));
      const vehicleOrgIds = new Set(vehicles.rows.map(v => v.org_id));
      const matched = [...apiKeyOrgIds].filter(id => vehicleOrgIds.has(id));

      if (matched.length > 0) {
        console.log('  ✅ API key org and vehicle org MATCH! No mismatch.');
        console.log('  ℹ️  If /api/v1/vehicles still returns [], check is_active=TRUE on vehicles.');
        
        // Check inactive vehicles
        const inactiveCheck = await client.query(`
          SELECT COUNT(*) FROM vehicles WHERE org_id = ANY($1) AND is_active = FALSE
        `, [[...vehicleOrgIds]]);
        if (parseInt(inactiveCheck.rows[0].count) > 0) {
          console.log(`  ⚠️  ${inactiveCheck.rows[0].count} vehicles have is_active=FALSE — they won't appear in API!`);
          console.log('  Run Step 5 to fix.');
        }
      } else {
        console.log('  ❌ MISMATCH DETECTED!');
        console.log(`  API key is linked to org(s): ${keys.rows.map(k => k.org_name).join(', ')}`);
        console.log(`  Vehicles belong to org(s):   ${[...new Set(vehicles.rows.map(v => v.org_name))].join(', ')}`);
        console.log('\n  ➡️  The API key org_id needs to be updated to match the vehicles org_id.');

        // Suggest fix
        const vehicleOrgId = vehicles.rows[0].org_id;
        const vehicleOrgName = vehicles.rows[0].org_name;
        const apiKeyId = keys.rows[0].id;

        console.log('\n══════════════════════════════════════════════════════');
        console.log('🔧 STEP 5 — APPLYING FIX: Updating API key org_id');
        console.log('══════════════════════════════════════════════════════');
        console.log(`  Updating API key ${keys.rows[0].key_prefix}... → org: ${vehicleOrgName} (${vehicleOrgId})`);

        await client.query(
          `UPDATE api_keys SET org_id = $1 WHERE id = $2`,
          [vehicleOrgId, apiKeyId]
        );
        console.log('  ✅ Done! API key now points to the correct organization.');
        console.log('  Test: GET /api/v1/vehicles — should now return your 13 vehicles.');
      }
    } else {
      console.log('  ℹ️  Not enough data to diagnose mismatch. Check steps 1-3 above.');
    }

    // ── Step 5: Check the /api/v12 route issue ───────────────────────────────
    console.log('\n══════════════════════════════════════════════════════');
    console.log('📍 STEP 6 — ROUTE AUDIT: /api/v12 vs real endpoints');
    console.log('══════════════════════════════════════════════════════');
    console.log('  ❌ /api/v12/vehicles/{userId}/{imei} does NOT exist in this codebase.');
    console.log('  ✅ CORRECT endpoint for live location:');
    console.log('       GET /api/v1/location/live?imei=<IMEI>');
    console.log('       Header: X-API-Key: <your_key>');
    console.log('  ✅ CORRECT endpoint for history:');
    console.log('       GET /api/v1/location/history?imei=<IMEI>&start=YYYY-MM-DD&end=YYYY-MM-DD');
    console.log('       Header: X-API-Key: <your_key>');
    console.log('  ✅ CORRECT endpoint for live (POST, by plate):');
    console.log('       POST /api/v1/location/live');
    console.log('       Body: { "vehicleRegistrationNumber": "TS29TA8888" }');

    // ── Final summary ─────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════════════════');
    console.log('✅ DIAGNOSIS COMPLETE');
    console.log('══════════════════════════════════════════════════════\n');

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error(err.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
