const { Pool } = require('pg');
const env = require('./backend/config/env');

const pool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASS,
});

async function run() {
  const client = await pool.connect();
  try {
    // 1. Let's find all TS29, TS30, and similar vehicles
    const res = await client.query(`
      SELECT plate, imei, o.name AS org_name
      FROM vehicles v
      JOIN organizations o ON o.id = v.org_id
      WHERE plate ILIKE 'TS29%' OR plate ILIKE 'TS30%' OR plate ILIKE 'TS34%' OR plate ILIKE 'TS15%'
      ORDER BY plate
    `);
    
    console.log(`Found ${res.rows.length} potential vehicles...`);
    res.rows.forEach(v => console.log(`${v.plate}  |  ${v.imei}  |  ${v.org_name}`));
    
    // 2. Also check if there's a specific user or group for Sreesathyadeva that has exactly 13 assigned.
    console.log('\n--- Checking the sathyadeva organization ---');
    const sOrg = await client.query(`
      SELECT plate, imei FROM vehicles v
      JOIN organizations o ON o.id = v.org_id
      WHERE o.name ILIKE '%sathyadeva%'
    `);
    console.log(`Vehicles in sathyadeva org: ${sOrg.rows.length}`);
    sOrg.rows.forEach(v => console.log(`${v.plate}  |  ${v.imei}`));
    
  } finally {
    client.release();
    await pool.end();
  }
}
run().catch(console.error);
