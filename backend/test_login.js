const axios = require('axios');
async function testLogin() {
  try {
    const res = await axios.post('https://api.fueltracks.in/api/auth/login', {
      identifier: 'info@fueltracks.in',
      password: 'wrongpassword'
    });
    console.log(res.data);
  } catch (err) {
    if (err.response) {
      console.log("Status:", err.response.status);
      console.log("Data:", err.response.data);
    } else {
      console.error(err);
    }
  }
}
testLogin();
