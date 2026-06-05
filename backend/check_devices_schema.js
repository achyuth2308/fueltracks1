const db = require('./config/db');
db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'devices'")
  .then(res => { console.log(res.rows); process.exit(0); })
  .catch(console.error);
