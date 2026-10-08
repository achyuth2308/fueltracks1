const GroupModel = require('./backend/models/groupModel');
const db = require('./backend/config/db');

async function testUpdate() {
  try {
    const id = 'ab3da8b8-11ec-4045-bce7-cce1ef32261d'; // SREESATHYADEVA
    const name = 'SREESATHYADEVA2';
    const orgId = '15d63d13-839a-42af-ad39-7458349b2ba7';
    
    console.log("Updating...");
    const updated = await GroupModel.update(id, { name, description: undefined, isActive: undefined, orgId });
    console.log("Updated:", updated);
    
    // Revert back
    await GroupModel.update(id, { name: 'SREESATHYADEVA', orgId });
    console.log("Reverted");
  } catch (e) {
    console.error("Error:", e);
  } finally {
    process.exit(0);
  }
}
testUpdate();
