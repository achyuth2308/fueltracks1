const axios = require('axios');

async function test() {
  try {
    const res = await axios.post('https://api.fueltracks.in/api/v1/location/live', {
      plates: ["AP39TV7279", "TS07UH4191"]
    }, {
      headers: {
        'X-API-Key': 'ftkn_763d3d4535b110feabda8f81cc93807c8058944054615d352d9503fc7bf723f6',
        'Content-Type': 'application/json'
      }
    });
    console.log("Status:", res.status);
    console.log("Count:", res.data.count);
    console.log("Returned Plates:", res.data.data.map(d => d.vehicleRegistrationNumber));
    console.log("Not Found:", res.data.not_found);
  } catch(e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
test();
