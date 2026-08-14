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
  if (speed > 2.0) return 'running';
  if (ignition) return 'idle';
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
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40" style="transform: rotate(${course}deg); filter:drop-shadow(0 3px 6px rgba(0,0,0,0.4));">
  ${vehicleSvgContent}
</svg>`;

  const stemHeight = clusterRank * 24;
  const totalHeight = 40 + stemHeight;

  const svgHtml = `
    <div style="position:relative;width:40px;height:${totalHeight}px;display:flex;flex-direction:column;align-items:center;">
      <div class="pin-interactive" style="width:40px;height:40px;position:relative;z-index:1;">
        <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); width:52px; height:52px; border-radius:50%; background-color:${color}; opacity:0.15; border: 2px solid ${color}; z-index:-1; pointer-events:none; ${cfg.pulse ? 'animation: pulse-ring 2s infinite;' : ''}"></div>
        ${finalSvg}
        ${status === 'running' && speed > 0 && !overrideOptions.hideSpeed ? `<div style="position:absolute;top:-10px;left:0;width:40px;text-align:center;font-size:11px;font-weight:800;color:white;text-shadow:0 1px 3px rgba(0,0,0,0.8);">${speed}</div>` : ''}
      </div>
      ${clusterRank > 0 ? `<div style="width:2px;height:${stemHeight}px;background-color:${color};margin-top:-4px;z-index:0;box-shadow: 1px 0 2px rgba(0,0,0,0.2);"></div>` : ''}
    </div>`;

  return L.divIcon({
    html: svgHtml,
    className: 'custom-marker-icon',
    iconSize: [40, totalHeight],
    iconAnchor: [20, clusterRank > 0 ? totalHeight : 20],
    popupAnchor: [0, clusterRank > 0 ? -totalHeight : -20],
  });
};

export const createTeardropIcon = (vehicle, noGps = false, clusterRank = 0) => {
  const status = getVehicleStatus(vehicle);
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.offline;
  const color = cfg.color;

  const stemHeight = clusterRank * 20;
  const iconHeight = 40;
  const totalHeight = iconHeight + stemHeight;

  // Modern Teardrop SVG Pin
  const pinSvg = `
    <svg width="32" height="40" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0px 3px 4px rgba(0,0,0,0.4));">
      <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="${color}" stroke="#ffffff" stroke-width="2"/>
      <circle cx="14" cy="14" r="6" fill="#ffffff" opacity="0.9"/>
    </svg>
  `;

  const svgHtml = `
    <div style="position:relative;width:32px;height:${totalHeight}px;display:flex;flex-direction:column;align-items:center;">
      <div style="width:32px;height:40px;position:relative;z-index:1;">
        <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); width:44px; height:44px; border-radius:50%; background-color:${color}; opacity:0.15; border: 2px solid ${color}; z-index:-1; pointer-events:none; ${cfg.pulse ? 'animation: pulse-ring 2s infinite;' : ''}"></div>
        ${pinSvg}
      </div>
      ${clusterRank > 0 ? `<div style="width:2px;height:${stemHeight}px;background-color:${color};margin-top:-4px;z-index:0;box-shadow: 1px 0 2px rgba(0,0,0,0.2);"></div>` : ''}
    </div>`;

  return L.divIcon({
    html: svgHtml,
    className: 'custom-teardrop-icon',
    iconSize: [32, totalHeight],
    iconAnchor: [16, clusterRank > 0 ? totalHeight : 40],
    popupAnchor: [0, clusterRank > 0 ? -totalHeight : -40],
  });
};
