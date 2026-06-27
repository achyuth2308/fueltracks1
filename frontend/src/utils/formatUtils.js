export const formatSpeed = (speed) => {
  return `${speed || 0} km/h`;
};

export const formatFuel = (fuel) => {
  return `${fuel !== undefined && fuel !== null ? Number(fuel).toFixed(1) : '0.0'} L`;
};

export const formatOdometer = (odo) => {
  if (!odo) return '0 km';
  return `${Number(odo).toLocaleString()} km`;
};

export const formatVoltage = (volt) => {
  return `${volt ? Number(volt).toFixed(2) : '0.00'} V`;
};

export const getBatteryStatus = (voltage, ignition) => {
  if (voltage === undefined || voltage === null || voltage === 0 || voltage === '0') {
    return { value: '--', status: 'Unknown', color: '#9CA3AF' };
  }
  
  const v = Number(voltage);
  const formattedValue = `${v.toFixed(2)} V`;
  
  if (ignition === true) {
    if (v >= 13.2) return { value: formattedValue, status: 'Charging', color: '#10B981' };
    return { value: formattedValue, status: 'Running', color: '#3B82F6' };
  } else {
    if (v >= 12.6) return { value: formattedValue, status: 'Healthy', color: '#10B981' };
    if (v >= 12.2) return { value: formattedValue, status: 'Normal', color: '#3B82F6' };
    if (v >= 12.0) return { value: formattedValue, status: 'Low Battery', color: '#F59E0B' };
    return { value: formattedValue, status: 'Critical', color: '#EF4444' };
  }
};

