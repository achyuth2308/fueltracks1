const db = require('./backend/config/db');

async function run() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS restore_requests (
      id SERIAL PRIMARY KEY,
      vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
      s3_key VARCHAR(255) NOT NULL,
      requested_by_email VARCHAR(255) NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW(),
      notified_at TIMESTAMP,
      UNIQUE(s3_key, requested_by_email)
    );
  `);
  console.log("restore_requests table created.");
  process.exit(0);
}

run().catch(console.error);
