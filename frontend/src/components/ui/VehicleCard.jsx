import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Key, Navigation, Fuel, Clock, ArrowRight, Wifi, WifiOff } from 'lucide-react';
import { formatSpeed } from '../../utils/formatUtils';
import { getRelativeTime } from '../../utils/dateUtils';

const FuelMini = ({ pct = 0 }) => {
  const color = pct > 40 ? '#10b981' : pct > 15 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <Fuel size={11} color={color} />
      <div style={{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: '100%', background: color, borderRadius: '99px', transition: 'width 0.5s ease' }} />
      </div>
      <span style={{ fontSize: '10px', fontWeight: 600, color, fontFamily: 'JetBrains Mono, monospace', minWidth: '30px' }}>
        {Number(pct).toFixed(0)}%
      </span>
    </div>
  );
};

const VehicleCard = ({ vehicle, isActive, onClick, onDetailsClick }) => {
  const navigate = useNavigate();
  const isOnline = !!vehicle.is_online;
  const isMoving = isOnline && (vehicle.current_speed || 0) > 0;
  const ignitionOn = !!vehicle.current_ignition;
  const speed = vehicle.current_speed || 0;
  const fuel = vehicle.current_fuel || 0;

  const statusColor = isOnline ? (isMoving ? '#10b981' : '#f59e0b') : '#374151';
  const statusLabel = isOnline ? (isMoving ? 'Moving' : 'Idle') : 'Offline';
  const statusBg = isOnline ? (isMoving ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)') : 'rgba(55,65,81,0.3)';
  const statusBorder = isOnline ? (isMoving ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)') : 'rgba(55,65,81,0.4)';

  return (
    <div
      onClick={onClick}
      style={{
        background: isActive
          ? 'linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(29,78,216,0.08) 100%)'
          : 'linear-gradient(135deg, #0f1729 0%, #0c1422 100%)',
        border: `1px solid ${isActive ? 'rgba(37,99,235,0.4)' : 'rgba(255,255,255,0.05)'}`,
        borderRadius: '10px',
        padding: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: isActive ? '0 0 0 1px rgba(37,99,235,0.2), 0 4px 16px rgba(37,99,235,0.1)' : 'none',
      }}
      onMouseEnter={e => {
        if (!isActive) {
          e.currentTarget.style.background = 'linear-gradient(135deg, #131d30 0%, #10192a 100%)';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)';
        }
      }}
      onMouseLeave={e => {
        if (!isActive) {
          e.currentTarget.style.background = 'linear-gradient(135deg, #0f1729 0%, #0c1422 100%)';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
        }
      }}
    >
      {/* Active indicator line */}
      {isActive && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: '3px', background: 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)',
          borderRadius: '3px 0 0 3px',
        }} />
      )}

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', paddingLeft: isActive ? '4px' : 0 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.01em' }}>
            {vehicle.name || 'Unnamed'}
          </div>
          <div style={{ fontSize: '10px', color: '#2d3748', fontFamily: 'JetBrains Mono, monospace', marginTop: '1px', letterSpacing: '0.04em' }}>
            {vehicle.plate || '—'}
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          padding: '2px 7px', borderRadius: '99px',
          background: statusBg, border: `1px solid ${statusBorder}`,
          flexShrink: 0, marginLeft: '8px',
        }}>
          <div style={{
            width: '5px', height: '5px', borderRadius: '50%', background: statusColor,
            boxShadow: isOnline && isMoving ? '0 0 6px rgba(16,185,129,0.5)' : 'none',
            animation: isOnline && isMoving ? 'pulse-dot 2s ease-in-out infinite' : 'none',
          }} />
          <span style={{ fontSize: '9px', fontWeight: 700, color: statusColor, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '5px 7px', borderRadius: '6px',
          background: 'rgba(0,0,0,0.25)',
          border: '1px solid rgba(255,255,255,0.03)',
        }}>
          <Key size={11} color={ignitionOn ? '#10b981' : '#374151'} />
          <span style={{ fontSize: '10px', fontWeight: 600, color: ignitionOn ? '#34d399' : '#374151' }}>
            {ignitionOn ? 'IGN ON' : 'IGN OFF'}
          </span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '5px 7px', borderRadius: '6px',
          background: 'rgba(0,0,0,0.25)',
          border: '1px solid rgba(255,255,255,0.03)',
        }}>
          <Navigation size={11} color={speed > 0 ? '#60a5fa' : '#374151'} />
          <span style={{ fontSize: '10px', fontWeight: 700, color: speed > 0 ? '#93c5fd' : '#374151', fontFamily: 'JetBrains Mono, monospace' }}>
            {speed > 0 ? `${speed} km/h` : '0 km/h'}
          </span>
        </div>
      </div>

      {/* Fuel bar */}
      <FuelMini pct={fuel} />

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Clock size={10} color="#2d3748" />
          <span style={{ fontSize: '10px', color: '#374151' }}>{getRelativeTime(vehicle.last_seen)}</span>
        </div>
        <button
          onClick={e => { e.stopPropagation(); navigate(`/vehicles/${vehicle.id}`); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '3px',
            padding: '3px 8px', borderRadius: '5px',
            background: 'rgba(37,99,235,0.08)',
            border: '1px solid rgba(37,99,235,0.2)',
            color: '#60a5fa', fontSize: '10px', fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s',
            fontFamily: 'Inter, sans-serif',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,99,235,0.15)'; e.currentTarget.style.borderColor = 'rgba(37,99,235,0.35)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(37,99,235,0.08)'; e.currentTarget.style.borderColor = 'rgba(37,99,235,0.2)'; }}
        >
          Track <ArrowRight size={10} />
        </button>
      </div>
    </div>
  );
};

export default VehicleCard;
