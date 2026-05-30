import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Loader2, MapPin, AlertTriangle, Layers, Activity, ChevronDown } from 'lucide-react';
import FleetMap from '../components/map/FleetMap';
import VehicleCard from '../components/ui/VehicleCard';
import { useVehicles } from '../hooks/useVehicles';

const StatPill = ({ label, value, color, bg }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '5px 10px', borderRadius: '7px',
    background: bg, border: `1px solid ${color}30`,
  }}>
    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}50` }} />
    <span style={{ fontSize: '11px', color: '#4a5568', fontWeight: 500 }}>{label}</span>
    <span style={{ fontSize: '13px', fontWeight: 800, color, fontFamily: 'JetBrains Mono, monospace' }}>{value}</span>
  </div>
);

const DashboardPage = ({ setAppVehicles }) => {
  const navigate = useNavigate();
  const { vehicles, groups, loading, error, params, updateParams } = useVehicles();
  const [search, setSearch] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  React.useEffect(() => {
    if (vehicles && setAppVehicles) setAppVehicles(vehicles);
  }, [vehicles, setAppVehicles]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    updateParams({ search: val });
  };

  const handleGroupChange = (val) => {
    setSelectedGroupId(val);
    updateParams({ groupId: val });
  };

  const onlineCount = vehicles.filter(v => v.is_online).length;
  const movingCount = vehicles.filter(v => v.is_online && (v.current_speed || 0) > 0).length;
  const offlineCount = vehicles.length - onlineCount;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden', background: '#0a0f1e' }}>

      {/* Left Panel */}
      <div style={{
        width: '300px', minWidth: '300px',
        display: 'flex', flexDirection: 'column',
        background: 'linear-gradient(180deg, #0c1526 0%, #0a1020 100%)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        overflow: 'hidden',
      }}>

        {/* Panel Header */}
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <Activity size={14} color="#2563eb" />
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#7c8db0', letterSpacing: '0.04em' }}>
              FLEET MONITOR
            </span>
          </div>

          {/* Stat pills */}
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            <StatPill label="Total" value={vehicles.length} color="#7c8db0" bg="rgba(124,141,176,0.06)" />
            <StatPill label="Online" value={onlineCount} color="#10b981" bg="rgba(16,185,129,0.06)" />
            <StatPill label="Moving" value={movingCount} color="#60a5fa" bg="rgba(37,99,235,0.06)" />
          </div>
        </div>

        {/* Search + Filter */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={13} color="#2d3748" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              type="text"
              value={search}
              onChange={handleSearchChange}
              placeholder="Search name, plate..."
              style={{
                width: '100%', padding: '8px 10px 8px 30px',
                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '7px', color: '#e2e8f0', fontSize: '12px',
                fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(37,99,235,0.5)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.05)'}
            />
          </div>

          {/* Group filter */}
          {groups.length > 0 && (
            <div style={{ position: 'relative' }}>
              <Layers size={12} color="#2d3748" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <ChevronDown size={12} color="#2d3748" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <select
                value={selectedGroupId}
                onChange={e => handleGroupChange(e.target.value)}
                style={{
                  width: '100%', padding: '7px 28px 7px 28px',
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '7px', color: selectedGroupId ? '#e2e8f0' : '#374151',
                  fontSize: '12px', fontFamily: 'Inter, sans-serif',
                  outline: 'none', cursor: 'pointer', appearance: 'none', boxSizing: 'border-box',
                }}
              >
                <option value="">All Groups</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Vehicle List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {loading && vehicles.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '10px' }}>
              <div style={{ width: '28px', height: '28px', border: '2px solid rgba(37,99,235,0.15)', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
              <span style={{ fontSize: '11px', color: '#2d3748', fontWeight: 500 }}>Loading fleet...</span>
            </div>
          ) : error ? (
            <div style={{ margin: '12px', padding: '12px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '8px', textAlign: 'center' }}>
              <AlertTriangle size={18} color="#f87171" style={{ margin: '0 auto 6px', display: 'block' }} />
              <p style={{ fontSize: '11px', color: '#f87171', fontWeight: 500 }}>{error}</p>
            </div>
          ) : vehicles.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '8px', padding: '24px' }}>
              <MapPin size={28} color="#1e2d45" />
              <p style={{ fontSize: '12px', color: '#2d3748', fontWeight: 500, textAlign: 'center' }}>No vehicles found</p>
              <p style={{ fontSize: '11px', color: '#1e2d45', textAlign: 'center' }}>Try clearing filters or register a vehicle</p>
            </div>
          ) : (
            vehicles.map(vehicle => (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                isActive={selectedVehicle?.id === vehicle.id}
                onClick={() => setSelectedVehicle(vehicle)}
                onDetailsClick={(id) => navigate(`/vehicles/${id}`)}
              />
            ))
          )}
        </div>
      </div>

      {/* Map Panel */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <FleetMap
          vehicles={vehicles}
          selectedVehicle={selectedVehicle}
          onMarkerClick={(v) => setSelectedVehicle(v)}
        />

        {/* Map overlay hint when nothing selected */}
        {!selectedVehicle && vehicles.length > 0 && (
          <div style={{
            position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(12,21,38,0.9)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '99px', padding: '7px 14px',
            display: 'flex', alignItems: 'center', gap: '7px',
            zIndex: 500, pointerEvents: 'none',
          }}>
            <MapPin size={12} color="#2563eb" />
            <span style={{ fontSize: '11px', color: '#7c8db0', fontWeight: 500 }}>
              Click a vehicle marker or card to focus
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
