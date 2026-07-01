require('dotenv').config({ path: '../.env' });
const db = require('./config/db');

db.query(`SELECT v.id, v.name, v.imei, vls.last_seen, vls.is_online FROM vehicles v LEFT JOIN vehicle_latest_state vls ON v.id = vls.vehicle_id WHERE v.name='Vehicle 869925071852873' OR v.name='ACTIVA_TS07HH4867'`)
  .then(r => { 
    console.log("Vehicle State:");
    console.table(r.rows); 
    process.exit(0); 
  })
  .catch(e => { console.error(e); process.exit(1); });
