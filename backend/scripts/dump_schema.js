const db = require('../config/db');
async function dump() {
  const res1 = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'devices';");
  console.log('DEVICES:');
  console.table(res1.rows);
  const res2 = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'vehicles';");
  console.log('VEHICLES:');
  console.table(res2.rows);
  process.exit(0);
}
dump();
