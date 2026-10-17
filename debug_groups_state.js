const db = require('./backend/config/db');

async function inspect() {
  const sovOrgs = await db.query(`SELECT id, name, type FROM organizations WHERE name ILIKE '%sover%'`);
  console.log('=== SOVEREIGN ORGS ===\n', sovOrgs.rows);

  for (let o of sovOrgs.rows) {
    const veh = await db.query(`SELECT id, plate, imei, name, org_id FROM vehicles WHERE org_id = $1`, [o.id]);
    console.log(`Vehicles directly in org ${o.name} (${o.id}): ${veh.rows.length}`);
    if (veh.rows.length > 0) {
      console.log(veh.rows.map(v => v.plate).join(', '));
    }

    const grps = await db.query(`SELECT id, name FROM groups WHERE org_id = $1`, [o.id]);
    console.log(`Groups in org ${o.name}:`, grps.rows);
  }

  // Check if there are vehicles with sovereign in metadata or plate or name
  const allSovVeh = await db.query(`SELECT id, plate, name, org_id FROM vehicles WHERE plate ILIKE '%sover%' OR name ILIKE '%sover%'`);
  console.log('Vehicles matching sovereign in plate/name:', allSovVeh.rows);

  process.exit(0);
}

inspect().catch(e => { console.error(e); process.exit(1); });
