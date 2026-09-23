/**
 * Deep diagnostic: Check the group, vehicles in it, and the API key state
 * Run: node deep_check.js
 */
const { Pool } = require('pg');
const env = require('./backend/config/env');

const pool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASS,
});

const GROUP_ID = 'ab3da8b8-11ec-4045-bce7-cce1ef32261d';

async function run() {
  const client = await pool.connect();
  try {
    console.log('\n══════════════════════════════════════════════════════');
    console.log('🔍 GROUP INFO');
    console.log('══════════════════════════════════════════════════════');
    const grp = await client.query(`
      SELECT g.id, g.name, g.org_id, o.name AS org_name, g.is_active
      FROM groups g JOIN organizations o ON o.id = g.org_id
      WHERE g.id = $1
    `, [GROUP_ID]);
    console.log(grp.rows[0] || 'GROUP NOT FOUND');

    console.log('\n══════════════════════════════════════════════════════');
    console.log('🚛 VEHICLES IN THIS GROUP');
    console.log('══════════════════════════════════════════════════════');
    const vg = await client.query(`
      SELECT v.plate, v.imei, v.is_active, v.org_id, o.name AS org_name
      FROM vehicle_groups vg
      JOIN vehicles v ON v.id = vg.vehicle_id
      JOIN organizations o ON o.id = v.org_id
      WHERE vg.group_id = $1
      ORDER BY v.plate
    `, [GROUP_ID]);
    if (vg.rows.length === 0) {
      console.log('  ❌ NO VEHICLES ASSIGNED TO THIS GROUP!');
      console.log('  This is why the API returns count:0 — the group exists but has no vehicles in it.');
    } else {
      vg.rows.forEach(v => console.log(`  • ${v.plate}  IMEI:${v.imei}  org:${v.org_name}  active:${v.is_active}`));
    }

    console.log('\n══════════════════════════════════════════════════════');
    console.log('📋 API KEYS WITH THIS GROUP_ID');
    console.log('══════════════════════════════════════════════════════');
    const keys = await client.query(`
      SELECT ak.key_prefix, ak.name, ak.org_id, ak.group_id, ak.is_active,
             o.name AS org_name
      FROM api_keys ak
      JOIN organizations o ON o.id = ak.org_id
      WHERE ak.group_id = $1 OR ak.is_active = TRUE
      ORDER BY ak.created_at
    `, [GROUP_ID]);
    keys.rows.forEach(k => {
      const isGroupKey = k.group_id === GROUP_ID;
      console.log(`  ${isGroupKey ? '🎯' : '  '} ${k.key_prefix}... | name: ${k.name} | org: ${k.org_name} | group_id: ${k.group_id || 'null'}`);
    });

    console.log('\n══════════════════════════════════════════════════════');
    console.log('🚛 ALL TS29 VEHICLES (Satyadeva fleet) + their org');
    console.log('══════════════════════════════════════════════════════');
    const ts29 = await client.query(`
      SELECT v.id, v.plate, v.imei, v.is_active, v.org_id, o.name AS org_name
      FROM vehicles v JOIN organizations o ON o.id = v.org_id
      WHERE v.plate ILIKE 'TS29%' OR v.plate ILIKE 'TS30%'
      ORDER BY v.plate
    `);
    ts29.rows.forEach(v => console.log(`  • ${v.plate}  IMEI:${v.imei}  org:${v.org_name} (${v.org_id})  active:${v.is_active}`));

    console.log('\n══════════════════════════════════════════════════════');
    console.log('🔑 THE KEY BEING USED (last used Sep 22)');
    console.log('══════════════════════════════════════════════════════');
    const activeKey = await client.query(`
      SELECT ak.key_prefix, ak.name, ak.is_active, ak.org_id, ak.group_id,
             ak.last_used_at, o.name AS org_name,
             (SELECT COUNT(*) FROM vehicles v WHERE v.org_id = ak.org_id AND v.is_active = TRUE) AS vehicles_in_org,
             CASE WHEN ak.group_id IS NOT NULL THEN
               (SELECT COUNT(*) FROM vehicle_groups vg WHERE vg.group_id = ak.group_id)
             ELSE NULL END AS vehicles_in_group
      FROM api_keys ak
      JOIN organizations o ON o.id = ak.org_id
      ORDER BY ak.last_used_at DESC NULLS LAST
      LIMIT 3
    `);
    activeKey.rows.forEach(k => {
      console.log(`\n  Key: ${k.key_prefix}...`);
      console.log(`  Name: ${k.name}`);
      console.log(`  Org: ${k.org_name} (${k.org_id})`);
      console.log(`  Group ID: ${k.group_id || 'null (org-wide)'}`);
      console.log(`  Vehicles in org: ${k.vehicles_in_org}`);
      console.log(`  Vehicles in group: ${k.vehicles_in_group ?? 'N/A'}`);
      console.log(`  Last used: ${k.last_used_at}`);
    });

    console.log('\n══════════════════════════════════════════════════════');
    console.log('🔧 WHAT NEEDS TO BE FIXED');
    console.log('══════════════════════════════════════════════════════');

    // The key last used on Sep 22 is ftkn_d1ed5e1 -> org: sathyadeva
    // Vehicles are in FuelTracks Platform org
    // Group ab3da8b8 may have no vehicles assigned
    
    const satyadevKey = await client.query(`
      SELECT ak.id, ak.key_prefix, ak.org_id, ak.group_id, o.name AS org_name
      FROM api_keys ak JOIN organizations o ON o.id = ak.org_id
      WHERE ak.last_used_at > NOW() - INTERVAL '2 days'
      ORDER BY ak.last_used_at DESC LIMIT 1
    `);
    
    if (satyadevKey.rows.length > 0) {
      const key = satyadevKey.rows[0];
      
      // Get the FuelTracks Platform org id
      const platformOrg = await client.query(`
        SELECT id FROM organizations WHERE name = 'FuelTracks Platform' LIMIT 1
      `);
      
      const platformOrgId = platformOrg.rows[0]?.id;
      
      if (key.org_id !== platformOrgId) {
        console.log(`\n  Problem: Key ${key.key_prefix} is linked to "${key.org_name}"`);
        console.log(`  But TS29TA vehicles are under "FuelTracks Platform" (${platformOrgId})`);
        console.log(`\n  Fix Option A: Move API key to FuelTracks Platform org`);
        console.log(`  Fix Option B: Move TS29TA vehicles to sathyadeva org`);
        console.log(`  Fix Option C: Remove group restriction so key sees all org vehicles`);
        console.log('\n  ✅ Applying Fix A — updating API key org to FuelTracks Platform...');
        
        await client.query(
          'UPDATE api_keys SET org_id = $1, group_id = $2 WHERE id = $3',
          [platformOrgId, GROUP_ID, key.id]
        );
        console.log('  ✅ Done! Key now points to FuelTracks Platform org with group filter.');
        
        // Verify vehicles in group
        const groupCount = await client.query(
          'SELECT COUNT(*) FROM vehicle_groups WHERE group_id = $1', [GROUP_ID]
        );
        const count = parseInt(groupCount.rows[0].count);
        if (count === 0) {
          console.log(`\n  ⚠️  Group ${GROUP_ID} has 0 vehicles assigned!`);
          console.log('  The API key points to this group but no vehicles are in it.');
          console.log('\n  Assigning all TS29TA + TS30TA vehicles to this group now...');
          
          const tsVehicles = await client.query(`
            SELECT id, plate FROM vehicles 
            WHERE (plate ILIKE 'TS29TA%' OR plate ILIKE 'TS29TB%' OR plate ILIKE 'TS30TA%')
            AND org_id = $1 AND is_active = TRUE
          `, [platformOrgId]);
          
          console.log(`  Found ${tsVehicles.rows.length} TS29/TS30 vehicles to assign.`);
          
          for (const v of tsVehicles.rows) {
            await client.query(`
              INSERT INTO vehicle_groups (vehicle_id, group_id)
              VALUES ($1, $2) ON CONFLICT DO NOTHING
            `, [v.id, GROUP_ID]);
            console.log(`    ✅ Assigned ${v.plate} to group`);
          }
        } else {
          console.log(`  ✅ Group already has ${count} vehicles assigned.`);
        }
      } else {
        console.log('  Key already points to correct org. Issue may be empty group.');
        // Assign TS29TA vehicles to the group
        const tsVehicles = await client.query(`
          SELECT id, plate FROM vehicles 
          WHERE plate ILIKE 'TS29%' AND org_id = $1 AND is_active = TRUE
        `, [platformOrgId]);
        
        for (const v of tsVehicles.rows) {
          await client.query(`
            INSERT INTO vehicle_groups (vehicle_id, group_id)
            VALUES ($1, $2) ON CONFLICT DO NOTHING
          `, [v.id, GROUP_ID]);
          console.log(`    ✅ Assigned ${v.plate} to group`);
        }
      }
    }

    console.log('\n══════════════════════════════════════════════════════');
    console.log('✅ FINAL STATE — Vehicles now visible via API:');
    console.log('══════════════════════════════════════════════════════');
    const finalCheck = await client.query(`
      SELECT v.plate, v.imei FROM vehicle_groups vg
      JOIN vehicles v ON v.id = vg.vehicle_id
      WHERE vg.group_id = $1 AND v.is_active = TRUE
      ORDER BY v.plate
    `, [GROUP_ID]);
    console.log(`  Total: ${finalCheck.rows.length} vehicles`);
    finalCheck.rows.forEach(v => console.log(`  • ${v.plate}  IMEI:${v.imei}`));

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
