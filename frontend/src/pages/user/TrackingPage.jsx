import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, MapPin, Activity, Compass, User, Phone, Shield, Cpu, RefreshCw, BarChart2, AlertCircle, Calendar, X, ChevronRight, AlertTriangle, Navigation } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useVehicles } from '../../hooks/useVehicles';
import FleetMap from '../../components/map/FleetMap';
import { formatSpeed, formatFuel, formatVoltage, formatOdometer } from '../../utils/formatUtils';
import { getRelativeTime, getVehicleExpiryStatus, formatLocalDate } from '../../utils/dateUtils';
import { getAddressFromCoordinates } from '../../utils/geocodeUtils';
import { getDistance } from '../../utils/mapUtils';
import { getVehicleStatus, STATUS_CONFIG } from '../../utils/markerUtils';

const getExpiryWarning = (vehicle) => {
  if (!vehicle) return null;
  const expireDateStr = typeof vehicle === 'string' ? vehicle : vehicle.licence_expire_date;
  if (!expireDateStr) return null;

  const status = getVehicleExpiryStatus(
    expireDateStr,
    typeof vehicle === 'object' ? vehicle.licence_issued_date : null,
    typeof vehicle === 'object' ? vehicle.metadata : null
  );

  if (status.isExpired) {
    return { type: 'expired', text: `Licence Expired` };
  } else if (status.isExpiring) {
    return { type: 'expiring', text: `Licence Expiring in ${status.diffDays} day${status.diffDays === 1 ? '' : 's'}` };
  }
  return null;
};


const TrackingPage = ({ setAppVehicles }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { vehicles, groups, loading, error, refetch } = useVehicles();
  const [selectedVehicles, setSelectedVehicles] = useState([]);
  const [statusFilter, setStatusFilter] = useState(null);
  const [hasSelectedInitial, setHasSelectedInitial] = useState(false);
  const [hoveredVehicleId, setHoveredVehicleId] = useState(null);
  const [hoverPosY, setHoverPosY] = useState(12);
  const [hoveredVehicleAddress, setHoveredVehicleAddress] = useState(null);
  const hoveredVehicle = useMemo(() => vehicles.find(v => v.id === hoveredVehicleId), [vehicles, hoveredVehicleId]);

  // Nearby Vehicles State
  const [isNearbyActive, setIsNearbyActive] = useState(false);
  const [nearbyRadius, setNearbyRadius] = useState(10); // in km

  const nearbyVehiclesList = useMemo(() => {
    if (!isNearbyActive || selectedVehicles.length !== 1 || !vehicles.length) return [];
    const target = vehicles.find(v => String(v.id) === String(selectedVehicles[0]));
    if (!target || !target.lat || !target.lng) return [];

    return vehicles
      .filter(v => v.id !== target.id && v.lat && v.lng)
      .map(v => ({
        ...v,
        distanceToTarget: getDistance(target.lat, target.lng, v.lat, v.lng)
      }))
      .filter(v => v.distanceToTarget <= nearbyRadius)
      .sort((a, b) => a.distanceToTarget - b.distanceToTarget);
  }, [isNearbyActive, selectedVehicles, vehicles, nearbyRadius]);

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

  useEffect(() => {
    if (!hasSelectedInitial && location.state?.selectedVehicleId && vehicles?.length > 0) {
      const v = vehicles.find(v => String(v.id) === String(location.state.selectedVehicleId));
      if (v) {
        setSelectedVehicles([v]);
        setHasSelectedInitial(true);
      }
    }
  }, [location.state, vehicles, hasSelectedInitial]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const multiId = searchParams.get('multitrack');
    if (multiId && vehicles.length > 0) {
      const v = vehicles.find(v => v.id === multiId);
      if (v) {
        setSelectedVehicles(prev => {
          if (!prev.some(sv => sv.id === v.id)) return [...prev, v];
          return prev;
        });
        // Remove param from URL without reloading
        navigate('/tracking', { replace: true });
      }
    }
  }, [location.search, vehicles, navigate]);

  useEffect(() => {
    if (vehicles && setAppVehicles) {
      setAppVehicles(vehicles);
    }
  }, [vehicles, setAppVehicles]);

  const currentSelectedVehicles = useMemo(() => {
    return selectedVehicles.map(sv => vehicles.find(v => v.id === sv.id) || sv);
  }, [vehicles, selectedVehicles]);

  const metrics = useMemo(() => {
    let running = 0, idle = 0, parked = 0, offline = 0;
    vehicles.forEach(v => {
      const isOnline = !!v.is_online;
      const speed = v.current_speed || 0;
      const ignition = !!v.current_ignition;
      if (!isOnline) offline++;
      else if (speed > 2.0) running++;
      else if (ignition) idle++;
      else parked++;
    });
    return { running, idle, parked, offline, total: vehicles.length };
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      if (statusFilter) {
        const isOnline = !!v.is_online;
        const speed = v.current_speed || 0;
        const ignition = !!v.current_ignition;
        if (statusFilter === 'running') return isOnline && speed > 2.0;
        if (statusFilter === 'idle') return isOnline && speed <= 2.0 && ignition;
        if (statusFilter === 'parked') return isOnline && speed <= 2.0 && !ignition;
        if (statusFilter === 'offline') return !isOnline;
      }
      return true;
    });
  }, [vehicles, statusFilter]);

  const handleVehicleSelect = (vehicle) => {
    setSelectedVehicles(prev => {
      const isSelected = prev.some(v => v.id === vehicle.id);
      if (isSelected) {
        return prev.filter(v => v.id !== vehicle.id);
      } else {
        return [vehicle]; // Default single click replaces selection
      }
    });
  };

  const handleMultiTrackClick = (vehicle) => {
    setSelectedVehicles(prev => {
      if (prev.some(v => v.id === vehicle.id)) return prev;
      return [...prev, vehicle];
    });
  };

  const handleStatusFilterClick = (filterType) => {
    setStatusFilter(prev => prev === filterType ? null : filterType);
  };

  const handleClearFilters = () => {
    setStatusFilter(null);
  };

  // getVehicleStatus imported from markerUtils

  return (
    <div className="tracking-container" style={{
      display: 'flex',
      flexDirection: 'row',
      height: 'calc(100vh - 56px)',
      background: '#f0f2f5',
      overflow: 'hidden',
      position: 'relative',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
    }}>

      {/* ── Hover Tooltip Card ── */}
      {hoveredVehicle && (
        <div style={{
          position: 'absolute',
          top: `${hoverPosY}px`,
          left: '324px',
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
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1f2937', marginTop: '4px' }}>{formatVoltage(hoveredVehicle.current_voltage)}</div>
            </div>
            <div style={{ padding: '8px', borderRight: '1px solid rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '10px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}><Activity size={12} color="#4b5563" /> Speed (km/h)</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1f2937', marginTop: '4px' }}>{Math.round(hoveredVehicle.current_speed || 0)}</div>
            </div>
            <div style={{ padding: '8px' }}>
              <div style={{ fontSize: '10px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}><Navigation size={12} color="#10b981" /> Direction</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1f2937', marginTop: '4px' }}>{hoveredVehicle.current_course || 'N/A'}</div>
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

      {/* ═══════════ LEFT PANEL: Vehicle List ═══════════ */}
      <div style={{
        position: 'absolute',
        top: '12px',
        left: '12px',
        maxHeight: 'calc(100% - 24px)',
        width: '300px',
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
                  <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>
                    {filteredVehicles.length} of {vehicles.length} shown
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
              <button onClick={handleClearFilters} style={{
                padding: '5px 10px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.8)',
                background: 'rgba(255, 255, 255, 0.6)', color: '#6b7280', fontSize: '10px', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.2s'
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.6)'}
              >Clear Filter</button>
            </div>
          )}
        </div>

        {/* Vehicle List */}
        <div className="tracking-scroll" style={{
          overflowY: 'auto', padding: '8px',
          display: 'flex', flexDirection: 'column', gap: '4px'
        }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '8px', opacity: 0.5 }}>
              <RefreshCw size={20} color="#f97316" className="animate-spin" />
              <span style={{ fontSize: '12px', color: '#6b7280' }}>Loading...</span>
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.4, textAlign: 'center', padding: '20px' }}>
              <AlertCircle size={20} color="#9ca3af" style={{ marginBottom: '6px' }} />
              <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>No vehicles found</span>
            </div>
          ) : (
            filteredVehicles.map(v => {
              const isSelected = currentSelectedVehicles.some(sv => sv.id === v.id);
              const statusKey = getVehicleStatus(v);
              const status = STATUS_CONFIG[statusKey] ? {
                text: STATUS_CONFIG[statusKey].label,
                color: STATUS_CONFIG[statusKey].color,
                bg: `${STATUS_CONFIG[statusKey].color}15`
              } : { text: 'Unknown', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' };

              return (
                <div
                  key={v.id}
                  onClick={() => handleVehicleSelect(v)}
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
                      <div style={{ fontSize: '10px', color: isSelected ? 'rgba(255,255,255,0.7)' : '#9ca3af', marginTop: '1px' }}>
                        {v.plate || 'No plate'} • {formatSpeed(v.current_speed)}
                      </div>
                    </div>
                    <span style={{
                      fontSize: '10px', fontWeight: 600, color: isSelected ? '#fff' : status.color,
                      background: isSelected ? 'rgba(255,255,255,0.15)' : status.bg,
                      padding: '3px 8px', borderRadius: '6px', flexShrink: 0, marginLeft: '8px'
                    }}>
                      {status.text}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ═══════════ MAP AREA (Full remaining width) ═══════════ */}
      <div style={{ flex: 1, height: '100%', position: 'relative', background: '#e5e7eb' }}>
        <FleetMap
          vehicles={filteredVehicles}
          selectedVehicles={currentSelectedVehicles}
          onMarkerClick={handleVehicleSelect}
          onMultiTrackClick={handleMultiTrackClick}
          showRoute={false}
          followSelected={true}
          nearbyRadius={nearbyRadius}
          isNearbyActive={isNearbyActive}
        />

        {/* ── Floating Status Pills (top-right of map) ── */}
        <div style={{
          position: 'absolute', top: '12px', right: '12px', zIndex: 1000,
          display: 'flex', gap: '6px', flexWrap: 'wrap'
        }}>
          {[
            { type: 'running', label: 'Running', count: metrics.running, color: '#10b981' },
            { type: 'idle', label: 'Idle', count: metrics.idle, color: '#eab308' },
            { type: 'parked', label: 'Parked', count: metrics.parked, color: '#f97316' },
            { type: 'offline', label: 'Offline', count: metrics.offline, color: '#6b7280' },
          ].map(pill => {
            const isActive = statusFilter === pill.type;
            return (
              <button
                key={pill.type}
                onClick={() => handleStatusFilterToggle(pill.type)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '5px 10px', borderRadius: '20px',
                  border: isActive ? `2px solid ${pill.color}` : '1px solid rgba(255,255,255,0.6)',
                  background: isActive ? '#fff' : 'rgba(255,255,255,0.85)',
                  backdropFilter: 'blur(8px)',
                  cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                  color: '#374151', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  transition: 'all 0.2s'
                }}
              >
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: pill.color, flexShrink: 0 }} />
                <span>{pill.label}</span>
                <span style={{ fontWeight: 800, color: pill.color, fontFamily: 'monospace' }}>{pill.count}</span>
              </button>
            );
          })}
          {/* Total badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px',
            borderRadius: '20px', background: 'rgba(77,96,118,0.9)', backdropFilter: 'blur(8px)',
            fontSize: '11px', fontWeight: 700, color: '#fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
          }}>
            Total <span style={{ fontFamily: 'monospace' }}>{metrics.total}</span>
          </div>
        </div>

        {/* ── Top Center "Find Nearby" Action Button ── */}
        {currentSelectedVehicles.length === 1 && (
          <div style={{
            position: 'absolute', top: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 1001,
          }}>
            <button
              onClick={() => setIsNearbyActive(!isNearbyActive)}
              style={{
                background: isNearbyActive ? '#3b82f6' : 'rgba(255,255,255,0.95)',
                color: isNearbyActive ? '#fff' : '#1f2937',
                border: isNearbyActive ? '1px solid #2563eb' : '1px solid rgba(0,0,0,0.1)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                padding: '10px 24px',
                borderRadius: '30px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)'
              }}
              onMouseEnter={(e) => {
                if (!isNearbyActive) {
                  e.currentTarget.style.transform = 'translateX(-50%) translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.2)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isNearbyActive) {
                  e.currentTarget.style.transform = 'translateX(-50%) translateY(0)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
                }
              }}
            >
              <Search size={16} color={isNearbyActive ? '#fff' : '#3b82f6'} />
              {isNearbyActive ? 'Nearby Search Active' : 'Find Nearby Vehicles'}
            </button>
          </div>
        )}

        {/* ── Real-time Speedometer Widget (bottom-left of map) ── */}
        {currentSelectedVehicles.length > 0 && (() => {
          const sv = currentSelectedVehicles[0];
          const speed = Math.round(sv.current_speed || 0);
          const maxSpeed = 200;
          // Arc: 220 degrees total, starts at 200 deg and ends at 340 deg (bottom)
          const startAngle = -220; // degrees, from 3 o'clock
          const totalArc = 240;   // degrees
          const pct = Math.min(speed / maxSpeed, 1);
          const needleAngle = startAngle + pct * totalArc; // in degrees

          // Convert to radians for needle tip
          const cx = 90, cy = 90, r = 68;
          const needleRad = (needleAngle * Math.PI) / 180;
          const nx = cx + r * Math.cos(needleRad);
          const ny = cy + r * Math.sin(needleRad);

          // Arc helper: polar to cartesian
          const polarToCartesian = (angle) => ({
            x: cx + r * Math.cos((angle * Math.PI) / 180),
            y: cy + r * Math.sin((angle * Math.PI) / 180),
          });
          const arcPath = (from, to, ri = r, outer = false) => {
            const s = polarToCartesian(from);
            const e = polarToCartesian(to);
            const large = Math.abs(to - from) > 180 ? 1 : 0;
            return `M ${s.x} ${s.y} A ${ri} ${ri} 0 ${large} 1 ${e.x} ${e.y}`;
          };

          // Ticks
          const ticks = [];
          for (let i = 0; i <= 20; i++) {
            const pctTick = i / 20;
            const angle = startAngle + pctTick * totalArc;
            const rad = (angle * Math.PI) / 180;
            const isMajor = i % 4 === 0;
            const inner = isMajor ? 55 : 60;
            const outer2 = 68;
            const x1 = cx + inner * Math.cos(rad);
            const y1 = cy + inner * Math.sin(rad);
            const x2 = cx + outer2 * Math.cos(rad);
            const y2 = cy + outer2 * Math.sin(rad);
            ticks.push({ x1, y1, x2, y2, isMajor, pctTick });
          }

          // Speed color
          let speedColor = '#10b981';
          if (speed > 80) speedColor = '#f59e0b';
          if (speed > 120) speedColor = '#ef4444';

          return (
            <div style={{
              position: 'absolute',
              bottom: '20px',
              left: '320px',
              zIndex: 1002,
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.5)',
              borderRadius: '20px',
              padding: '12px 16px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              minWidth: '200px',
            }}>
              {/* Vehicle name */}
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#1f2937', textAlign: 'center', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {sv.name}
              </div>

              {/* SVG Speedometer */}
              <svg width="180" height="110" viewBox="0 0 180 110">
                {/* Background arc zones */}
                {/* Green zone: 0-80 (0-40%) */}
                <path d={arcPath(startAngle, startAngle + 0.4 * totalArc)} fill="none" stroke="rgba(16,185,129,0.25)" strokeWidth="10" strokeLinecap="butt" />
                {/* Yellow zone: 80-120 (40-60%) */}
                <path d={arcPath(startAngle + 0.4 * totalArc, startAngle + 0.6 * totalArc)} fill="none" stroke="rgba(245,158,11,0.25)" strokeWidth="10" strokeLinecap="butt" />
                {/* Red zone: 120-200 (60-100%) */}
                <path d={arcPath(startAngle + 0.6 * totalArc, startAngle + totalArc)} fill="none" stroke="rgba(239,68,68,0.25)" strokeWidth="10" strokeLinecap="butt" />

                {/* Active speed arc */}
                {speed > 0 && (
                  <path
                    d={arcPath(startAngle, needleAngle)}
                    fill="none"
                    stroke={speedColor}
                    strokeWidth="10"
                    strokeLinecap="butt"
                    style={{ transition: 'all 0.6s ease' }}
                  />
                )}

                {/* Tick marks */}
                {ticks.map((t, i) => (
                  <line
                    key={i}
                    x1={t.x1} y1={t.y1}
                    x2={t.x2} y2={t.y2}
                    stroke={t.pctTick > 0.6 ? '#ef4444' : t.pctTick > 0.4 ? '#f59e0b' : '#10b981'}
                    strokeWidth={t.isMajor ? 2 : 1}
                    opacity={0.7}
                  />
                ))}

                {/* Speed labels */}
                {[0, 50, 100, 150, 200].map((label, i) => {
                  const pctL = label / maxSpeed;
                  const ang = startAngle + pctL * totalArc;
                  const rad = (ang * Math.PI) / 180;
                  const lx = cx + 47 * Math.cos(rad);
                  const ly = cy + 47 * Math.sin(rad);
                  return (
                    <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                      fontSize="8" fontWeight="700" fill="#4b5563">
                      {label}
                    </text>
                  );
                })}

                {/* Needle */}
                <line
                  x1={cx} y1={cy}
                  x2={nx} y2={ny}
                  stroke={speedColor}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  style={{ transition: 'all 0.6s cubic-bezier(0.25, 0.8, 0.25, 1)' }}
                />
                {/* Needle base circle */}
                <circle cx={cx} cy={cy} r="5" fill="#1f2937" />
                <circle cx={cx} cy={cy} r="2.5" fill={speedColor} />
              </svg>

              {/* Speed readout */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '-8px' }}>
                <span style={{ fontSize: '28px', fontWeight: 900, color: speedColor, lineHeight: 1, fontVariantNumeric: 'tabular-nums', transition: 'color 0.4s', fontFamily: 'monospace' }}>
                  {speed}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280' }}>km/h</span>
              </div>
            </div>
          );
        })()}


        {currentSelectedVehicles.length > 0 && (
          <div style={{
            position: 'absolute', top: '52px', right: '12px', bottom: '12px',
            width: '260px', zIndex: 999, display: 'flex', flexDirection: 'column', gap: '12px',
            overflowY: 'auto', paddingBottom: '12px'
          }}>
            {currentSelectedVehicles.map(currentSelectedVehicle => (
              <div key={currentSelectedVehicle.id} style={{
                background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.6)',
                borderRadius: '16px', padding: '0',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                display: 'flex', flexDirection: 'column',
                flexShrink: 0
              }}>
                {/* Expiry Warning */}
                {(() => {
                  const warning = getExpiryWarning(currentSelectedVehicle);
                  if (!warning) return null;
                  const isExpired = warning.type === 'expired';
                  return (
                    <div style={{
                      background: isExpired ? '#FEF2F2' : '#FFFBEB',
                      borderBottom: `1px solid ${isExpired ? '#FECACA' : '#FDE68A'}`,
                      padding: '10px 14px',
                      display: 'flex', alignItems: 'center', gap: '8px',
                      borderRadius: '16px 16px 0 0'
                    }}>
                      <AlertTriangle size={16} color={isExpired ? '#EF4444' : '#F59E0B'} style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: '11px', fontWeight: 600, color: isExpired ? '#B91C1C' : '#D97706', lineHeight: 1.3 }}>
                        {warning.text}
                      </span>
                    </div>
                  );
                })()}

                {/* Card Header */}
                <div style={{
                  padding: '14px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  background: 'linear-gradient(135deg, #4d6076, #6e859b)',
                  borderRadius: getExpiryWarning(currentSelectedVehicle) ? '0' : '16px 16px 0 0', color: '#fff'
                }}>

                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700 }}>{currentSelectedVehicle.name}</div>
                    <div style={{ fontSize: '10px', opacity: 0.8, marginTop: '2px' }}>
                      {currentSelectedVehicle.plate || 'No plate'} • {currentSelectedVehicle.is_online ? 'Online' : 'Offline'}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedVehicles(prev => prev.filter(v => v.id !== currentSelectedVehicle.id));
                      setIsNearbyActive(false);
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
                      cursor: 'pointer', padding: '4px', borderRadius: '6px',
                      display: 'flex', alignItems: 'center'
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>

                {currentSelectedVehicles.length === 1 && (
                  <div style={{
                    padding: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center',
                    gap: '24px', borderBottom: '1px solid rgba(0,0,0,0.06)'
                  }}>
                    {/* Speed gauge */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ position: 'relative', width: '80px', height: '80px' }}>
                        <svg width="80" height="80" viewBox="0 0 100 100">
                          <path d="M 20 80 A 35 35 0 1 1 80 80" fill="none" stroke="#e5e7eb" strokeWidth="8" strokeLinecap="round" />
                          <path d="M 20 80 A 35 35 0 1 1 80 80" fill="none" stroke="#4d6076" strokeWidth="8" strokeLinecap="round"
                            strokeDasharray="165"
                            strokeDashoffset={165 - (Math.min(currentSelectedVehicle.current_speed || 0, 180) / 180) * 165}
                            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                          />
                          <text x="50" y="52" textAnchor="middle" fontSize="20" fontWeight="bold" fill="#1f2937">
                            {Math.round(currentSelectedVehicle.current_speed || 0)}
                          </text>
                          <text x="50" y="68" textAnchor="middle" fontSize="8" fontWeight="700" fill="#9ca3af">KM/H</text>
                        </svg>
                      </div>
                    </div>

                    {/* Fuel gauge */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ position: 'relative', width: '80px', height: '80px' }}>
                        <svg width="80" height="80" viewBox="0 0 100 100">
                          <path d="M 20 80 A 35 35 0 1 1 80 80" fill="none" stroke="#e5e7eb" strokeWidth="8" strokeLinecap="round" />
                          <path d="M 20 80 A 35 35 0 1 1 80 80" fill="none" stroke="#f59e0b" strokeWidth="8" strokeLinecap="round"
                            strokeDasharray="165"
                            strokeDashoffset={165 - Math.min((parseFloat(currentSelectedVehicle.current_fuel ?? 0) / 100), 1) * 165}
                            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                          />
                          <text x="50" y="52" textAnchor="middle" fontSize="20" fontWeight="bold" fill="#1f2937">
                            {Math.round(currentSelectedVehicle.current_fuel ?? 0)}
                          </text>
                          <text x="50" y="68" textAnchor="middle" fontSize="8" fontWeight="700" fill="#9ca3af">LITERS</text>
                        </svg>
                      </div>
                    </div>
                  </div>
                )}

                {/* Telemetry details */}
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  {[
                    { label: 'Speed', value: formatSpeed(currentSelectedVehicle.current_speed), icon: Activity, color: '#4d6076' },
                    ...(currentSelectedVehicles.length === 1 ? [
                      { label: 'Odometer', value: formatOdometer(currentSelectedVehicle.current_odometer), icon: Compass, color: '#4d6076' },
                      { label: 'Ignition', value: currentSelectedVehicle.current_ignition ? 'ON' : 'OFF', icon: Shield, color: currentSelectedVehicle.current_ignition ? '#10b981' : '#6b7280' },
                      { label: 'Fuel Level', value: formatFuel(currentSelectedVehicle.current_fuel), icon: BarChart2, color: '#f59e0b' },
                      { label: 'Voltage', value: formatVoltage(currentSelectedVehicle.current_voltage), icon: Cpu, color: '#8b5cf6' }
                    ] : []),
                    { label: 'Last Update', value: getRelativeTime(currentSelectedVehicle.last_seen), icon: Calendar, color: '#6b7280' },
                  ].map(item => (
                    <div key={item.label} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '6px 8px', borderRadius: '8px', background: '#f9fafb'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#6b7280' }}>
                        <item.icon size={12} color={item.color} />
                        <span>{item.label}</span>
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#1f2937' }}>{item.value}</span>
                    </div>
                  ))}

                  {/* Driver */}
                  {currentSelectedVehicle.driver_name && currentSelectedVehicles.length === 1 && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '6px 8px', borderRadius: '8px', background: '#f9fafb',
                      fontSize: '11px', color: '#6b7280'
                    }}>
                      <User size={12} color="#4d6076" />
                      <span>{currentSelectedVehicle.driver_name}</span>
                      {currentSelectedVehicle.driver_phone && (
                        <>
                          <span style={{ color: '#d1d5db' }}>•</span>
                          <Phone size={10} color="#9ca3af" />
                          <span style={{ fontSize: '10px' }}>{currentSelectedVehicle.driver_phone}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                {currentSelectedVehicles.length === 1 && (
                  <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <button
                      onClick={() => navigate(`/vehicles/${currentSelectedVehicle.id}`)}
                      style={{
                        padding: '9px', borderRadius: '10px', border: 'none',
                        background: 'linear-gradient(135deg, #4d6076, #6e859b)',
                        color: '#fff', fontWeight: 600, fontSize: '12px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                      Device Details <ChevronRight size={14} />
                    </button>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => navigate(`/vehicles/${currentSelectedVehicle.id}/history`)}
                        style={{
                          flex: 1, padding: '7px', borderRadius: '8px',
                          border: '1px solid #e5e7eb', background: '#fff',
                          color: '#374151', fontWeight: 600, fontSize: '11px', cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                      >History</button>
                      <button
                        onClick={() => navigate(`/vehicles/${currentSelectedVehicle.id}/report`)}
                        style={{
                          flex: 1, padding: '7px', borderRadius: '8px',
                          border: '1px solid #e5e7eb', background: '#fff',
                          color: '#374151', fontWeight: 600, fontSize: '11px', cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                      >Reports</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Nearby Vehicles Floating Panel ── */}
        {isNearbyActive && currentSelectedVehicles.length === 1 && (
          <div style={{
            position: 'absolute',
            top: '84px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '320px',
            maxHeight: '400px',
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.8)',
            borderRadius: '24px',
            padding: '16px',
            zIndex: 1002,
            boxShadow: '0 12px 48px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#1f2937', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={16} color="#3b82f6" />
                Nearby Vehicles
              </div>
              <button 
                onClick={() => setIsNearbyActive(false)}
                style={{ background: 'rgba(0,0,0,0.05)', borderRadius: '50%', padding: '4px', border: 'none', cursor: 'pointer', color: '#6b7280', display: 'flex' }}
              >
                <X size={14} />
              </button>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#4b5563', marginBottom: '6px' }}>
                <span style={{ fontWeight: 600 }}>Search Radius</span>
                <span style={{ fontWeight: 800, color: '#3b82f6', background: 'rgba(59,130,246,0.1)', padding: '2px 8px', borderRadius: '12px' }}>{nearbyRadius} km</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="50" 
                value={nearbyRadius} 
                onChange={(e) => setNearbyRadius(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer', accentColor: '#3b82f6' }}
              />
            </div>

            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
              {nearbyVehiclesList.length === 0 ? (
                <div style={{ fontSize: '13px', color: '#6b7280', textAlign: 'center', padding: '30px 0', fontWeight: 600 }}>
                  No vehicles found within {nearbyRadius} km.
                </div>
              ) : (
                nearbyVehiclesList.map(v => (
                  <div key={v.id} style={{
                    background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
                    borderRadius: '16px', padding: '12px', display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                  onClick={() => handleVehicleSelect(v)}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#1f2937' }}>{v.name}</span>
                      <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>{v.plate || 'No plate'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 900, color: '#3b82f6' }}>
                        {v.distanceToTarget < 1 ? `${Math.round(v.distanceToTarget * 1000)} m` : `${v.distanceToTarget.toFixed(1)} km`}
                      </span>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: v.is_online ? '#10b981' : '#9ca3af' }}>
                        {v.is_online ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Floating "No Vehicle" hint (bottom-center, only when nothing selected) ── */}
        {currentSelectedVehicles.length === 0 && (
          <div style={{
            position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
            zIndex: 999, background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(8px)',
            borderRadius: '12px', padding: '10px 20px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            display: 'flex', alignItems: 'center', gap: '8px',
            border: '1px solid rgba(255,255,255,0.6)'
          }}>
            <MapPin size={16} color="#f97316" />
            <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>
              Select a vehicle to view live telemetry
            </span>
          </div>
        )}
      </div>

      {/* ═══ Scrollbar & animation CSS ═══ */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .tracking-scroll::-webkit-scrollbar { width: 4px; }
        .tracking-scroll::-webkit-scrollbar-track { background: transparent; }
        .tracking-scroll::-webkit-scrollbar-thumb { background-color: #d1d5db; border-radius: 4px; }
        .tracking-scroll::-webkit-scrollbar-thumb:hover { background-color: #9ca3af; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}} />
    </div>
  );
};

export default TrackingPage;
