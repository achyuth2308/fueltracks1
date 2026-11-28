import React, { useMemo } from 'react';
import { hasPhysicalFuelSensor } from '../../utils/licenseUtils';

/**
 * VehicleLiveGaugesOverlay
 * Exact replica of the legacy fueltracks.online telematics gauge overlay.
 * 
 * Rules:
 * - 100% dynamic: Tank size, speed, fuel level, and estimated distance are computed per vehicle.
 * - If vehicle has NO fuel sensor: Render ONLY the Speedometer gauge.
 * - If vehicle HAS fuel sensor: Render BOTH Speedometer AND Fuel Gauge side-by-side.
 */
const VehicleLiveGaugesOverlay = ({ vehicle, style = {}, onClose }) => {
  if (!vehicle) return null;

  // Safely parse metadata if stored as JSON string
  const meta = useMemo(() => {
    if (!vehicle.metadata) return {};
    if (typeof vehicle.metadata === 'string') {
      try { return JSON.parse(vehicle.metadata); } catch (_) { return {}; }
    }
    return vehicle.metadata;
  }, [vehicle.metadata]);

  // 1. Live Speed (0 if vehicle is offline / has no data)
  const isOnline = vehicle.is_online !== undefined ? Boolean(vehicle.is_online) : true;
  const rawSpeed = isOnline
    ? (vehicle.current_speed !== undefined && vehicle.current_speed !== null
        ? Number(vehicle.current_speed)
        : (vehicle.speed !== undefined && vehicle.speed !== null ? Number(vehicle.speed) : 0))
    : 0;
  const speed = Math.max(0, Math.round(rawSpeed || 0));

  // 2. Dynamic Tank Capacity
  // Dynamically resolves tank size for this specific vehicle from:
  // - vehicle.tank_capacity
  // - meta.fuelCalibration.tanks (sum of multi-tank configurations)
  // - meta.tankSize / meta.tankCapacity / meta.fuelConfig.tankSize
  // - max volume from calibrationPoints
  const tankCapacity = useMemo(() => {
    // 1. Direct field on vehicle object
    const directCap = Number(vehicle.tank_capacity);
    if (!isNaN(directCap) && directCap > 0) return Math.round(directCap);

    // 2. Multi-tank configuration in fuelCalibration.tanks
    const fuelCal = meta.fuelCalibration || {};
    if (fuelCal.tanks && typeof fuelCal.tanks === 'object') {
      const tankValues = Object.values(fuelCal.tanks);
      const totalMultiTank = tankValues.reduce((sum, t) => {
        const sz = parseFloat(t?.tankSize || t?.capacity || 0);
        return sum + (isNaN(sz) ? 0 : sz);
      }, 0);
      if (totalMultiTank > 0) return Math.round(totalMultiTank);
    }

    // 3. Single tank size candidates
    const candidates = [
      fuelCal.tankSize,
      meta.tankSize,
      meta.tankCapacity,
      meta.fuelConfig?.tankSize,
      meta.fuelConfig?.capacity
    ];
    for (const val of candidates) {
      const parsed = parseFloat(val);
      if (!isNaN(parsed) && parsed > 0) {
        return Math.round(parsed);
      }
    }

    // 4. Max volume from calibration points table
    const points = fuelCal.calibrationPoints || meta.fuelConfig?.calibration;
    if (Array.isArray(points) && points.length > 0) {
      const maxPoint = points.reduce((max, p) => {
        const lit = parseFloat(p.liters || p.fuel || p.volume || 0);
        return !isNaN(lit) && lit > max ? lit : max;
      }, 0);
      if (maxPoint > 0) return Math.round(maxPoint);
    }

    return 0;
  }, [vehicle, meta]);

  // 3. Current Fuel in Liters
  const rawFuel = vehicle.current_fuel !== undefined && vehicle.current_fuel !== null
    ? Number(vehicle.current_fuel)
    : (vehicle.fuel !== undefined && vehicle.fuel !== null ? Number(vehicle.fuel) : 0);
  const currentFuel = Math.max(0, Math.round(rawFuel * 10) / 10);

  // Effective tank capacity ensures gauge handles overfill or calibration nuances
  const effectiveTankSize = useMemo(() => {
    if (tankCapacity > 0) {
      return Math.max(tankCapacity, Math.ceil(currentFuel));
    }
    return Math.ceil(currentFuel) || 100;
  }, [tankCapacity, currentFuel]);

  // 4. Strict Fuel Sensor Check
  const hasFuelSensor = useMemo(() => {
    if (!vehicle) return false;

    // Explicit overrides
    if (vehicle.fuel_sensor === false || vehicle.has_fuel_sensor === false) return false;
    if (vehicle.fuel_sensor === true || vehicle.has_fuel_sensor === true) return true;

    // Any dynamic tank capacity configured > 0
    if (tankCapacity > 0) return true;

    // Physical fuel sensor serial number
    if (meta.sensorNo && String(meta.sensorNo).trim() !== '' && String(meta.sensorNo).trim() !== '0') {
      return true;
    }

    // Fuel calibration points
    if (meta.fuelCalibration && typeof meta.fuelCalibration === 'object' && Object.keys(meta.fuelCalibration).length > 0) {
      return true;
    }
    if (meta.fuelConfig?.calibration && Array.isArray(meta.fuelConfig.calibration) && meta.fuelConfig.calibration.length > 0) {
      return true;
    }

    // Licence prefix for fuel telematics hardware
    if (vehicle.licenceId && (vehicle.licenceId.startsWith('AD') || vehicle.licenceId.startsWith('EN'))) {
      return true;
    }

    return false;
  }, [vehicle, tankCapacity, meta]);

  // 4b. Strict Manual Fuel Check
  const isManualFuel = useMemo(() => {
    if (!vehicle) return false;
    return Boolean(
      vehicle.is_manual_fuel ||
      vehicle.manual_tank_capacity ||
      (!hasPhysicalFuelSensor(vehicle) && (currentFuel > 0 || vehicle.current_fuel != null))
    );
  }, [vehicle, currentFuel]);

  // 4c. Fuel Used (Consumption)
  const fuelUsed = useMemo(() => {
    if (!vehicle) return 0;
    const mileage = parseFloat(vehicle.manual_mileage || meta.expectedMileage || vehicle.expected_mileage) || 8.0;
    if (vehicle.manual_fuel_consumed !== undefined && vehicle.manual_fuel_consumed !== null && Number(vehicle.manual_fuel_consumed) > 0) {
      return Number(vehicle.manual_fuel_consumed);
    }
    const dist = Number(vehicle.today_distance || 0);
    return dist > 0 && mileage > 0 ? (dist / mileage) : 0;
  }, [vehicle, meta]);

  // 5. Estimated Distance Calculation (Dynamically uses this vehicle's expectedMileage)
  const estimatedKm = useMemo(() => {
    if (vehicle.manual_estimated_range !== undefined && vehicle.manual_estimated_range !== null && Number(vehicle.manual_estimated_range) > 0) {
      return Number(vehicle.manual_estimated_range).toFixed(1);
    }
    const mileage = parseFloat(vehicle.manual_mileage || meta.expectedMileage || vehicle.expected_mileage) || 4.0;
    return (currentFuel * mileage).toFixed(1);
  }, [meta, vehicle, currentFuel]);

  // 6. Speedometer Geometry (Compact & Space-Optimized to prevent collisions)
  const cx = 82.5;
  const cy = 76;
  const radius = 56;
  const trackWidth = 12;
  const outerArcRadius = 66; // 1px outer gray arc line
  const maxDisplaySpeed = 200;
  const clampedSpeed = Math.min(maxDisplaySpeed, speed);

  // Needle with counter-balance tail
  const needleRad = (clampedSpeed / maxDisplaySpeed) * Math.PI;
  const needleLength = 48;
  const needleTipX = cx - needleLength * Math.cos(needleRad);
  const needleTipY = cy - needleLength * Math.sin(needleRad);
  const tailLength = 8;
  const needleTailX = cx + tailLength * Math.cos(needleRad);
  const needleTailY = cy + tailLength * Math.sin(needleRad);

  // Fuel Progress (radius = 56, length = PI * 56 ≈ 175.93)
  const totalArc = Math.PI * radius;
  const fuelRatio = effectiveTankSize > 0 ? Math.min(1, Math.max(0, currentFuel / effectiveTankSize)) : 0;
  const fuelDashOffset = totalArc * (1 - fuelRatio);

  // Small vertical / radial tick lines like a real speedometer dial
  const speedTicks = useMemo(() => {
    const items = [];
    for (let s = 0; s <= 200; s += 10) {
      const angle = (s / 200) * Math.PI;
      const isMajor = s % 50 === 0;
      const isMedium = s % 20 === 0;

      // Outer ticks touching the 1px gray arc line
      const outerR = outerArcRadius;
      const innerR = isMajor ? (outerR - 4) : (isMedium ? (outerR - 3) : (outerR - 2));
      items.push({
        x1: cx - innerR * Math.cos(angle),
        y1: cy - innerR * Math.sin(angle),
        x2: cx - outerR * Math.cos(angle),
        y2: cy - outerR * Math.sin(angle),
        strokeWidth: isMajor ? 1.5 : 1,
        color: isMajor ? '#475569' : '#94A3B8'
      });

      // Inner ticks along the bottom edge of the colored ribbon
      const ribbonInner = radius - trackWidth / 2; // 50
      const tickInner = isMajor ? 45 : (isMedium ? 47 : 48);
      items.push({
        x1: cx - ribbonInner * Math.cos(angle),
        y1: cy - ribbonInner * Math.sin(angle),
        x2: cx - tickInner * Math.cos(angle),
        y2: cy - tickInner * Math.sin(angle),
        strokeWidth: isMajor ? 1.5 : 1,
        color: isMajor ? '#334155' : '#64748B'
      });
    }
    return items;
  }, [cx, cy, radius, trackWidth, outerArcRadius]);

  const displayTankSize = tankCapacity > 0 ? tankCapacity : effectiveTankSize;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '0px',
        left: '20px',
        zIndex: 1000,
        background: 'rgba(255, 255, 255, 0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: '10px 10px 0 0',
        border: '1px solid rgba(255, 255, 255, 0.75)',
        borderBottom: 'none',
        borderTop: '3px solid #00BCD4',
        padding: '8px 12px 4px 12px',
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.1)',
        display: 'inline-flex',
        alignItems: 'flex-start',
        gap: '12px',
        userSelect: 'none',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        pointerEvents: 'auto',
        transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1), bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        ...style
      }}
    >
      {/* Optional Close Button for Meters */}
      {onClose && (
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '5px',
            right: '6px',
            background: 'rgba(255, 255, 255, 0.65)',
            border: 'none',
            borderRadius: '50%',
            width: '18px',
            height: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#64748B',
            fontSize: '10px',
            fontWeight: 700,
            lineHeight: 1,
            padding: 0,
            transition: 'all 0.15s ease',
            zIndex: 10
          }}
          title="Close Gauges"
          onMouseEnter={(e) => { e.currentTarget.style.color = '#0F172A'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#64748B'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.65)'; }}
        >
          ✕
        </button>
      )}
      {/* ─── 1. SPEEDOMETER GAUGE ─── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '165px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
          Speed - {vehicle.last_seen ? `${speed} Km/h` : 'N/A'}
        </div>

        <svg width="165" height="92" viewBox="0 0 165 92">
          {/* Outer 1px Gray Arc Line */}
          <path
            d={`M ${cx - outerArcRadius},${cy} A ${outerArcRadius},${outerArcRadius} 0 0,1 ${cx + outerArcRadius},${cy}`}
            fill="none"
            stroke="#94A3B8"
            strokeWidth="1"
          />

          {/* Green Segment (0 - 100 km/h: 50% of arc) */}
          <path
            d={`M ${cx - radius},${cy} A ${radius},${radius} 0 0,1 ${cx},${cy - radius}`}
            fill="none"
            stroke="#22C55E"
            strokeWidth={trackWidth}
          />
          {/* Yellow Segment (100 - 150 km/h: 25% of arc - pure bright yellow) */}
          <path
            d={`M ${cx},${cy - radius} A ${radius},${radius} 0 0,1 ${cx + radius * 0.7071},${cy - radius * 0.7071}`}
            fill="none"
            stroke="#FACC15"
            strokeWidth={trackWidth}
          />
          {/* Red Segment (150 - 200 km/h: 25% of arc) */}
          <path
            d={`M ${cx + radius * 0.7071},${cy - radius * 0.7071} A ${radius},${radius} 0 0,1 ${cx + radius},${cy}`}
            fill="none"
            stroke="#EF4444"
            strokeWidth={trackWidth}
          />

          {/* Small Vertical / Radial Tick Lines like real speedometer */}
          {speedTicks.map((t, idx) => (
            <line
              key={idx}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={t.color}
              strokeWidth={t.strokeWidth}
            />
          ))}

          {/* Horizontal Baseline connecting outer arc ends */}
          <line
            x1={cx - outerArcRadius}
            y1={cy}
            x2={cx + outerArcRadius}
            y2={cy}
            stroke="#94A3B8"
            strokeWidth="1"
          />

          {/* Scale Labels */}
          <text x="30" y="72" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#334155">0</text>
          <text x="50" y="48" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#334155">50</text>
          <text x="82.5" y="38" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#334155">100</text>
          <text x="115" y="48" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#334155">150</text>
          <text x="135" y="72" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#334155">200</text>

          {/* Needle Pointer with Tail */}
          <line
            x1={needleTailX}
            y1={needleTailY}
            x2={needleTipX}
            y2={needleTipY}
            stroke="#0F172A"
            strokeWidth="2.5"
            strokeLinecap="round"
            style={{ transition: 'x2 0.35s ease-out, y2 0.35s ease-out' }}
          />

          {/* Base Pivot Knob */}
          <circle cx={cx} cy={cy} r="5" fill="#0F172A" stroke="#FFFFFF" strokeWidth="1.5" />
          <circle cx={cx} cy={cy} r="2" fill="#FFFFFF" />
        </svg>
      </div>

      {/* ─── 2. FUEL GAUGE (Only if vehicle HAS a fuel sensor) ─── */}
      {hasFuelSensor && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '165px',
            borderLeft: '1px solid rgba(148, 163, 184, 0.35)',
            paddingLeft: '12px'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
            Tank Size - {displayTankSize} Ltr
          </div>

          <div style={{ position: 'relative', width: '165px', height: '92px' }}>
            <svg width="165" height="92" viewBox="0 0 165 92">
              {/* Outer 1px Gray Arc Line */}
              <path
                d={`M ${cx - outerArcRadius},${cy} A ${outerArcRadius},${outerArcRadius} 0 0,1 ${cx + outerArcRadius},${cy}`}
                fill="none"
                stroke="#94A3B8"
                strokeWidth="1"
              />

              {/* Background Gray Arc */}
              <path
                d={`M ${cx - radius},${cy} A ${radius},${radius} 0 0,1 ${cx + radius},${cy}`}
                fill="none"
                stroke="rgba(203, 213, 225, 0.75)"
                strokeWidth={trackWidth}
              />
              {/* Green Filled Progress Arc */}
              <path
                d={`M ${cx - radius},${cy} A ${radius},${radius} 0 0,1 ${cx + radius},${cy}`}
                fill="none"
                stroke="#84CC16"
                strokeWidth={trackWidth}
                strokeDasharray={totalArc}
                strokeDashoffset={fuelDashOffset}
                style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
              />

              {/* Horizontal Baseline */}
              <line
                x1={cx - outerArcRadius}
                y1={cy}
                x2={cx + outerArcRadius}
                y2={cy}
                stroke="#94A3B8"
                strokeWidth="1"
              />

              {/* Centered Fuel Liters Text inside Gauge */}
              <text
                x={cx}
                y={cy - 8}
                textAnchor="middle"
                fontSize={isManualFuel ? "10" : "11.5"}
                fontWeight="700"
                fill="#0F172A"
              >
                {isManualFuel ? 'Non-Sensor Fuel' : 'Fuel'} - {Math.round(currentFuel)} Ltr
              </text>
            </svg>
          </div>

          {/* Metrics below gauge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isManualFuel ? '12px' : '0px', marginTop: '-2px', width: '100%' }}>
            {isManualFuel && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '9px', fontWeight: 600, color: '#64748B', letterSpacing: '0.02em' }}>
                  Fuel Used
                </div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#EA580C', marginTop: '1px' }}>
                  {fuelUsed.toFixed(1)} L
                </div>
              </div>
            )}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '9px', fontWeight: 600, color: '#64748B', letterSpacing: '0.02em' }}>
                Range
              </div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#0F172A', marginTop: '1px' }}>
                {estimatedKm} Km
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VehicleLiveGaugesOverlay;
