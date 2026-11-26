const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../subscribers/locationSubscriber.js');
let content = fs.readFileSync(targetFile, 'utf8');

// Normalize line breaks temporarily to search and replace safely
const isCrlf = content.includes('\r\n');
const normalized = content.replace(/\r\n/g, '\n');

const searchBlock = `      // 5b. Active Trip Distance Accumulation
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

const replaceBlock = `      // 5b. Distance Accumulation & Manual Fuel Consumption Deduction
      if (isLive && lat && lng && prevState && prevState.lat && prevState.lng) {
        try {
          const incDistKm = getHaversineDistance(
            parseFloat(prevState.lat), parseFloat(prevState.lng),
            parseFloat(lat), parseFloat(lng)
          ) / 1000;

          // Reliable incremental movement filter (between 5m and 5km per packet)
          if (incDistKm > 0.005 && incDistKm < 5) {
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
            // Deduct fuel when vehicle is moving or engine is on
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

if (!normalized.includes(searchBlock)) {
  console.error('ERROR: searchBlock not found in normalized content!');
  process.exit(1);
}

let patched = normalized.replace(searchBlock, replaceBlock);
if (isCrlf) {
  patched = patched.replace(/\n/g, '\r\n');
}

fs.writeFileSync(targetFile, patched, 'utf8');
console.log('SUCCESS: Patched locationSubscriber.js cleanly!');
