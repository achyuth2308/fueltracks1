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
    const platformOrg = await client.query(`SELECT id FROM organizations WHERE name = 'FuelTracks Platform' LIMIT 1`);
    const platformOrgId = platformOrg.rows[0].id;

    console.log('Assigning TS29 and TS30 vehicles to group...');
    const tsVehicles = await client.query(`
      SELECT id, plate FROM vehicles 
      WHERE (plate ILIKE 'TS29%' OR plate ILIKE 'TS30%')
      AND org_id = $1 AND is_active = TRUE
    `, [platformOrgId]);
    
    for (const v of tsVehicles.rows) {
      await client.query(`
        INSERT INTO vehicle_groups (vehicle_id, group_id)
        VALUES ($1, $2) ON CONFLICT DO NOTHING
      `, [v.id, GROUP_ID]);
      console.log(`  ✅ Assigned ${v.plate} to group`);
    }
    
    console.log('\nFinal state of the group:');
    const finalCheck = await client.query(`
      SELECT v.plate, v.imei FROM vehicle_groups vg
      JOIN vehicles v ON v.id = vg.vehicle_id
      WHERE vg.group_id = $1 AND v.is_active = TRUE
      ORDER BY v.plate
    `, [GROUP_ID]);
    console.log(`Total: ${finalCheck.rows.length} vehicles`);
    finalCheck.rows.forEach(v => console.log(`  • ${v.plate}  IMEI:${v.imei}`));
    
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
