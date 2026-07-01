const { execSync } = require('child_process');

const query = `
const db = require('./fueltracks1/backend/config/db');
async function run() {
  try {
    const res = await db.query("SELECT id FROM vehicles WHERE plate='FTTPL_MYCARMGWINDSOR'");
    if (res.rows[0]) {
      const vId = res.rows[0].id;
      const res2 = await db.query("SELECT device_time, speed, ignition, odometer FROM gps_points WHERE vehicle_id=$1 AND device_time >= '2026-07-01 00:00:00' AND device_time <= '2026-07-01 23:59:59' ORDER BY device_time", [vId]);
      console.log('JULY 1st POINTS:', res2.rows);
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
