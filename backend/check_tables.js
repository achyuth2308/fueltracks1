const db = require('./config/db');
db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
  .then(res => { console.log(res.rows); process.exit(0); })
  .catch(console.error);
