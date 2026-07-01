const { execSync } = require('child_process');

const query = `
const db = require('./fueltracks1/backend/config/db');
async function run() {
  try {
    const res = await db.query("SELECT * FROM vehicles WHERE name='Vehicle 869925071852873'");
    console.log('VEHICLE:', res.rows[0]);
    if (res.rows[0]) {
      const imei = res.rows[0].imei;
      const res2 = await db.query("SELECT received_at, packet_type, device_time FROM raw_packets WHERE imei=$1 ORDER BY received_at DESC LIMIT 10", [imei]);
      console.log('PACKETS:', res2.rows);
    }
  } catch(e) { console.error(e); }
  process.exit(0);
}
run();
`;

require('fs').writeFileSync('query_remote.js', query);

try {
  execSync('scp -i C:\\Users\\user\\Downloads\\KeyPair.pem -o StrictHostKeyChecking=no query_remote.js ubuntu@52.62.156.181:/home/ubuntu/query_remote.js');
  const out = execSync('ssh -i C:\\Users\\user\\Downloads\\KeyPair.pem -o StrictHostKeyChecking=no ubuntu@52.62.156.181 "node query_remote.js"');
  console.log(out.toString());
} catch(e) {
  console.error(e.stdout ? e.stdout.toString() : e.message);
  console.error(e.stderr ? e.stderr.toString() : '');
}
