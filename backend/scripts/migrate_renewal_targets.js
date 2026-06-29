const db = require('../config/db');

async function migrate() {
  const client = await db.pool.connect();
  try {
    console.log('Starting migration for Renewal Plan Targets...');
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE renewal_plans 
      ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id)
    `);

    await client.query('COMMIT');
    console.log('Migration completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
  } finally {
    client.release();
    db.pool.end();
  }
}

migrate();
