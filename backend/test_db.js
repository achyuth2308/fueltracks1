const { Client } = require('pg');
require('dotenv').config();

const c = new Client({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME
});

c.connect()
  .then(() => c.query("SELECT id, name, plate, imei, created_at, org_id FROM vehicles WHERE plate ILIKE '%4576%';"))
  .then(res => {
    console.log(res.rows);
    c.end();
  })
  .catch(console.error);
