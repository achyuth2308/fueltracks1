const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: './backend/.env' });

async function run() {
  try {
    const token = jwt.sign(
      { userId: 'dc32f93a-310e-4757-a44d-cc78016fb0e0', role: 'superadmin', orgId: 'a0000000-0000-0000-0000-000000000001' },
      process.env.JWT_SECRET || 'fueltracks_super_secret_key_2024_secure',
      { expiresIn: '1h' }
    );
    
    const id = 'ab3da8b8-11ec-4045-bce7-cce1ef32261d';
    console.log("Making PUT request...");
    const res = await axios.put(`http://127.0.0.1:5000/api/admin/groups/${id}`, {
      name: 'SREESATHYADEVA2',
      orgId: '15d63d13-839a-42af-ad39-7458349b2ba7',
      vehicleIds: []
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("Response:", res.data);
    
    // Revert
    await axios.put(`http://127.0.0.1:5000/api/admin/groups/${id}`, {
      name: 'SREESATHYADEVA',
      orgId: '15d63d13-839a-42af-ad39-7458349b2ba7'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("Reverted!");
  } catch (err) {
    console.error("API Error:", err.response ? err.response.data : err.message);
  }
}
run();
