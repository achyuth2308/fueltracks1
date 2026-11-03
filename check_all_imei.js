
const { query } = require('./fueltracks1/backend/config/db');

async function check() {
  const imei = '861329082394405';

  const r = await query(
    'SELECT id, imei, received_at, packet_type, SUBSTRING(raw, 1, 120) as pkt FROM raw_packets WHERE imei = $1 ORDER BY received_at DESC LIMIT 10',
    [imei]
  );
  console.log('--- ALL PACKETS FOR THIS IMEI ---');
  console.log(r.rows);

  process.exit(0);
}

check();
