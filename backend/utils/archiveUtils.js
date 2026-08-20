const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Returns the S3 Key path for a given date and vehicle
 * Format: fueltracks-archive/2026/08-August/week-3/17/<vehicle_id>.json.gz
 */
function getS3KeyForDateAndVehicle(dateObj, vehicleId) {
  const year = dateObj.getUTCFullYear();
  const monthNum = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const monthName = monthNames[dateObj.getUTCMonth()];
  
  const day = dateObj.getUTCDate();
  const dayStr = String(day).padStart(2, '0');
  
  // Week 1: 1-7, Week 2: 8-14, Week 3: 15-21, Week 4: 22-28, Week 5: 29-31
  let week = Math.ceil(day / 7);
  
  return `fueltracks-archive/${year}/${monthNum}-${monthName}/week-${week}/${dayStr}/${vehicleId}.json.gz`;
}

/**
 * Given a start date and end date, returns an array of all S3 keys that need to be fetched.
 * Handles boundary crossing (month-end, year-end, etc) seamlessly.
 */
function getKeysForDateRange(startDate, endDate, vehicleId) {
  const keys = [];
  let current = new Date(startDate);
  current.setUTCHours(0, 0, 0, 0); // Start at beginning of the first day
  
  const end = new Date(endDate);
  end.setUTCHours(0, 0, 0, 0); // Normalize end date too
  
  while (current <= end) {
    keys.push(getS3KeyForDateAndVehicle(current, vehicleId));
    // Add one day (in UTC to avoid daylight saving issues)
    current.setUTCDate(current.getUTCDate() + 1);
  }
  
  return keys;
}

module.exports = {
  getS3KeyForDateAndVehicle,
  getKeysForDateRange
};
