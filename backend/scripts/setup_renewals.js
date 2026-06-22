const db = require('../config/db');

async function setupRenewals() {
  const client = await db.pool.connect();
  try {
    console.log('Creating renewal tables...');
    await client.query('BEGIN');

    // Create renewal_settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS renewal_settings (
        id SERIAL PRIMARY KEY,
        amount DECIMAL NOT NULL DEFAULT 2000,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert default setting if empty
    const { rows } = await client.query('SELECT count(*) FROM renewal_settings');
    if (parseInt(rows[0].count) === 0) {
      await client.query('INSERT INTO renewal_settings (amount) VALUES (2000)');
      console.log('Inserted default renewal amount of 2000');
    }

    // Create renewal_transactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS renewal_transactions (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id),
        vehicle_id UUID REFERENCES vehicles(id),
        amount DECIMAL NOT NULL,
        status VARCHAR(20) DEFAULT 'PENDING',
        payment_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query('COMMIT');
    console.log('Renewal tables created successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating renewal tables:', err);
  } finally {
    client.release();
    db.pool.end();
  }
}

setupRenewals();
