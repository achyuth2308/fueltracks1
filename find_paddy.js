const db = require('./backend/config/db');
db.query("SELECT id, name, org_id FROM groups WHERE name ILIKE '%paddy%'")
  .then(r => {
    console.table(r.rows);
    process.exit(0);
  });
