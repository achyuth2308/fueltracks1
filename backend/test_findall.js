const db = require('./config/db');
const VehicleModel = require('./models/vehicleModel');

async function test() {
  try {
    const result = await VehicleModel.findAll('8833df78-a912-47d3-b136-9ec0a218e091', 'superadmin', {
      limit: 10000
    });
    console.log("Superadmin total vehicles fetched:", result.vehicles.length);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
test();
