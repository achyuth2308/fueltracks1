const db = require('./config/db');
db.query("SELECT * FROM devices").then(res => { console.log(res.rows); process.exit(0); });
