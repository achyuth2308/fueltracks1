import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Key, Navigation, Fuel, Clock, ArrowRight, Wifi, WifiOff } from 'lucide-react';
import { formatSpeed } from '../../utils/formatUtils';
import { getRelativeTime } from '../../utils/dateUtils';

const FuelMini = ({ pct = 0 }) => {
  const color = pct > 40 ? '#16a34a' : pct > 15 ? '#f97316' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <Fuel size={10} color={color} />
      <div style={{ flex: 1, height: '4px', background: '#f3f4f6', borderRadius: '99px', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: '100%', background: color, borderRadius: '99px', transition: 'width 0.5s ease' }} />
      </div>
      <span style={{ fontSize: '9px', fontWeight: 600, color, fontFamily: 'JetBrains Mono, monospace', minWidth: '26px' }}>
        {Number(pct).toFixed(0)}%
      </span>
    </div>
  );
};

const VehicleCard = ({ vehicle, isActive, onClick, onDetailsClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  const navigate = useNavigate();
  const isOnline = !!vehicle.is_online;
  const isMoving = isOnline && (vehicle.current_speed || 0) > 0;
  const ignitionOn = !!vehicle.current_ignition;
  const speed = vehicle.current_speed || 0;
  const fuel = vehicle.current_fuel || 0;

  const statusColor = isOnline ? (isMoving ? '#16a34a' : '#f97316') : '#6b7280';
  const statusLabel = isOnline ? (isMoving ? 'Moving' : 'Idle') : 'Offline';
  const statusBg = isOnline ? (isMoving ? '#dcfce7' : '#ffedd5') : '#f3f4f6';
  const statusBorder = isOnline ? (isMoving ? '#bbf7d0' : '#fed7aa') : '#e5e7eb';

  return (
    <div
      onClick={onClick}
      style={{
        background: isActive
          ? 'linear-gradient(135deg, #fff7ed 0%, #ffffff 100%)'
          : '#ffffff',
        border: `1px solid ${isActive ? '#fdba74' : '#e5e7eb'}`,
        borderRadius: '8px',
        padding: '10px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: isActive ? '0 0 0 1px rgba(234,88,12,0.1), 0 4px 12px rgba(234,88,12,0.1)' : '0 1px 2px rgba(0,0,0,0.05)',
      }}
      onMouseEnter={e => {
        setIsHovered(true);
        if (!isActive) {
          e.currentTarget.style.background = '#f9fafb';
          e.currentTarget.style.borderColor = '#d1d5db';
        }
      }}
      onMouseLeave={e => {
        setIsHovered(false);
        if (!isActive) {
          e.currentTarget.style.background = '#ffffff';
          e.currentTarget.style.borderColor = '#e5e7eb';
        }
      }}
    >
      {/* Active indicator line */}
      {isActive && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: '4px', background: 'linear-gradient(180deg, #ea580c 0%, #c2410c 100%)',
          borderRadius: '4px 0 0 4px',
        }} />
      )}

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', paddingLeft: isActive ? '6px' : 0 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.01em' }}>
            {vehicle.name || 'Unnamed'}
          </div>
          <div style={{ fontSize: '10px', color: '#6b7280', fontFamily: 'JetBrains Mono, monospace', marginTop: '1px', letterSpacing: '0.02em' }}>
            {vehicle.plate || '—'}
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          padding: '2px 6px', borderRadius: '99px',
          background: statusBg, border: `1px solid ${statusBorder}`,
          flexShrink: 0, marginLeft: '8px',
        }}>
          <div style={{
            width: '6px', height: '6px', borderRadius: '50%', background: statusColor,
            boxShadow: isOnline && isMoving ? '0 0 6px rgba(22,163,74,0.4)' : 'none',
            animation: isOnline && isMoving ? 'pulse-dot 2s ease-in-out infinite' : 'none',
          }} />
          <span style={{ fontSize: '10px', fontWeight: 700, color: statusColor, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          padding: '4px 6px', borderRadius: '6px',
          background: '#f8fafc',
          border: '1px solid #e5e7eb',
        }}>
          <Key size={11} color={ignitionOn ? '#16a34a' : '#9ca3af'} />
          <span style={{ fontSize: '11px', fontWeight: 600, color: ignitionOn ? '#16a34a' : '#6b7280' }}>
            {ignitionOn ? 'IGN ON' : 'IGN OFF'}
          </span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          padding: '4px 6px', borderRadius: '6px',
          background: '#f8fafc',
          border: '1px solid #e5e7eb',
        }}>
          <Navigation size={11} color={speed > 0 ? '#3b82f6' : '#9ca3af'} />
          <span style={{ fontSize: '11px', fontWeight: 700, color: speed > 0 ? '#2563eb' : '#6b7280', fontFamily: 'JetBrains Mono, monospace' }}>
            {speed > 0 ? `${speed} km/h` : '0 km/h'}
          </span>
        </div>
      </div>

      {/* Fuel bar */}
      <FuelMini pct={fuel} />

      {/* Footer / Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Clock size={11} color="#9ca3af" />
          <span style={{ fontSize: '10px', color: '#6b7280' }}>{getRelativeTime(vehicle.last_seen)}</span>
        </div>
        
        <div style={{ 
          display: 'flex', alignItems: 'center', gap: '4px',
          opacity: isHovered || isActive ? 1 : 0, 
          transition: 'opacity 0.2s', 
          pointerEvents: isHovered || isActive ? 'auto' : 'none' 
        }}>
          <button
            onClick={e => { e.stopPropagation(); onClick && onClick(e); }}
            style={{
              padding: '3px 6px', borderRadius: '4px',
              background: '#f3f4f6', border: '1px solid #e5e7eb',
              color: '#4b5563', fontSize: '10px', fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#e5e7eb'; e.currentTarget.style.borderColor = '#d1d5db'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
          >
            Locate
          </button>
          <button
            onClick={e => { e.stopPropagation(); navigate(`/vehicles/${vehicle.id}?tab=history`); }}
            style={{
              padding: '3px 6px', borderRadius: '4px',
              background: '#f3f4f6', border: '1px solid #e5e7eb',
              color: '#4b5563', fontSize: '10px', fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#e5e7eb'; e.currentTarget.style.borderColor = '#d1d5db'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
          >
            History
          </button>
          <button
            onClick={e => { e.stopPropagation(); navigate(`/vehicles/${vehicle.id}`); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '2px',
              padding: '3px 6px', borderRadius: '4px',
              background: '#fff7ed', border: '1px solid #fdba74',
              color: '#ea580c', fontSize: '10px', fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#ffedd5'; e.currentTarget.style.borderColor = '#f97316'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff7ed'; e.currentTarget.style.borderColor = '#fdba74'; }}
          >
            Details <ArrowRight size={10} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default VehicleCard;
