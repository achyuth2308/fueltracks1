const db = require('./backend/config/db');

async function createTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        device_id VARCHAR(50) UNIQUE NOT NULL,
        device_type VARCHAR(50),
        licence_id VARCHAR(50),
        vehicle_id VARCHAR(100),
        assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        assigned_group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Devices table created successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Error creating table:', err);
    process.exit(1);
  }
}

createTable();
