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
  if (vehicle.is_online === false) return 'offline';
  if ((vehicle.current_speed || 0) > 0) return 'running';
  if (vehicle.current_ignition) return 'idle';
  return 'parked';
};

export const STATUS_CONFIG = {
  running: { color: '#16a34a', label: 'Running', pulse: true },
  idle: { color: '#eab308', label: 'Idle', pulse: false },
  parked: { color: '#f97316', label: 'Parked', pulse: false },
  offline: { color: '#ef4444', label: 'Offline', pulse: false },
};

export const getVehicleSvgContent = (type, color) => {
  switch (type) {
    case 'bike':
      return `
        <rect x="6" y="5" width="12" height="2" rx="1" fill="${color}" stroke="#ffffff" stroke-width="1" />
        <rect x="11" y="2" width="2" height="6" rx="1" fill="#333" />
        <rect x="9" y="6" width="6" height="14" rx="3" fill="${color}" stroke="#ffffff" stroke-width="1.5" />
        <rect x="11" y="18" width="2" height="5" rx="1" fill="#333" />
        <rect x="10" y="5" width="4" height="2" rx="1" fill="#ffffff" opacity="0.9" />`;
    case 'bus':
      return `
        <rect x="4.5" y="2" width="15" height="20" rx="2.5" fill="${color}" stroke="#ffffff" stroke-width="1.5" />
        <path d="M5.5 4C5.5 3.4 6 3 6.5 3H17.5C18 3 18.5 3.4 18.5 4V6H5.5V4Z" fill="#ffffff" opacity="0.9" />
        <rect x="6" y="20.5" width="12" height="1" rx="0.5" fill="#ffffff" opacity="0.9" />
        <rect x="9.5" y="8" width="5" height="3" rx="1" fill="#ffffff" opacity="0.35" />
        <rect x="9.5" y="14" width="5" height="3" rx="1" fill="#ffffff" opacity="0.35" />`;
    case 'van':
      return `
        <rect x="3.5" y="4" width="2" height="3" rx="1" fill="${color}" />
        <rect x="18.5" y="4" width="2" height="3" rx="1" fill="${color}" />
        <path d="M5.5 4C5.5 3 6.5 2 7.5 2H16.5C17.5 2 18.5 3 18.5 4V7H5.5V4Z" fill="${color}" stroke="#ffffff" stroke-width="1.5" />
        <rect x="6.5" y="3.5" width="11" height="3" rx="1" fill="#ffffff" opacity="0.9" />
        <rect x="4.5" y="7" width="15" height="15" rx="2" fill="${color}" stroke="#ffffff" stroke-width="1.5" />
        <rect x="6" y="9" width="12" height="11" rx="1" fill="#ffffff" opacity="0.25" />`;
    case 'lorry':
      return `
        <path d="M7 2.5C7 1.7 7.7 1 8.5 1H15.5C16.3 1 17 1.7 17 2.5V5H7V2.5Z" fill="${color}" stroke="#ffffff" stroke-width="1.5" />
        <rect x="8" y="2.5" width="8" height="2" rx="0.5" fill="#ffffff" opacity="0.9" />
        <rect x="5.5" y="2.5" width="1.5" height="2.5" rx="0.5" fill="${color}" />
        <rect x="17" y="2.5" width="1.5" height="2.5" rx="0.5" fill="${color}" />
        <rect x="5" y="6" width="14" height="17" rx="1.5" fill="${color}" stroke="#ffffff" stroke-width="1.5" />
        <line x1="8" y1="6" x2="8" y2="23" stroke="#ffffff" stroke-width="1" opacity="0.4" />
        <line x1="12" y1="6" x2="12" y2="23" stroke="#ffffff" stroke-width="1" opacity="0.4" />
        <line x1="16" y1="6" x2="16" y2="23" stroke="#ffffff" stroke-width="1" opacity="0.4" />`;
    case 'car':
    default:
      return `
        <rect x="3.5" y="8" width="2" height="3.5" rx="1" fill="${color}" />
        <rect x="18.5" y="8" width="2" height="3.5" rx="1" fill="${color}" />
        <rect x="5" y="2.5" width="14" height="19" rx="4.5" fill="${color}" stroke="#ffffff" stroke-width="1.5" />
        <path d="M6.5 8L7.5 6H16.5L17.5 8V10.5H6.5V8Z" fill="#ffffff" opacity="0.9" />
        <path d="M7 16H17L16 18H8L7 16Z" fill="#ffffff" opacity="0.9" />
        <rect x="7.5" y="11.5" width="9" height="4" rx="1" fill="#ffffff" opacity="0.3" />`;
  }
};

export const createPinIcon = (vehicle, noGps = false, clusterRank = 0, overrideOptions = {}) => {
  const status = overrideOptions.status || getVehicleStatus(vehicle);
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.offline;
  const color = overrideOptions.color || cfg.color;
  const course = overrideOptions.course !== undefined ? overrideOptions.course : (vehicle.course || vehicle.heading || 0);
  const speed = overrideOptions.speed !== undefined ? overrideOptions.speed : Math.round(vehicle.current_speed || 0);
  const type = overrideOptions.type || getVehicleType(vehicle);

  const vehicleSvgContent = getVehicleSvgContent(type, color);

  const finalSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" style="transform: rotate(${course}deg); filter:drop-shadow(0 3px 6px rgba(0,0,0,0.4));">
  ${vehicleSvgContent}
</svg>`;

  const stemHeight = clusterRank * 24;
  const totalHeight = 36 + stemHeight;

  const svgHtml = `
    <div style="position:relative;width:36px;height:${totalHeight}px;display:flex;flex-direction:column;align-items:center;">
      <div class="pin-interactive" style="width:36px;height:36px;position:relative;z-index:1;">
        ${finalSvg}
        ${status === 'running' && speed > 0 && !overrideOptions.hideSpeed ? `<div style="position:absolute;top:-10px;left:0;width:36px;text-align:center;font-size:11px;font-weight:800;color:white;text-shadow:0 1px 3px rgba(0,0,0,0.8);">${speed}</div>` : ''}
      </div>
      ${clusterRank > 0 ? `<div style="width:2px;height:${stemHeight}px;background-color:${color};margin-top:-4px;z-index:0;box-shadow: 1px 0 2px rgba(0,0,0,0.2);"></div>` : ''}
    </div>`;

  return L.divIcon({
    html: svgHtml,
    className: 'custom-marker-icon',
    iconSize: [36, totalHeight],
    iconAnchor: [18, clusterRank > 0 ? totalHeight : 18],
    popupAnchor: [0, clusterRank > 0 ? -totalHeight : -18],
  });
};
