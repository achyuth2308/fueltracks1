const db = require('./config/db');

async function test() {
  try {
    const res = await db.query(`
      SELECT v.imei, v.plate, v.name
        FROM vehicles v
        WHERE v.is_active = TRUE
          AND v.id IN (SELECT vehicle_id FROM vehicle_groups WHERE group_id = 'ab3da8b8-11ec-4045-bce7-cce1ef32261d')
        ORDER BY v.plate ASC
    `);
    console.log(res.rows);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit();
  }
}
test();
