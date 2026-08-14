const { Pool } = require('pg');
const env = require('./backend/config/env');
const pool = new Pool({ host: env.DB_HOST, port: env.DB_PORT, database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASS });
pool.query(`
  UPDATE user_alert_preferences 
  SET preferences = preferences - 'moving' || jsonb_build_object('trip_started', coalesce(preferences->'moving', 'false'::jsonb)) 
  WHERE preferences ? 'moving';
`).then(res => { 
  console.log('Updated rows:', res.rowCount); 
  process.exit(0); 
}).catch(console.error);
