const VehicleModel = require('./models/vehicleModel');

async function test() {
  try {
    const result = await VehicleModel.findAll('3c5f6cf3-e956-4971-840c-40fbb1be4ed5', 'superadmin', { page: 1, limit: 10000, search: '4576' });
    console.log(result.vehicles);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
test();
