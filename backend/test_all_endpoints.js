const axios = require('axios');

const API_URL = 'https://api.fueltracks.in/api/v1';
const API_KEY = 'ftkn_763d3d4535b110feabda8f81cc93807c8058944054615d352d9503fc7bf723f6';

async function testAllMethods() {
  const headers = {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json'
  };

  try {
    console.log("---------------------------------------");
    console.log("1. Testing GET /vehicles");
    const res1 = await axios.get(`${API_URL}/vehicles`, { headers });
    console.log(`✅ Success: ${res1.status}`);
    console.log(`   Count returned: ${res1.data.count}`);
    console.log(`   Vehicles: ${res1.data.vehicles.map(v => v.vehicleRegistrationNumber).join(', ')}`);

    console.log("\n---------------------------------------");
    console.log("2. Testing POST /location/live");
    const res2 = await axios.post(`${API_URL}/location/live`, {
      plates: ["TS29TA8888", "TS29TA8996"]
    }, { headers });
    console.log(`✅ Success: ${res2.status}`);
    console.log(`   Count returned: ${res2.data.count}`);
    if (res2.data.data.length > 0) {
      console.log(`   Sample Data: Plate=${res2.data.data[0].vehicleRegistrationNumber}, State=${res2.data.data[0].vehicleState}`);
    }

    console.log("\n---------------------------------------");
    console.log("3. Testing POST /location/history");
    const res3 = await axios.post(`${API_URL}/location/history`, {
      vehicleRegistrationNumber: "TS29TA8888",
      start: "2026-09-27",
      end: "2026-09-29", // Include today
      page: 1,
      limit: 5
    }, { headers });
    console.log(`✅ Success: ${res3.status}`);
    console.log(`   Count returned: ${res3.data.count}`);
    if (res3.data.data.length > 0) {
      console.log(`   Sample Data: Date=${res3.data.data[0].dateTime}, Speed=${res3.data.data[0].speed}, State=${res3.data.data[0].vehicleState}`);
    }

  } catch (err) {
    console.error("❌ ERROR FAILED!");
    console.error(err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
  }
}

testAllMethods();
