const axios = require('axios');

async function test() {
  try {
    const res = await axios.get('http://localhost:5000/api/v1/vehicles', {
      headers: {
        'X-API-Key': 'ftkn_763d3d4535b110feabda8f81cc93807c8058944054615d352d9503fc7bf723f6',
        'Content-Type': 'application/json'
      }
    });
    console.log("Status:", res.status);
    console.log("Count:", res.data.count);
  } catch(e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
test();
