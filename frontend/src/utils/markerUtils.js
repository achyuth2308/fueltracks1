import L from 'leaflet';

export const getVehicleType = (vehicle = {}) => {
  const model = (vehicle.model || '').toLowerCase().trim();
  const name = (vehicle.name || '').toLowerCase();

  if (model === 'scooty' || model === 'scooter' || model === 'moped') return 'bike';
  if (model === 'motorcycle' || model === 'bike') return 'bike';
  if (model === 'car') return 'car';
  if (model === 'bus' || model === 'ambulance') return 'bus';
  if (model === 'van' || model === 'pickup') return 'van';
  if (model === 'truck' || model === 'lorry' || model === 'tanker' ||
    model === 'tractor' || model === 'jcb' || model === 'crane' || model === 'borewell') return 'lorry';

  if (model.includes('scooty') || model.includes('scooter') || model.includes('moped')) return 'bike';
  if (model.includes('bike') || model.includes('motorcycle') || name.includes('bike')) return 'bike';
  if (model.includes('car')) return 'car';
  if (model.includes('bus') || name.includes('bus')) return 'bus';
  if (model.includes('van') || name.includes('van')) return 'van';
  return 'lorry';
};

export const getVehicleStatus = (vehicle = {}) => {
  const isOnline = !!vehicle.is_online;
  const speed = vehicle.current_speed || 0;
  const ignition = !!vehicle.current_ignition;

  if (!isOnline) return 'offline';
  if (ignition && speed > 3.0) return 'running';
  if (ignition) return 'idle';
  return 'parked';
};

export const STATUS_CONFIG = {
  running: { color: '#10b981', label: 'Running', pulse: true },
  idle: { color: '#f59e0b', label: 'Idle', pulse: false },
  parked: { color: '#64748B', label: 'Parked', pulse: false },
  offline: { color: '#ef4444', label: 'Offline', pulse: false },
};

// Ultra-bright high-contrast white vehicle SVGs
export const getVehicleSvgContent = (type, color) => {
  switch (type) {
    case 'bike':
      return '<path d="M3 11.5L6.5 5H11.5L13.5 8H17" stroke="#ffffff" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
        '<path d="M6.5 5H11" stroke="#ffffff" stroke-width="2.8" stroke-linecap="round"/>' +
        '<circle cx="3.5" cy="11.5" r="2.5" stroke="#ffffff" stroke-width="2" fill="none"/>' +
        '<circle cx="14.5" cy="11.5" r="2.5" stroke="#ffffff" stroke-width="2" fill="none"/>' +
        '<circle cx="3.5" cy="11.5" r="1" fill="#ffffff"/>' +
        '<circle cx="14.5" cy="11.5" r="1" fill="#ffffff"/>';
    case 'bus':
      return '<rect x="1.5" y="5" width="17" height="8.5" rx="2" fill="#ffffff"/>' +
        '<rect x="3.2" y="6.5" width="2.8" height="2.2" rx="0.5" fill="' + color + '"/>' +
        '<rect x="7" y="6.5" width="2.8" height="2.2" rx="0.5" fill="' + color + '"/>' +
        '<rect x="10.8" y="6.5" width="2.8" height="2.2" rx="0.5" fill="' + color + '"/>' +
        '<rect x="14.6" y="6.5" width="2.4" height="2.2" rx="0.5" fill="' + color + '"/>' +
        '<circle cx="4.8" cy="14" r="1.8" fill="#ffffff"/>' +
        '<circle cx="4.8" cy="14" r="0.7" fill="' + color + '"/>' +
        '<circle cx="15.2" cy="14" r="1.8" fill="#ffffff"/>' +
        '<circle cx="15.2" cy="14" r="0.7" fill="' + color + '"/>';
    case 'van':
      return '<path d="M1.5 6C1.5 5 2.5 4.2 3.5 4.2H12.5L16.5 7.8V12.5H1.5V6Z" fill="#ffffff"/>' +
        '<path d="M10.8 5.5H12.8L15 7.8H10.8V5.5Z" fill="' + color + '"/>' +
        '<circle cx="4.8" cy="13" r="1.8" fill="#ffffff"/>' +
        '<circle cx="4.8" cy="13" r="0.7" fill="' + color + '"/>' +
        '<circle cx="14" cy="13" r="1.8" fill="#ffffff"/>' +
        '<circle cx="14" cy="13" r="0.7" fill="' + color + '"/>';
    case 'lorry':
      return '<path d="M1.5 10.2C1.5 8.2 3.2 6.5 5.5 6.5H11.5V13.8H1.5V10.2Z" fill="#ffffff"/>' +
        '<path d="M12 7.2H15.2L18.2 10.2V13.8H12V7.2Z" fill="#ffffff"/>' +
        '<path d="M13.2 8.2H15.2L16.5 10.2H13.2V8.2Z" fill="' + color + '"/>' +
        '<circle cx="4.8" cy="14.2" r="1.8" fill="#ffffff"/>' +
        '<circle cx="4.8" cy="14.2" r="0.7" fill="' + color + '"/>' +
        '<circle cx="9" cy="14.2" r="1.8" fill="#ffffff"/>' +
        '<circle cx="9" cy="14.2" r="0.7" fill="' + color + '"/>' +
        '<circle cx="15.2" cy="14.2" r="1.8" fill="#ffffff"/>' +
        '<circle cx="15.2" cy="14.2" r="0.7" fill="' + color + '"/>';
    case 'car':
    default:
      return '<path d="M1.5 10.2C1.5 9 2.5 8 3.8 8H6L8.5 5.2C8.8 4.8 9.3 4.5 9.8 4.5H13C13.7 4.5 14.3 4.9 14.6 5.5L16.2 8H17.5C18.8 8 19.8 9 19.8 10.2V12.8H1.5V10.2Z" fill="#ffffff"/>' +
        '<path d="M6.8 8H9.2L7.8 6.2H6L6.8 8Z" fill="' + color + '"/>' +
        '<path d="M10.5 6.2H13.5L14.7 8H10.5V6.2Z" fill="' + color + '"/>' +
        '<circle cx="4.8" cy="13.2" r="1.8" fill="#ffffff"/>' +
        '<circle cx="4.8" cy="13.2" r="0.7" fill="' + color + '"/>' +
        '<circle cx="15.5" cy="13.2" r="1.8" fill="#ffffff"/>' +
        '<circle cx="15.5" cy="13.2" r="0.7" fill="' + color + '"/>';
  }
};

export const createPinIcon = (vehicle, noGps = false, clusterRank = 0, overrideOptions = {}) => {
  const status = overrideOptions.status || getVehicleStatus(vehicle);
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.offline;
  const color = overrideOptions.color || cfg.color;
  const speed = overrideOptions.speed !== undefined ? overrideOptions.speed : Math.round(vehicle.current_speed || 0);
  const type = overrideOptions.type || getVehicleType(vehicle);

  const stemHeight = clusterRank * 14;
  const iconHeight = 32;
  const totalHeight = iconHeight + stemHeight;

  const vehicleSvgContent = getVehicleSvgContent(type, color);

  // Teardrop Pin with crisp white stroke & bright drop shadow on inner vehicle icon
  const pinSvg = '<svg width="26" height="32" viewBox="0 0 26 32" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0px 2px 5px rgba(0,0,0,0.4)); overflow: visible;">' +
    '<path d="M13 0C5.82 0 0 5.82 0 13C0 21.5 13 32 13 32C13 32 26 21.5 26 13C26 5.82 20.18 0 13 0Z" fill="' + color + '" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round"/>' +
    '<g transform="translate(6, 6) scale(0.72)" style="filter: drop-shadow(0px 1px 1.5px rgba(0,0,0,0.3));">' +
    vehicleSvgContent +
    '</g>' +
    '</svg>';

  const pulseCircle = (status === 'running' && cfg.pulse)
    ? '<div style="position:absolute; top:13px; left:13px; transform:translate(-50%, -50%); width:32px; height:32px; border-radius:50%; background-color:' + color + '; opacity:0.3; pointer-events:none; z-index:-1; animation: pulse-ring 2s infinite;"></div>'
    : '';

  const speedBadge = (status === 'running' && speed > 0 && !overrideOptions.hideSpeed)
    ? '<div style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:' + color + ';color:white;font-size:9px;font-weight:800;padding:1px 5px;border-radius:8px;border:1px solid white;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.3);z-index:2;">' + speed + ' km/h</div>'
    : '';

  const stemLine = (clusterRank > 0)
    ? '<div style="width:2px;height:' + stemHeight + 'px;background-color:' + color + ';margin-top:-2px;z-index:0;box-shadow: 1px 0 2px rgba(0,0,0,0.2);"></div>'
    : '';

  const svgHtml = '<div style="position:relative;width:26px;height:' + totalHeight + 'px;display:flex;flex-direction:column;align-items:center;">' +
    '<div class="pin-interactive" style="width:26px;height:32px;position:relative;z-index:1;">' +
    pulseCircle +
    pinSvg +
    speedBadge +
    '</div>' +
    stemLine +
    '</div>';

  return L.divIcon({
    html: svgHtml,
    className: 'custom-marker-icon animated-marker',
    iconSize: [26, totalHeight],
    iconAnchor: [13, clusterRank > 0 ? totalHeight : 32],
    popupAnchor: [0, clusterRank > 0 ? -totalHeight : -32],
  });
};

export const createTeardropIcon = createPinIcon;
