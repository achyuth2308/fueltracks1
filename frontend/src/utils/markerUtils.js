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
        <rect x="7" y="6" width="10" height="1.5" rx="0.5" fill="${color}" />
        <rect x="11" y="2" width="2" height="5" rx="1" fill="#333" />
        <rect x="9.5" y="7" width="5" height="12" rx="2.5" fill="${color}" />
        <rect x="11" y="17" width="2" height="5" rx="1" fill="#333" />
        <rect x="10" y="6" width="4" height="2" rx="0.5" fill="#ffffff" opacity="0.9" />`;
    case 'bus':
      return `
        <rect x="5.5" y="2" width="13" height="20" rx="2" fill="${color}" />
        <path d="M6.5 4C6.5 3.4 7 3 7.5 3H16.5C17 3 17.5 3.4 17.5 4V6H6.5V4Z" fill="#ffffff" opacity="0.9" />
        <rect x="7" y="20.5" width="10" height="1" rx="0.5" fill="#ffffff" opacity="0.9" />
        <rect x="9.5" y="8" width="5" height="3" rx="1" fill="#ffffff" opacity="0.35" />
        <rect x="9.5" y="14" width="5" height="3" rx="1" fill="#ffffff" opacity="0.35" />`;
    case 'van':
      return `
        <rect x="4.5" y="4" width="1" height="2.5" rx="0.5" fill="${color}" />
        <rect x="18.5" y="4" width="1" height="2.5" rx="0.5" fill="${color}" />
        <path d="M6.5 4.5C6.5 3.4 7.4 2.5 8.5 2.5H15.5C16.6 2.5 17.5 3.4 17.5 4.5V7.5H6.5V4.5Z" fill="${color}" />
        <rect x="7.5" y="4" width="9" height="2.5" rx="0.5" fill="#ffffff" opacity="0.9" />
        <rect x="5.5" y="8" width="13" height="13.5" rx="1.5" fill="${color}" />
        <rect x="7" y="9.5" width="10" height="10.5" rx="0.5" fill="#ffffff" opacity="0.25" />`;
    case 'lorry':
      return `
        <path d="M8 2.5C8 1.7 8.7 1 9.5 1H14.5C15.3 1 16 1.7 16 2.5V4.5H8V2.5Z" fill="${color}" />
        <rect x="9" y="2" width="6" height="1.5" rx="0.5" fill="#ffffff" opacity="0.9" />
        <rect x="6.5" y="2" width="1" height="2" rx="0.5" fill="${color}" />
        <rect x="16.5" y="2" width="1" height="2" rx="0.5" fill="${color}" />
        <rect x="11.5" y="4.5" width="1" height="2" fill="${color}" />
        <rect x="6" y="6" width="12" height="17" rx="1" fill="${color}" />
        <line x1="8" y1="6" x2="8" y2="23" stroke="#ffffff" stroke-width="0.75" opacity="0.3" />
        <line x1="12" y1="6" x2="12" y2="23" stroke="#ffffff" stroke-width="0.75" opacity="0.3" />
        <line x1="16" y1="6" x2="16" y2="23" stroke="#ffffff" stroke-width="0.75" opacity="0.3" />`;
    case 'car':
    default:
      return `
        <rect x="4" y="8" width="2" height="3" rx="0.5" fill="${color}" />
        <rect x="18" y="8" width="2" height="3" rx="0.5" fill="${color}" />
        <rect x="6" y="3" width="12" height="18" rx="3.5" fill="${color}" />
        <path d="M7 8L8 6.5H16L17 8V10H7V8Z" fill="#ffffff" opacity="0.9" />
        <path d="M7.5 16H16.5L15.5 17.5H8.5L7.5 16Z" fill="#ffffff" opacity="0.9" />
        <rect x="8" y="10.5" width="8" height="5" rx="0.5" fill="#ffffff" opacity="0.3" />`;
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
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" style="transform: rotate(${course}deg); filter:drop-shadow(0 3px 6px rgba(0,0,0,0.4));">
  ${vehicleSvgContent}
</svg>`;

  const stemHeight = clusterRank * 24;
  const totalHeight = 28 + stemHeight;

  const svgHtml = `
    <div style="position:relative;width:28px;height:${totalHeight}px;display:flex;flex-direction:column;align-items:center;">
      <div class="pin-interactive" style="width:28px;height:28px;position:relative;z-index:1;">
        ${finalSvg}
        ${status === 'running' && speed > 0 && !overrideOptions.hideSpeed ? `<div style="position:absolute;top:-10px;left:0;width:28px;text-align:center;font-size:11px;font-weight:800;color:white;text-shadow:0 1px 3px rgba(0,0,0,0.8);">${speed}</div>` : ''}
      </div>
      ${clusterRank > 0 ? `<div style="width:2px;height:${stemHeight}px;background-color:${color};margin-top:-4px;z-index:0;box-shadow: 1px 0 2px rgba(0,0,0,0.2);"></div>` : ''}
    </div>`;

  return L.divIcon({
    html: svgHtml,
    className: 'custom-marker-icon',
    iconSize: [28, totalHeight],
    iconAnchor: [14, clusterRank > 0 ? totalHeight : 14],
    popupAnchor: [0, clusterRank > 0 ? -totalHeight : -14],
  });
};
