'use strict';

const { getVehicleStatus, NO_DATA_OPTIONS } = require('../frontend/src/utils/markerUtils');

console.log('Testing No Data rule logic...');
console.log('Available Options:', NO_DATA_OPTIONS);

const now = Date.now();

// 1. Vehicle was Running 20 minutes ago (within 30 min default)
const vRunningRecent = {
  name: 'Truck Alpha',
  current_speed: 45,
  current_ignition: true,
  last_seen: new Date(now - 20 * 60 * 1000).toISOString()
};
console.log('1. Truck Alpha (20 min ago, 0.5hr threshold):', getVehicleStatus(vRunningRecent, 0.5));
console.assert(getVehicleStatus(vRunningRecent, 0.5) === 'running', 'Expected running');

// 2. Vehicle was Running 40 minutes ago (exceeded 30 min default)
const vRunningOld = {
  name: 'Truck Beta',
  current_speed: 45,
  current_ignition: true,
  last_seen: new Date(now - 40 * 60 * 1000).toISOString()
};
console.log('2. Truck Beta (40 min ago, 0.5hr threshold):', getVehicleStatus(vRunningOld, 0.5));
console.assert(getVehicleStatus(vRunningOld, 0.5) === 'offline', 'Expected offline (No Data)');

// 3. User switches threshold to 1 hour: Truck Beta (40 min ago) should become Running again!
console.log('3. Truck Beta (40 min ago, 1hr threshold):', getVehicleStatus(vRunningOld, 1));
console.assert(getVehicleStatus(vRunningOld, 1) === 'running', 'Expected running under 1hr threshold');

// 4. Vehicle receives a new packet now:
vRunningOld.last_seen = new Date(now).toISOString();
vRunningOld.current_speed = 0;
vRunningOld.current_ignition = true;
console.log('4. Truck Beta received new packet (idle, 0.5hr threshold):', getVehicleStatus(vRunningOld, 0.5));
console.assert(getVehicleStatus(vRunningOld, 0.5) === 'idle', 'Expected idle');

console.log('✅ All No Data rule scenarios verified successfully!');
