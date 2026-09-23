const db = require('./config/db');

async function schema() {
  try {
    const res = await db.query(`
      SELECT conname, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE conrelid = 'devices'::regclass OR conrelid = 'vehicles'::regclass;
    `);
    console.log(res.rows);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}

schema();
