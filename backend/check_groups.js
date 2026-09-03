const db = require('./config/db');

async function check() {
  const userId = '4b19b3d8-21c7-462a-9b25-d15c03c1ac8b';
  const res = await db.query(`SELECT group_id FROM user_groups WHERE user_id = $1`, [userId]);
  if (res.rows.length > 0) {
    const groupId = res.rows[0].group_id;
    const res2 = await db.query(`SELECT count(*) FROM vehicle_groups WHERE group_id = $1`, [groupId]);
    console.log("Vehicles in group:", res2.rows[0].count);
    
    // Also let's check total vehicles in org just in case they were org-wide before
    const res3 = await db.query(`SELECT count(*) FROM vehicles WHERE org_id = (SELECT org_id FROM users WHERE id = $1)`, [userId]);
    console.log("Vehicles in org:", res3.rows[0].count);
  }
  process.exit(0);
}
check();
