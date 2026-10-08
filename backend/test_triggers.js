const db = require('./config/db');

async function test() {
  const result = await db.query(`
    SELECT event_object_table, trigger_name, event_manipulation, action_statement
    FROM information_schema.triggers
    WHERE event_object_table = 'vehicle_groups';
  `);
  console.log(result.rows);
  process.exit(0);
}
test();
