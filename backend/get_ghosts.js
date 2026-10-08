const db = require('./config/db');

async function run() {
  try {
    const res = await db.query(`
      SELECT imei, count(*) as hits, max(received_at) as last_seen 
      FROM raw_packets 
      WHERE error = 'Unregistered IMEI' 
        AND received_at > now() - interval '24 hours' 
      GROUP BY imei 
      ORDER BY hits DESC 
      LIMIT 10
    `);
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
