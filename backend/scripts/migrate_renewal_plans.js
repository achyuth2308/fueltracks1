const db = require('../config/db');

async function migrate() {
  const client = await db.pool.connect();
  try {
    console.log('Starting migration for Renewal Plans...');
    await client.query('BEGIN');

    // Create renewal_plans table
    await client.query(`
      CREATE TABLE IF NOT EXISTS renewal_plans (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        duration_months INT NOT NULL,
        price DECIMAL NOT NULL,
        org_id UUID REFERENCES organizations(id),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Check if we already have default plans
    const { rows: planCount } = await client.query('SELECT COUNT(*) FROM renewal_plans');
    if (parseInt(planCount[0].count) === 0) {
      await client.query(`
        INSERT INTO renewal_plans (name, duration_months, price, org_id) VALUES 
        ('1 Month Basic', 1, 300, NULL),
        ('6 Months Saver', 6, 1500, NULL),
        ('1 Year Premium', 12, 2500, NULL)
      `);
      console.log('Inserted default renewal plans.');
    }

    // Alter renewal_transactions to add plan_id and duration_months
    // We add them as nullable first to not break existing records
    await client.query(`
      ALTER TABLE renewal_transactions 
      ADD COLUMN IF NOT EXISTS plan_id INT REFERENCES renewal_plans(id),
      ADD COLUMN IF NOT EXISTS duration_months INT
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
