'use strict';
const db = require('../backend/config/db');
const { redis } = require('../backend/config/redis');

async function arm(target) {
  const query = target.length > 20 
    ? 'SELECT id, name, imei, metadata FROM vehicles WHERE id = $1'
    : 'SELECT id, name, imei, metadata FROM vehicles WHERE imei = $1';
  
  const res = await db.query(query, [target]);
  if (!res.rows.length) {
    console.error('Vehicle not found:', target);
    process.exit(1);
  }
  const v = res.rows[0];
  const meta = { ...(v.metadata || {}), safetyPark: 'YES' };
  await db.query('UPDATE vehicles SET metadata = $1 WHERE id = $2', [JSON.stringify(meta), v.id]);
  await redis.del('vehicles:all');
  await redis.del('vehicle:obj:' + v.id);
  await redis.del('vehicle:imei:' + v.imei);
  await redis.del('vehicle:safety_park_fired:' + v.id);
  await redis.del('vehicle:safety_park_breach:' + v.id);
  console.log(`Successfully armed Safety Parking for ${v.name} (IMEI: ${v.imei}) in database!`);
  process.exit(0);
}

const target = process.argv[2] || '87d75216-e5f0-4537-9328-69e353c13ace';
arm(target).catch(err => {
  console.error(err);
  process.exit(1);
});
