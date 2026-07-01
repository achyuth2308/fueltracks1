const axios = require('axios');
async function run() {
  try {
    const res = await axios.get('http://52.62.156.181:3001/api/reports/route?vehicleId=2&startDate=2026-07-01 00:00:00&endDate=2026-07-01 23:59:59', {
      headers: { 'Authorization': 'Bearer YOUR_TOKEN_HERE' }
    });
    console.log(res.data.data.slice(0, 2));
  } catch(e) { console.error(e.response ? e.response.data : e.message); }
}
run();
