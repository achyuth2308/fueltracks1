const db = require('./config/db');
const AdminController = require('./controllers/adminController');

async function test() {
  try {
    const res = await db.query("SELECT * FROM groups LIMIT 1;");
    if (res.rows.length === 0) return console.log("No groups.");
    const group = res.rows[0];
    console.log("Found group:", group.name);
    
    const req = {
      user: { role: 'superadmin', orgId: group.org_id, userId: 'test' },
      params: { id: group.id },
      body: { name: group.name + ' Edited', description: group.description, isActive: true, orgId: group.org_id, vehicleIds: [] }
    };
    
    let error;
    const resObj = {
      status: (code) => ({ json: (data) => console.log(code, data) }),
      json: (data) => console.log(200, data)
    };
    const next = (err) => { error = err; console.error("Error:", err); };
    
    await AdminController.updateGroup(req, resObj, next);
  } catch (e) {
    console.error("Test Error:", e);
  } finally {
    process.exit(0);
  }
}
test();
