const db = require('./backend/config/db');

async function run() {
  try {
    console.log('1. Checking current admin user...');
    const adminCheck = await db.query("SELECT id, username, email, role, org_id FROM users WHERE username = 'admin'");
    console.log('Current admin:', adminCheck.rows[0]);

    console.log('2. Updating admin user to root FuelTracks Platform (a0000000-0000-0000-0000-000000000001)...');
    await db.query("UPDATE users SET org_id = 'a0000000-0000-0000-0000-000000000001' WHERE username = 'admin'");
    const adminUpdated = await db.query("SELECT id, username, email, role, org_id FROM users WHERE username = 'admin'");
    console.log('Updated admin:', adminUpdated.rows[0]);

    console.log('3. Updating Sathyadeva2 (8833df78-a912-47d3-b136-9ec0a218e091) type to customer...');
    await db.query("UPDATE organizations SET type = 'customer' WHERE id = '8833df78-a912-47d3-b136-9ec0a218e091'");
    const sathyaUpdated = await db.query("SELECT id, name, type FROM organizations WHERE id = '8833df78-a912-47d3-b136-9ec0a218e091'");
    console.log('Updated Sathyadeva2:', sathyaUpdated.rows[0]);

    console.log('4. Checking test duplicate FUELTRACKS TECHNOLOGIES orgs...');
    const dupCheck = await db.query("SELECT id, name FROM organizations WHERE name = 'FUELTRACKS TECHNOLOGIES'");
    console.log('Found duplicate test orgs:', dupCheck.rows);
    for (const d of dupCheck.rows) {
      const uCount = await db.query("SELECT count(*) FROM users WHERE org_id = $1", [d.id]);
      const vCount = await db.query("SELECT count(*) FROM vehicles WHERE org_id = $1", [d.id]);
      if (parseInt(uCount.rows[0].count) === 0 && parseInt(vCount.rows[0].count) === 0) {
        console.log(`Safely removing empty test org ${d.id}...`);
        await db.query("DELETE FROM organizations WHERE id = $1", [d.id]);
      } else {
        console.log(`Skipping deletion of ${d.id} - has attached records.`);
      }
    }
    console.log('5. Checking if any other non-root organizations have type = super...');
    const otherSuper = await db.query("SELECT id, name, type FROM organizations WHERE type = 'super' AND id != 'a0000000-0000-0000-0000-000000000001'");
    console.log('Other super orgs:', otherSuper.rows);
    for (const s of otherSuper.rows) {
      console.log(`Updating ${s.name} (${s.id}) to customer...`);
      await db.query("UPDATE organizations SET type = 'customer' WHERE id = $1", [s.id]);
    }

    console.log('SUCCESS: All database updates completed cleanly.');
  } catch (err) {
    console.error('ERROR during execution:', err);
  } finally {
    process.exit(0);
  }
}
run();
