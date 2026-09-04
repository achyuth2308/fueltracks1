import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Activity, MapPin, Navigation, RefreshCw, AlertCircle, ChevronRight, Users2, X, AlertTriangle, User, Compass, Shield, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVehicles } from '../../hooks/useVehicles';
import { useAuth } from '../../hooks/useAuth';
import FleetMap from '../../components/map/FleetMap';
import DummyRazorpayModal from '../../components/modals/DummyRazorpayModal';
import { formatSpeed, formatVoltage, formatDirection } from '../../utils/formatUtils';
import { getRelativeTime, getVehicleExpiryStatus, formatLocalDate } from '../../utils/dateUtils';
import { getAddressFromCoordinates } from '../../utils/geocodeUtils';
import { getDistance } from '../../utils/mapUtils';

const getExpiryWarning = (vehicle) => {
  if (!vehicle || !vehicle.licence_expire_date) return null;
  const status = getVehicleExpiryStatus(vehicle.licence_expire_date, vehicle.licence_issued_date, vehicle.metadata);
  if (status.isExpired) {
    return { type: 'expired', text: 'License Expired' };
  } else if (status.isExpiring) {
    return { type: 'expiring', text: `License Expiring in ${status.diffDays} day${status.diffDays === 1 ? '' : 's'}` };
  }
  return null;
};


const StatusPill = ({ label, count, color, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '6px 12px', borderRadius: '20px',
      border: active ? `2px solid ${color}` : '1px solid #e5e7eb',
      background: active ? `${color}15` : '#fff',
      cursor: 'pointer', fontSize: '12px', fontWeight: 700,
      color: active ? color : '#6b7280',
      transition: 'all 0.2s',
    }}
  >
    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: color }} />
    {label}
    <span style={{ fontFamily: 'monospace', fontWeight: 800, color }}>{count}</span>
  </button>
);

const CustomerDashboard = ({ setAppVehicles }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { vehicles, loading, error, refetch } = useVehicles();
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [dismissedToastId, setDismissedToastId] = useState(null);
  const [hoveredVehicleId, setHoveredVehicleId] = useState(null);
  const [hoverPosY, setHoverPosY] = useState(12);
  const [hoveredVehicleAddress, setHoveredVehicleAddress] = useState(null);
  const hoveredVehicle = useMemo(() => vehicles.find(v => v.id === hoveredVehicleId), [vehicles, hoveredVehicleId]);

  const [isNearbyActive, setIsNearbyActive] = useState(false);
  const [nearbyRadius, setNearbyRadius] = useState(5);

  useEffect(() => {
    if (hoveredVehicle) {
      if (hoveredVehicle.current_address) {
        setHoveredVehicleAddress(hoveredVehicle.current_address);
      } else if (hoveredVehicle.lat && hoveredVehicle.lng) {
        setHoveredVehicleAddress('Fetching address...');
        getAddressFromCoordinates(hoveredVehicle.lat, hoveredVehicle.lng)
          .then(addr => setHoveredVehicleAddress(addr))
          .catch(() => setHoveredVehicleAddress('Location unavailable'));
      } else {
        setHoveredVehicleAddress('Location unavailable');
      }
    } else {
      setHoveredVehicleAddress(null);
    }
  }, [hoveredVehicle]);

  // Reset dismissed toast when selecting a different vehicle
  useEffect(() => {
    if (selectedVehicle && selectedVehicle.id !== dismissedToastId) {
      setDismissedToastId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVehicle]);

  // Sync vehicles up to App level
  React.useEffect(() => {
    if (vehicles && setAppVehicles) {
      setAppVehicles(prev => {
        if (!prev || prev.length !== vehicles.length) return vehicles;
        const prevOnline = prev.filter(v => v.is_online).length;
        const currOnline = vehicles.filter(v => v.is_online).length;
        if (prevOnline !== currOnline) return vehicles;
        return prev;
      });
    }
  }, [vehicles, setAppVehicles]);

  const getStatus = (v) => {
    if (!v.is_online) return 'offline';
    if ((v.current_speed || 0) > 2.0) return 'running';
    if (v.current_ignition) return 'idle';
    return 'parked';
  };

  const metrics = useMemo(() => {
    const m = { running: 0, idle: 0, parked: 0, offline: 0 };
    vehicles.forEach(v => m[getStatus(v)]++);
    return m;
  }, [vehicles]);

  const filtered = useMemo(() => {
    if (!statusFilter) return vehicles;
    return vehicles.filter(v => getStatus(v) === statusFilter);
  }, [vehicles, statusFilter]);

  const statusColors = { running: '#10b981', idle: '#f59e0b', parked: '#64748B', offline: '#ef4444' };
  const statusLabels = { running: 'Running', idle: 'Idle', parked: 'Parked', offline: 'Offline' };

  const currentSelected = useMemo(() => {
    if (!selectedVehicle) return null;
    return vehicles.find(v => v.id === selectedVehicle.id) || selectedVehicle;
  }, [vehicles, selectedVehicle]);

  const nearbyVehicles = useMemo(() => {
    if (!isNearbyActive || !currentSelected) return [];
    
    return vehicles.filter(v => {
      if (v.id === currentSelected.id) return false;
      if (!v.lat || !v.lng || !currentSelected.lat || !currentSelected.lng) return false;
      
      const dist = getDistance(
        parseFloat(currentSelected.lat), parseFloat(currentSelected.lng),
        parseFloat(v.lat), parseFloat(v.lng)
      );
      
      if (dist <= nearbyRadius) {
        v._distance = dist;
        return true;
      }
      return false;
    }).sort((a, b) => (a._distance || 0) - (b._distance || 0));
  }, [isNearbyActive, currentSelected, vehicles, nearbyRadius]);

  const warning = currentSelected && dismissedToastId !== currentSelected.id ? getExpiryWarning(currentSelected) : null;


  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      background: '#f0f2f5', overflow: 'hidden', position: 'relative'
    }}>

      {/* ── Top Warning Toast ── */}
      <AnimatePresence>
        {warning && (
          <motion.div
            initial={{ opacity: 0, y: -50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -50, x: '-50%' }}
            style={{
              position: 'fixed',
              top: '80px',
              left: '50%',
              zIndex: 9999,
              background: warning.type === 'expired' ? '#FEF2F2' : '#FFFBEB',
              border: `2px solid ${warning.type === 'expired' ? '#FECACA' : '#FDE68A'}`,
              padding: '16px 24px',
              borderRadius: '16px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              minWidth: '400px'
            }}
          >
            <AlertTriangle size={32} color={warning.type === 'expired' ? '#EF4444' : '#F59E0B'} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '16px', color: warning.type === 'expired' ? '#991B1B' : '#B45309' }}>
                {warning.type === 'expired' ? 'License Expired!' : 'License Expiring Soon!'}
              </div>
              <div style={{ fontWeight: 600, fontSize: '14px', color: warning.type === 'expired' ? '#B91C1C' : '#D97706', marginTop: '2px' }}>
                {warning.text} for vehicle <span style={{ fontWeight: 800 }}>{currentSelected.name}</span>.
                <button
                  onClick={() => navigate('/renewals')}
                  style={{ marginLeft: '12px', padding: '6px 12px', background: warning.type === 'expired' ? '#EF4444' : '#F59E0B', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}
                >
                  Renew Now
                </button>
              </div>
            </div>
            <button
              onClick={() => setDismissedToastId(currentSelected.id)}
              style={{
                background: warning.type === 'expired' ? '#FECACA' : '#FDE68A',
                border: 'none',
                width: '28px', height: '28px',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                color: warning.type === 'expired' ? '#991B1B' : '#B45309'
              }}
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top Header Bar ── */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e5e7eb',
        padding: '12px 20px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexShrink: 0,
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #4d6076, #6e859b)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <MapPin size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>
              {user?.name ? `${user.name}'s Dashboard` : 'Fleet Dashboard'}
            </div>
            <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>
              {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''} in your fleet
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Status filter pills */}
          {['running', 'idle', 'parked', 'offline'].map(s => (
            <StatusPill
              key={s} label={statusLabels[s]} count={metrics[s]}
              color={statusColors[s]} active={statusFilter === s}
              onClick={() => setStatusFilter(prev => prev === s ? null : s)}
            />
          ))}

          <div style={{
            padding: '6px 12px', borderRadius: '20px',
            background: '#f97316', color: '#fff',
            fontSize: '12px', fontWeight: 700, marginLeft: '4px'
          }}>
            Total {vehicles.length}
          </div>

          <button
            onClick={() => refetch()}
            style={{
              background: '#f9fafb', border: '1px solid #e5e7eb', color: '#6b7280',
              cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '7px',
              borderRadius: '8px', marginLeft: '4px'
            }}
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── Hover Tooltip Card ── */}
      {hoveredVehicle && (
        <div style={{
          position: 'absolute',
          top: `${hoverPosY}px`,
          left: '304px',
          width: '260px',
          background: 'rgba(255, 255, 255, 0.4)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.6)',
          borderRadius: '16px',
          padding: '12px',
          zIndex: 1001,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          pointerEvents: 'none'
        }}>
          {/* Header removed as requested */}

          {/* Expiry Warning */}
          {(() => {
            const warning = getExpiryWarning(hoveredVehicle);
            if (!warning) return null;
            const isExpired = warning.type === 'expired';
            return (
              <div style={{
                background: isExpired ? '#FEF2F2' : '#FFFBEB',
                border: `1px solid ${isExpired ? '#FECACA' : '#FDE68A'}`,
                padding: '10px 12px',
                display: 'flex', alignItems: 'center', gap: '10px',
                borderRadius: '8px'
              }}>
                <AlertTriangle size={16} color={isExpired ? '#EF4444' : '#F59E0B'} style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: isExpired ? '#B91C1C' : '#D97706' }}>
                    {warning.text}
                  </div>
                  {hoveredVehicle.licence_expire_date && (
                    <div style={{ fontSize: '10px', color: isExpired ? '#991B1B' : '#B45309', marginTop: '2px' }}>
                      Expires on {formatLocalDate(hoveredVehicle.licence_expire_date)}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Driver */}
          {hoveredVehicle.driver_name && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={16} color="#4b5563" />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#1f2937' }}>{hoveredVehicle.driver_name}</div>
                {hoveredVehicle.driver_phone && <div style={{ fontSize: '11px', color: '#6b7280' }}>{hoveredVehicle.driver_phone}</div>}
              </div>
            </div>
          )}

          {/* Table Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '8px', overflow: 'hidden', background: 'rgba(255, 255, 255, 0.3)' }}>
            <div style={{ padding: '8px', borderRight: '1px solid rgba(0,0,0,0.1)', borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '10px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}><Compass size={12} color="#3b82f6" /> Odo (kms)</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1f2937', marginTop: '4px' }}>{Math.round(hoveredVehicle.current_odometer || 0).toLocaleString()}</div>
            </div>
            <div style={{ padding: '8px', borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '10px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}><Activity size={12} color="#3b82f6" /> Covered Distance</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1f2937', marginTop: '4px' }}>{Math.round(hoveredVehicle.today_distance || 0).toLocaleString()}</div>
            </div>
            <div style={{ padding: '8px', borderRight: '1px solid rgba(0,0,0,0.1)', borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '10px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}><Shield size={12} color="#10b981" /> Ignition</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1f2937', marginTop: '4px' }}>{hoveredVehicle.current_ignition ? 'ON' : 'OFF'}</div>
            </div>
            <div style={{ padding: '8px', borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '10px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}><Cpu size={12} color="#10b981" /> Battery</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1f2937', marginTop: '4px' }}>{formatVoltage(hoveredVehicle.current_voltage || hoveredVehicle.metadata?.batteryVoltage)}</div>
            </div>
            <div style={{ padding: '8px', borderRight: '1px solid rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '10px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}><Activity size={12} color="#4b5563" /> Speed (km/h)</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1f2937', marginTop: '4px' }}>{Math.round(hoveredVehicle.current_speed || 0)}</div>
            </div>
            <div style={{ padding: '8px' }}>
              <div style={{ fontSize: '10px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}><Navigation size={12} color="#10b981" /> Direction</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1f2937', marginTop: '4px' }}>{formatDirection(hoveredVehicle.current_direction)}</div>
            </div>
          </div>

          {/* Location */}
          <div>
            <div style={{ fontSize: '10px', color: '#1f2937', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} color="#4b5563" /> Current Location</div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', lineHeight: '1.4' }}>
              {hoveredVehicleAddress || 'Unknown location'}
            </div>
            <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '6px' }}>
              {getRelativeTime(hoveredVehicle.last_seen)}
            </div>
          </div>
        </div>
      )}

      {/* ── Body: Vehicle List + Map ── */}
      <div className="tracking-container" style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* Left Panel: Vehicle List */}
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          maxHeight: 'calc(100% - 24px)',
          width: '280px',
          background: 'rgba(255, 255, 255, 0.25)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.5)',
          borderRadius: '24px',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1000,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)'
        }}>
        {/* Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(0, 0, 0, 0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: '#f97316', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', fontWeight: 700
                }}>
                  {user?.name ? user.name.substring(0, 2).toUpperCase() : 'U'}
                </div>
                <div>
                  <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#1f2937', margin: 0 }}>
                    {user?.name ? `${user.name.split(' ')[0]}'s Vehicles` : 'Vehicles'}
                  </h2>
                  <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>
                    {filtered.length} of {vehicles.length} shown
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => refetch()}
              style={{
                background: 'rgba(255, 255, 255, 0.6)', border: '1px solid rgba(255, 255, 255, 0.8)', color: '#6b7280',
                cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '6px',
                borderRadius: '8px', transition: 'all 0.2s', marginTop: '2px'
              }}
              title="Refresh"
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)'; e.currentTarget.style.color = '#374151'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.6)'; e.currentTarget.style.color = '#6b7280'; }}
            >
              <RefreshCw size={14} />
            </button>
          </div>
          {statusFilter && (
            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setStatusFilter(null)}
                style={{ fontSize: '10px', color: '#f97316', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
              >Clear Filter</button>
            </div>
          )}
        </div>

          <div className="tracking-scroll" style={{ overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '8px', opacity: 0.5 }}>
                <RefreshCw size={18} color="#f97316" className="animate-spin" />
                <span style={{ fontSize: '12px', color: '#6b7280' }}>Loading...</span>
              </div>
            ) : error ? (
              <div style={{ padding: '20px', textAlign: 'center', opacity: 0.5 }}>
                <AlertCircle size={24} color="#ef4444" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Failed to load vehicles</div>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.4, padding: '20px', textAlign: 'center' }}>
                <Truck size={28} color="#9ca3af" style={{ marginBottom: '8px' }} />
                <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>
                  {vehicles.length === 0 ? 'No vehicles assigned to your groups' : 'No vehicles match the filter'}
                </span>
              </div>
            ) : (
              filtered.map(v => {
                const status = getStatus(v);
                const isSelected = currentSelected?.id === v.id;
                const sc = statusColors[status];
                return (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVehicle(prev => prev?.id === v.id ? null : v)}
                    title={getExpiryWarning(v) ? getExpiryWarning(v).text : undefined}
                    style={{
                      background: isSelected ? 'linear-gradient(135deg, #4d6076, #6e859b)' : 'rgba(255, 255, 255, 0.85)',
                      backdropFilter: isSelected ? 'none' : 'blur(4px)',
                      border: `1px solid ${isSelected ? 'transparent' : 'rgba(255, 255, 255, 0.9)'}`,
                      borderRadius: '16px',
                      padding: '10px 12px',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                      position: 'relative',
                      zIndex: hoveredVehicleId === v.id ? 10 : 1,
                      transform: hoveredVehicleId === v.id ? 'scale(1.02)' : 'scale(1)',
                      boxShadow: hoveredVehicleId === v.id ? '0 8px 16px rgba(0,0,0,0.1)' : '0 2px 4px rgba(0,0,0,0.02)'
                    }}
                    onMouseEnter={e => { 
                      setHoveredVehicleId(v.id);
                      const containerRect = e.currentTarget.closest('.tracking-container')?.getBoundingClientRect() || { top: 0, height: 1000 };
                      const itemRect = e.currentTarget.getBoundingClientRect();
                      setHoverPosY(Math.max(12, Math.min(itemRect.top - containerRect.top, containerRect.height - 350)));
                    }}
                    onMouseLeave={e => { 
                      setHoveredVehicleId(null);
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: isSelected ? '#fff' : '#1f2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {v.name}
                        </div>
                        <div style={{ fontSize: '10px', color: isSelected ? 'rgba(255,255,255,0.7)' : '#9ca3af', marginTop: '2px' }}>
                          {v.plate || v.name} · {formatSpeed(v.current_speed)}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '10px', fontWeight: 700,
                        color: isSelected ? '#fff' : sc,
                        background: isSelected ? 'rgba(255,255,255,0.2)' : `${sc}15`,
                        padding: '3px 8px', borderRadius: '6px', flexShrink: 0, marginLeft: '8px'
                      }}>
                        {statusLabels[status]}
                      </span>
                    </div>
                    <div style={{ fontSize: '10px', color: isSelected ? 'rgba(255,255,255,0.55)' : '#9ca3af', marginTop: '4px' }}>
                      {getRelativeTime(v.last_seen)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Map + optional vehicle detail */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <FleetMap
            vehicles={filtered}
            selectedVehicles={currentSelected ? [currentSelected] : []}
            onMarkerClick={(v) => setSelectedVehicle(v)}
            onMultiTrackClick={(v) => navigate(`/tracking?multitrack=${v.id}`)}
            isNearbyActive={isNearbyActive}
            nearbyRadius={nearbyRadius}
            followSelected={true}
          />
          
          {/* ── Nearby Mode Controls ── */}
          {currentSelected && (
            <div style={{
              position: 'absolute',
              bottom: '24px',
              right: '24px',
              zIndex: 1000,
              background: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.6)',
              borderRadius: '16px',
              padding: '12px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              minWidth: '220px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Compass size={16} color="#3b82f6" />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#1f2937' }}>Nearby Vehicles</span>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={isNearbyActive} 
                    onChange={(e) => setIsNearbyActive(e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#3b82f6' }}
                  />
                </label>
              </div>
              
              {isNearbyActive && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: '8px', marginTop: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600 }}>Radius:</span>
                    <select 
                      value={nearbyRadius}
                      onChange={(e) => setNearbyRadius(Number(e.target.value))}
                      style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none', background: '#fff' }}
                    >
                      <option value={2}>2 km</option>
                      <option value={5}>5 km</option>
                      <option value={10}>10 km</option>
                      <option value={20}>20 km</option>
                      <option value={50}>50 km</option>
                    </select>
                  </div>
                  
                  <div className="tracking-scroll" style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px', paddingRight: '4px' }}>
                    {nearbyVehicles.length === 0 ? (
                      <div style={{ fontSize: '11px', color: '#6b7280', textAlign: 'center', padding: '12px 0' }}>
                        No vehicles found within {nearbyRadius}km
                      </div>
                    ) : (
                      nearbyVehicles.map(v => (
                        <div 
                          key={v.id}
                          onClick={() => setSelectedVehicle(v)}
                          style={{
                            padding: '8px',
                            background: '#f9fafb',
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#1f2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {v.name}
                            </div>
                            <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>
                              {v.plate || v.name}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: '8px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 800, color: '#3b82f6' }}>
                              {v._distance.toFixed(1)} km
                            </span>
                            <span style={{ fontSize: '9px', fontWeight: 700, color: statusColors[getStatus(v)], marginTop: '2px', background: `${statusColors[getStatus(v)]}15`, padding: '2px 6px', borderRadius: '4px' }}>
                              {statusLabels[getStatus(v)]}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .tracking-scroll::-webkit-scrollbar { width: 4px; }
        .tracking-scroll::-webkit-scrollbar-track { background: transparent; }
        .tracking-scroll::-webkit-scrollbar-thumb { background-color: #d1d5db; border-radius: 4px; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}} />
    </div>
  );
};

export default CustomerDashboard;
