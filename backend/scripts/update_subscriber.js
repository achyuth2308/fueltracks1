const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../subscribers/locationSubscriber.js');
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Ensure manualFuelService is imported
if (!content.includes('manualFuelService')) {
  content = content.replace(
    "const FuelEventAggregator = require('../services/fuelEventAggregator');",
    "const FuelEventAggregator = require('../services/fuelEventAggregator');\nconst manualFuelService = require('../modules/fuel/services/manualFuelService');"
  );
}

// 2. Replace 5b. Active Trip Distance Accumulation with Distance & Fuel consumption logic
const oldBlock = `      // 5b. Active Trip Distance Accumulation
      // If this vehicle has an in-progress user-defined trip, accumulate distance in Redis.
      if (isLive && lat && lng && prevState && prevState.lat && prevState.lng) {
        try {
          const activeTripId = await redis.get(\`vehicle:active_trip:\${vehicleId}\`);
          if (activeTripId) {
            const distKm = getHaversineDistance(
              parseFloat(prevState.lat), parseFloat(prevState.lng),
              parseFloat(lat), parseFloat(lng)
            ) / 1000;
            // Same jitter/teleport filters used everywhere else
            if (distKm > 0.01 && distKm < 5) {
              await redis.incrbyfloat(\`trip:dist:\${activeTripId}\`, distKm);
              await redis.incr(\`trip:pts:\${activeTripId}\`);
              const curMax = parseFloat(await redis.get(\`trip:maxspd:\${activeTripId}\`) || '0');
              if ((speed || 0) > curMax) {
                await redis.set(\`trip:maxspd:\${activeTripId}\`, String(speed || 0));
              }
              await redis.incrbyfloat(\`trip:spdsum:\${activeTripId}\`, speed || 0);
            }
          }
        } catch (tripErr) {
          // Non-critical — don't let trip accumulation crash the main location pipeline
          console.error('[SUBSCRIBER] Trip accumulation error:', tripErr.message);
        }
      }`;

const newBlock = `      // 5b. Distance Accumulation & Manual Fuel Consumption Deduction
      if (isLive && lat && lng && prevState && prevState.lat && prevState.lng) {
        try {
          const incDistKm = getHaversineDistance(
            parseFloat(prevState.lat), parseFloat(prevState.lng),
            parseFloat(lat), parseFloat(lng)
          ) / 1000;

          // Reliable incremental movement filter (between 10m and 5km per packet)
          if (incDistKm > 0.01 && incDistKm < 5) {
            // A. User active trip accumulation if vehicle has an ongoing trip
            const activeTripId = await redis.get(\`vehicle:active_trip:\${vehicleId}\`);
            if (activeTripId) {
              await redis.incrbyfloat(\`trip:dist:\${activeTripId}\`, incDistKm);
              await redis.incr(\`trip:pts:\${activeTripId}\`);
              const curMax = parseFloat(await redis.get(\`trip:maxspd:\${activeTripId}\`) || '0');
              if ((speed || 0) > curMax) {
                await redis.set(\`trip:maxspd:\${activeTripId}\`, String(speed || 0));
              }
              await redis.incrbyfloat(\`trip:spdsum:\${activeTripId}\`, speed || 0);
            }

            // B. Manual Fuel Monitoring Deduction (automatic estimation based on mileage)
            // Deduct fuel only when vehicle is moving or engine is on
            if ((speed || 0) > 1 || finalIgnition === true) {
              manualFuelService.deductGpsDistanceFuel(vehicleId, incDistKm, finalOdometer).catch(fuelErr => {
                console.warn(\`[MANUAL-FUEL] Failed GPS fuel deduction for vehicle \${vehicleId}:\`, fuelErr.message);
              });
            }
          }
        } catch (distErr) {
          console.error('[SUBSCRIBER] Distance/Fuel accumulation error:', distErr.message);
        }
      }`;

if (content.includes('// 5b. Active Trip Distance Accumulation')) {
  content = content.replace(oldBlock, newBlock);
  fs.writeFileSync(targetFile, content, 'utf8');
  console.log('SUCCESS: locationSubscriber.js updated.');
} else if (content.includes('// 5b. Distance Accumulation & Manual Fuel Consumption Deduction')) {
  console.log('ALREADY UPDATED: locationSubscriber.js already has the hook.');
} else {
  console.error('ERROR: Could not locate 5b anchor block.');
}
