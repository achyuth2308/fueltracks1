export const formatSpeed = (speed) => {
  return `${speed || 0} km/h`;
};

export const formatFuel = (fuel) => {
  return `${fuel !== undefined && fuel !== null ? Number(fuel).toFixed(1) : '0.0'}%`;
};

export const formatOdometer = (odo) => {
  if (!odo) return '0 km';
  return `${Number(odo).toLocaleString()} km`;
};

export const formatVoltage = (volt) => {
  return `${volt ? Number(volt).toFixed(2) : '0.00'} V`;
};
