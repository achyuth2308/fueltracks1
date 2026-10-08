const db = require('./config/db');

async function debug() {
  try {
    const res = await db.query("SELECT plate FROM vehicles WHERE plate IN ('AP39TV7279', 'TS07UH4191', 'TS29TA8996', 'TS29TA8888', 'TS29TA8897')");
    console.log("Found plates:", res.rows.map(r => r.plate));
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
debug();
