const db = require('./backend/config/db');
db.query("SELECT metadata->>'vehicleId' as vehicle_id FROM vehicles WHERE metadata->>'vehicleId' LIKE '125KVADGNEC_%' ORDER BY metadata->>'vehicleId' DESC LIMIT 1")
  .then(res => { console.log(JSON.stringify(res.rows)); process.exit(0); })
  .catch(err => { console.error(err); process.exit(1); });
