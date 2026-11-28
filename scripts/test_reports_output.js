const { Pool } = require('pg');
require('dotenv').config({ path: 'fueltracks1/.env' });

const reportService = require('../backend/modules/reports/services/reportService');
const reportRepository = require('../backend/modules/reports/repositories/reportRepository');

async function testReports() {
  console.log('--- Testing Consolidated Report for THENDRALMANI ---');
  const userId = '687951dd-9d04-4931-9976-4f0ac7bf27cc';
  
  const now = new Date();
  const start = new Date(now.getTime() - 36 * 3600 * 1000);
  const end = now;

  const result = await reportService.getConsolidatedReport(null, 'customer', userId, start, end, null, null);
  console.log(`Vehicles in consolidated report: ${result.length}`);
  
  for (const v of result) {
    console.log(`\n========================================`);
    console.log(`Vehicle: ${v.vehicle_name} (${v.plate || v.vehicle_id})`);
    console.log(`Distance: ${v.distance_travelled} km`);
    console.log(`Moving Time: ${Math.round(v.running_seconds / 60)} min`);
    console.log(`Idle Time: ${Math.round(v.idle_seconds / 60)} min`);
    console.log(`Parked Time: ${Math.round(v.stopped_seconds / 60)} min`);
    console.log(`Max Speed: ${v.max_speed} km/h | Avg Speed: ${v.avg_speed} km/h`);
    console.log(`Start Fuel: ${v.start_fuel} L | End Fuel: ${v.end_fuel} L`);
    console.log(`Refill: ${v.total_refill} L | Theft: ${v.total_theft} L | Consumption: ${v.consumption} L`);
    console.log(`Mileage (KMPL): ${v.kmpl}`);
    console.log(`Total Intervals count: ${v.intervals ? v.intervals.length : 0}`);

    if (v.intervals && v.intervals.length > 0) {
      const counts = {};
      v.intervals.forEach(it => { counts[it.status] = (counts[it.status] || 0) + 1; });
      console.log(`Interval breakdown:`, counts);
    }
  }

  process.exit(0);
}

testReports().catch(err => {
  console.error(err);
  process.exit(1);
});
