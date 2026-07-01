
const db = require('./fueltracks1/backend/config/db');
async function run() {
  try {
    const res = await db.query(`
      SELECT 
        ((NOW() AT TIME ZONE 'Asia/Kolkata')::date) as d1,
        (((NOW() AT TIME ZONE 'Asia/Kolkata')::date)::timestamp AT TIME ZONE 'Asia/Kolkata') as d2,
        (DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata') as d3
    `);
    console.log(res.rows[0]);
  } catch (e) { console.error(e); }
  process.exit(0);
}
run();
