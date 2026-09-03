const { Pool } = require('pg');
const env = require('./backend/config/env');
const fs = require('fs');

const pool = new Pool({ 
  host: env.DB_HOST, 
  port: env.DB_PORT, 
  database: env.DB_NAME, 
  user: env.DB_USER, 
  password: env.DB_PASS 
});

const sql = fs.readFileSync('./database/sand_mining_migration.sql', 'utf8');

pool.query(sql)
  .then(res => { 
    console.log('Migration executed successfully!'); 
    process.exit(0); 
  })
  .catch(err => {
    console.error('Migration failed:', err.message);
    process.exit(1);
  });
