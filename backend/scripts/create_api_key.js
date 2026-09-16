// ============================================================
// CREATE API KEY — FuelTracks Operator Script
// Run this on the production server to generate a new API key
// for a third-party client (e.g. Cement OMS).
//
// USAGE:
//   node scripts/create_api_key.js \
//     --org "Cement OMS Client" \
//     --label "Cement OMS Production Key" \
//     [--group-id <uuid>]   (optional: restrict to a vehicle group)
//
// EXAMPLE:
//   node scripts/create_api_key.js --org "Cement OMS" --label "Prod Key"
//
// OUTPUT:
//   Prints the raw API key ONCE. Store it securely. It cannot be recovered.
// ============================================================

'use strict';

const crypto = require('crypto');
const db     = require('../config/db');

// ── Parse CLI args ──────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
}

const orgName  = getArg('--org');
const label    = getArg('--label') || 'API Key';
const groupId  = getArg('--group-id') || null;

if (!orgName) {
  console.error('\nERROR: --org "Organization Name" is required.\n');
  console.error('Usage: node scripts/create_api_key.js --org "Client Name" --label "Key Label" [--group-id <uuid>]');
  process.exit(1);
}

async function main() {
  try {
    // 1. Find the org by name
    const orgRes = await db.query(
      `SELECT id, name FROM organizations WHERE name ILIKE $1 LIMIT 1`,
      [orgName]
    );

    if (orgRes.rows.length === 0) {
      console.error(`\nERROR: No organization found with name matching "${orgName}".\n`);
      console.error('Available organizations:');
      const allOrgs = await db.query('SELECT name FROM organizations ORDER BY name');
      allOrgs.rows.forEach((o) => console.error(`  • ${o.name}`));
      process.exit(1);
    }

    const org = orgRes.rows[0];

    // 2. Generate a cryptographically secure raw key
    const rawKey    = 'ftkn_' + crypto.randomBytes(32).toString('hex');
    const keyHash   = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 12); // e.g. "ftkn_a1b2c3"

    // 3. Insert into api_keys table
    const result = await db.query(
      `INSERT INTO api_keys (org_id, key_hash, key_prefix, name, group_id, is_active)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING id, created_at`,
      [org.id, keyHash, keyPrefix, label, groupId]
    );

    const keyRecord = result.rows[0];

    // 4. Print the key — THIS IS THE ONLY TIME IT WILL EVER BE VISIBLE
    console.log('\n============================================================');
    console.log('  ✅  API KEY CREATED SUCCESSFULLY');
    console.log('============================================================');
    console.log(`  Organization : ${org.name} (${org.id})`);
    console.log(`  Key ID       : ${keyRecord.id}`);
    console.log(`  Label        : ${label}`);
    console.log(`  Group Scope  : ${groupId || 'None (org-wide access)'}`);
    console.log(`  Created At   : ${keyRecord.created_at}`);
    console.log('------------------------------------------------------------');
    console.log(`  🔑 API KEY (copy this — it will NOT be shown again):`);
    console.log('');
    console.log(`     ${rawKey}`);
    console.log('');
    console.log('  Hand this key to the client. Instruct them to send it in');
    console.log('  every API request as:  X-API-Key: <key>');
    console.log('============================================================\n');

  } catch (err) {
    console.error('\nERROR creating API key:', err.message);
    process.exit(1);
  } finally {
    await db.end?.();
    process.exit(0);
  }
}

main();
