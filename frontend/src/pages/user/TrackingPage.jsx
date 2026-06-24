import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, MapPin, Activity, Compass, User, Phone, Shield, Cpu, RefreshCw, BarChart2, AlertCircle, Calendar, X, ChevronRight, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useVehicles } from '../../hooks/useVehicles';
import FleetMap from '../../components/map/FleetMap';
import { formatSpeed, formatFuel, formatVoltage, formatOdometer } from '../../utils/formatUtils';
import { getRelativeTime } from '../../utils/dateUtils';

const getExpiryWarning = (expireDateStr) => {
  if (!expireDateStr) return null;
  const exp = new Date(expireDateStr);
  const now = new Date();
  const diffTime = exp.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return { type: 'expired', text: `Licence expired on ${exp.toLocaleDateString('en-GB')}. Please renew.` };
  } else if (diffDays <= 4) {
    return { type: 'expiring', text: `Licence expiring on ${exp.toLocaleDateString('en-GB')}. Please renew.` };
  }
  return null;
};

const TrackingPage = ({ setAppVehicles }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { vehicles, groups, loading, error, refetch } = useVehicles();
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [hasSelectedInitial, setHasSelectedInitial] = useState(false);

  useEffect(() => {
    if (!hasSelectedInitial && location.state?.selectedVehicleId && vehicles?.length > 0) {
      const v = vehicles.find(v => String(v.id) === String(location.state.selectedVehicleId));
      if (v) {
        setSelectedVehicle(v);
        setHasSelectedInitial(true);
      }
    }
  }, [location.state, vehicles, hasSelectedInitial]);

  useEffect(() => {
    if (vehicles && setAppVehicles) {
      setAppVehicles(vehicles);
    }
  }, [vehicles, setAppVehicles]);

  const currentSelectedVehicle = useMemo(() => {
    if (!selectedVehicle) return null;
    return vehicles.find(v => v.id === selectedVehicle.id) || selectedVehicle;
  }, [vehicles, selectedVehicle]);

  const metrics = useMemo(() => {
    let running = 0, idle = 0, parked = 0, offline = 0;
    vehicles.forEach(v => {
      const isOnline = !!v.is_online;
      const speed = v.current_speed || 0;
      const ignition = !!v.current_ignition;
      if (!isOnline) offline++;
      else if (speed > 0) running++;
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
        if (statusFilter === 'running') return isOnline && speed > 0;
        if (statusFilter === 'idle') return isOnline && speed === 0 && ignition;
        if (statusFilter === 'parked') return isOnline && speed === 0 && !ignition;
        if (statusFilter === 'offline') return !isOnline;
      }
      return true;
    });
  }, [vehicles, statusFilter]);

  const handleSelectVehicle = (vehicle) => {
    setSelectedVehicle(prev => prev?.id === vehicle.id ? null : vehicle);
  };

  const handleStatusFilterToggle = (filterType) => {
    setStatusFilter(prev => prev === filterType ? null : filterType);
  };

  const handleClearFilters = () => {
    setStatusFilter(null);
  };

  const getVehicleStatus = (v) => {
    const isOnline = !!v.is_online;
    const speed = v.current_speed || 0;
    const ignition = !!v.current_ignition;
    if (!isOnline) return { text: 'Offline', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' };
    if (speed > 0) return { text: 'Running', color: '#10b981', bg: 'rgba(16,185,129,0.1)' };
    if (ignition) return { text: 'Idle', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
    return { text: 'Parked', color: '#f97316', bg: 'rgba(249,115,22,0.1)' };
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      height: 'calc(100vh - 56px)',
      background: '#f0f2f5',
      overflow: 'hidden',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
    }}>

      {/* ═══════════ LEFT PANEL: Vehicle List ═══════════ */}
      <div style={{
        width: '300px',
        background: '#ffffff',
        borderRight: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        height: '100%',
        boxShadow: '2px 0 12px rgba(0,0,0,0.04)'
      }}>
        {/* Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid #f3f4f6' }}>
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
                background: '#f9fafb', border: '1px solid #e5e7eb', color: '#6b7280',
                cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '6px',
                borderRadius: '8px', transition: 'all 0.2s', marginTop: '2px'
              }}
              title="Refresh"
              onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#374151'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.color = '#6b7280'; }}
            >
              <RefreshCw size={14} />
            </button>
          </div>

          {statusFilter && (
            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={handleClearFilters} style={{
                padding: '5px 10px', borderRadius: '6px', border: '1px solid #e5e7eb',
                background: '#f9fafb', color: '#6b7280', fontSize: '10px', fontWeight: 600,
                cursor: 'pointer'
              }}>Clear Filter</button>
            </div>
          )}
        </div>

        {/* Vehicle List */}
        <div className="tracking-scroll" style={{
          flex: 1, overflowY: 'auto', padding: '8px',
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
              const isSelected = currentSelectedVehicle?.id === v.id;
              const status = getVehicleStatus(v);

              return (
                <div
                  key={v.id}
                  onClick={() => handleSelectVehicle(v)}
                  title={getExpiryWarning(v.licence_expire_date) ? getExpiryWarning(v.licence_expire_date).text : undefined}
                  style={{
                    background: isSelected ? 'linear-gradient(135deg, #4d6076, #6e859b)' : '#ffffff',
                    border: `1px solid ${isSelected ? 'transparent' : '#f3f4f6'}`,
                    borderRadius: '10px',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                  onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = '#e5e7eb'; } }}
                  onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#f3f4f6'; } }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: isSelected ? '#fff' : '#1f2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
          selectedVehicle={currentSelectedVehicle}
          onMarkerClick={handleSelectVehicle}
        />

        {/* ── Floating Status Pills (top-right of map) ── */}
        <div style={{
          position: 'absolute', top: '12px', right: '12px', zIndex: 1000,
          display: 'flex', gap: '6px', flexWrap: 'wrap'
        }}>
          {[
            { type: 'running', label: 'Running', count: metrics.running, color: '#10b981' },
            { type: 'idle', label: 'Idle', count: metrics.idle, color: '#f59e0b' },
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

        {/* ── Floating Vehicle Detail Card (right side of map) ── */}
        {currentSelectedVehicle && (
          <div style={{
            position: 'absolute', top: '52px', right: '12px', bottom: '12px',
            width: '260px', zIndex: 999,
            background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.6)',
            borderRadius: '16px', padding: '0',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            display: 'flex', flexDirection: 'column',
            overflowY: 'auto'
          }}>
            {/* Expiry Warning */}
            {(() => {
              const warning = getExpiryWarning(currentSelectedVehicle.licence_expire_date);
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
              borderRadius: getExpiryWarning(currentSelectedVehicle.licence_expire_date) ? '0' : '16px 16px 0 0', color: '#fff'
            }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>{currentSelectedVehicle.name}</div>
                <div style={{ fontSize: '10px', opacity: 0.8, marginTop: '2px' }}>
                  {currentSelectedVehicle.plate || 'No plate'} • {currentSelectedVehicle.is_online ? 'Online' : 'Offline'}
                </div>
              </div>
              <button
                onClick={() => setSelectedVehicle(null)}
                style={{
                  background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
                  cursor: 'pointer', padding: '4px', borderRadius: '6px',
                  display: 'flex', alignItems: 'center'
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Speedometer mini gauge */}
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
                      strokeDashoffset={165 - (parseFloat(currentSelectedVehicle.current_fuel ?? 0) / 100) * 165}
                      style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                    />
                    <text x="50" y="52" textAnchor="middle" fontSize="20" fontWeight="bold" fill="#1f2937">
                      {Math.round(currentSelectedVehicle.current_fuel ?? 0)}
                    </text>
                    <text x="50" y="68" textAnchor="middle" fontSize="8" fontWeight="700" fill="#9ca3af">FUEL %</text>
                  </svg>
                </div>
              </div>
            </div>

            {/* Telemetry details */}
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
              {[
                { label: 'Speed', value: formatSpeed(currentSelectedVehicle.current_speed), icon: Activity, color: '#4d6076' },
                { label: 'Odometer', value: formatOdometer(currentSelectedVehicle.current_odometer), icon: Compass, color: '#4d6076' },
                { label: 'Ignition', value: currentSelectedVehicle.current_ignition ? 'ON' : 'OFF', icon: Shield, color: currentSelectedVehicle.current_ignition ? '#10b981' : '#6b7280' },
                { label: 'Fuel Level', value: formatFuel(currentSelectedVehicle.current_fuel), icon: BarChart2, color: '#f59e0b' },
                { label: 'Voltage', value: formatVoltage(currentSelectedVehicle.current_voltage), icon: Cpu, color: '#8b5cf6' },
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
              {currentSelectedVehicle.driver_name && (
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
          </div>
        )}

        {/* ── Floating "No Vehicle" hint (bottom-center, only when nothing selected) ── */}
        {!currentSelectedVehicle && (
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
