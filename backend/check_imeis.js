require('dotenv').config({ path: '/home/fueltracks/fueltracks1/backend/.env' });
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool();
const imeis = fs.readFileSync('/home/fueltracks/recent_imeis.txt', 'utf8').trim().split('\n');
(async () => {
  try {
    const res = await pool.query('SELECT imei FROM vehicles WHERE imei = ANY($1)', [imeis]);
    const registered = new Set(res.rows.map(r => r.imei));
    const unregistered = imeis.filter(i => !registered.has(i));
    console.log('--- REGISTERED (' + registered.size + ') ---');
    console.log(Array.from(registered).slice(0, 10).join(', '));
    console.log('--- UNREGISTERED (' + unregistered.length + ') ---');
    console.log(unregistered.slice(0, 10).join(', '));
  } catch(e) {
    console.error('DB Error:', e.message);
  } finally {
    pool.end();
  }
})();
