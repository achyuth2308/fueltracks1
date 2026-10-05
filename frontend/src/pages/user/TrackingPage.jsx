import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, MapPin, Activity, Compass, User, Phone, Shield, Cpu, RefreshCw, BarChart2, AlertCircle, Calendar, X, ChevronRight, AlertTriangle, Navigation } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import { useVehicles } from '../../hooks/useVehicles';
import FleetMap from '../../components/map/FleetMap';
import { formatSpeed, formatFuel, formatVoltage, formatOdometer, formatDirection } from '../../utils/formatUtils';
import { getRelativeTime, getVehicleExpiryStatus, formatLocalDate } from '../../utils/dateUtils';
import { getAddressFromCoordinates } from '../../utils/geocodeUtils';
import { getDistance } from '../../utils/mapUtils';
import { getVehicleStatus, STATUS_CONFIG } from '../../utils/markerUtils';
import * as vehicleApi from '../../api/vehicleApi';

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

const formatCardTimestamp = (isoString) => {
  if (!isoString) return new Date().toISOString().slice(0, 19).replace('T', ' ');
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return String(isoString);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
  } catch (e) {
    return String(isoString);
  }
};


const TrackingPage = ({ setAppVehicles }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    if (user && (user.role === 'superadmin' || user.role === 'dealer')) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const { vehicles, groups, loading, error, refetch } = useVehicles();
  const [selectedVehicles, setSelectedVehicles] = useState([]);
  const [statusFilter, setStatusFilter] = useState(null);
  const [expiredModalVehicle, setExpiredModalVehicle] = useState(null);
  const [hasSelectedInitial, setHasSelectedInitial] = useState(false);
  const [hoveredVehicleId, setHoveredVehicleId] = useState(null);
  const [hoverPosY, setHoverPosY] = useState(12);
  const [hoveredVehicleAddress, setHoveredVehicleAddress] = useState(null);
  const hoveredVehicle = useMemo(() => vehicles.find(v => v.id === hoveredVehicleId), [vehicles, hoveredVehicleId]);

  // Nearby Vehicles State
  const [isNearbyActive, setIsNearbyActive] = useState(false);
  const [nearbyRadius, setNearbyRadius] = useState(10); // in km

  const [liveRouteMetrics, setLiveRouteMetrics] = useState({});

  const fetchTodayMetrics = async () => {
    try {
      const json = await vehicleApi.getTodayMetrics();
      if (json.success) {
        setLiveRouteMetrics(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch today metrics', err);
    }
  };

  useEffect(() => {
    fetchTodayMetrics();
    const interval = setInterval(fetchTodayMetrics, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

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
      setAppVehicles(prev => {
        if (!prev || prev.length !== vehicles.length) return vehicles;
        const prevOnline = prev.filter(v => v.is_online).length;
        const currOnline = vehicles.filter(v => v.is_online).length;
        if (prevOnline !== currOnline) return vehicles;
        return prev;
      });
    }
  }, [vehicles, setAppVehicles]);

  const currentSelectedVehicles = useMemo(() => {
    return selectedVehicles.map(sv => vehicles.find(v => v.id === sv.id) || sv);
  }, [vehicles, selectedVehicles]);

  const metrics = useMemo(() => {
    let running = 0, idle = 0, parked = 0, offline = 0;
    vehicles.forEach(v => {
      const status = getVehicleStatus(v);
      if (status === 'running') running++;
      else if (status === 'idle') idle++;
      else if (status === 'parked') parked++;
      else if (status === 'offline') offline++;
    });
    return { running, idle, parked, offline, total: vehicles.length };
  }, [vehicles]);

  const [searchQuery, setSearchQuery] = useState('');

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      if (statusFilter && getVehicleStatus(v) !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (v.name || '').toLowerCase().includes(q) ||
               (v.plate || '').toLowerCase().includes(q) ||
               (v.driver_name || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [vehicles, statusFilter, searchQuery]);

  const handleVehicleSelect = (vehicle) => {
    const warning = getExpiryWarning(vehicle);
    if (warning && warning.type === 'expired') {
      setExpiredModalVehicle(vehicle);
      return;
    }
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

      {/* ── Middle Expired License Modal ── */}
      <AnimatePresence>
        {expiredModalVehicle && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              style={{
                background: '#FFFFFF',
                borderRadius: '16px',
                padding: '28px 24px 24px 24px',
                maxWidth: '420px',
                width: '100%',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                textAlign: 'center',
                position: 'relative',
                border: '1px solid #FECACA'
              }}
            >
              <button
                onClick={() => setExpiredModalVehicle(null)}
                style={{
                  position: 'absolute',
                  top: '14px', right: '14px',
                  background: '#F1F5F9', border: 'none',
                  width: '30px', height: '30px', borderRadius: '50%',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#64748B'
                }}
              >
                <X size={16} />
              </button>

              <div style={{
                width: '56px', height: '56px', borderRadius: '50%',
                background: '#FEF2F2', border: '2px solid #FECACA',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <AlertTriangle size={28} color="#EF4444" />
              </div>

              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#991B1B', margin: '0 0 8px' }}>
                License Expired
              </h3>

              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B', marginBottom: '12px' }}>
                Vehicle: <span style={{ color: '#DC2626' }}>{expiredModalVehicle.name}</span>
              </div>

              <p style={{ fontSize: '14px', color: '#B91C1C', lineHeight: '1.5', margin: '0 0 20px', fontWeight: 700, background: '#FEF2F2', padding: '10px 14px', borderRadius: '8px', border: '1px solid #FECACA' }}>
                Your license has expired. Please contact sales team or renew yourself
              </p>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button
                  onClick={() => {
                    setExpiredModalVehicle(null);
                    navigate('/renewals');
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    background: '#DC2626',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)'
                  }}
                >
                  Renew License
                </button>
                <button
                  onClick={() => setExpiredModalVehicle(null)}
                  style={{
                    padding: '10px 16px',
                    background: '#F1F5F9',
                    color: '#475569',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Hover Tooltip Card (Matching Reference Legacy Layout) ── */}
      {hoveredVehicle && (
        <div style={{
          position: 'absolute',
          top: `${hoverPosY}px`,
          left: '320px',
          width: '360px',
          background: 'rgba(241, 245, 249, 0.88)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(203, 213, 225, 0.8)',
          borderRadius: '8px',
          padding: '8px 12px',
          zIndex: 1001,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          pointerEvents: 'none',
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          fontSize: '11px'
        }}>
          {/* Header Bar: Timestamp on left, Vehicle Name on right */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
            borderBottom: '1px solid rgba(203, 213, 225, 0.8)',
            paddingBottom: '4px',
            color: '#64748b',
            fontSize: '11px',
            fontWeight: 600
          }}>
            <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>{formatCardTimestamp(hoveredVehicle.last_seen)}</span>
            <span style={{ color: '#0f172a', fontWeight: 800, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hoveredVehicle.name}</span>
          </div>

          {/* Expiry Warning if applicable */}
          {(() => {
            const warning = getExpiryWarning(hoveredVehicle);
            if (!warning) return null;
            const isExpired = warning.type === 'expired';
            return (
              <div style={{
                background: isExpired ? 'rgba(254, 242, 242, 0.9)' : 'rgba(255, 251, 235, 0.9)',
                border: `1px solid ${isExpired ? '#fecaca' : '#fde68a'}`,
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '10px',
                fontWeight: 700,
                color: isExpired ? '#b91c1c' : '#d97706'
              }}>
                ⚠️ {warning.text}
              </div>
            );
          })()}

          {/* Table Grid matching Image 2 */}
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', lineHeight: '1.6' }}>
            <tbody>
              <tr>
                <td style={{ color: '#64748b', padding: '2px 0', width: '28%' }}>Odo (Kms)</td>
                <td style={{ color: '#0f172a', fontWeight: 700, padding: '2px 0', width: '22%' }}>
                  {Math.round(liveRouteMetrics[hoveredVehicle.id]?.dynamicOdo || hoveredVehicle.current_odometer || 0).toLocaleString()}
                </td>
                <td style={{ color: '#64748b', padding: '2px 0', width: '28%' }}>Covered (Kms)</td>
                <td style={{ color: '#0f172a', fontWeight: 700, padding: '2px 0', width: '22%' }}>
                  {liveRouteMetrics[hoveredVehicle.id]?.cDist !== undefined ? Number(liveRouteMetrics[hoveredVehicle.id].cDist).toFixed(2) : (Number(hoveredVehicle.today_distance) || 0).toFixed(2)}
                </td>
              </tr>
              <tr>
                <td style={{ color: '#64748b', padding: '2px 0' }}>Ignition</td>
                <td style={{ color: hoveredVehicle.current_ignition ? '#16a34a' : '#ef4444', fontWeight: 700, padding: '2px 0' }}>
                  {hoveredVehicle.current_ignition ? 'ON' : 'OFF'}
                </td>
                <td style={{ color: '#64748b', padding: '2px 0' }}>Max Speed (Kms)</td>
                <td style={{ color: '#0f172a', fontWeight: 700, padding: '2px 0' }}>
                  {liveRouteMetrics[hoveredVehicle.id]?.maxSpeed !== undefined
                    ? liveRouteMetrics[hoveredVehicle.id].maxSpeed
                    : (hoveredVehicle.max_speed || (hoveredVehicle.current_speed ? Math.round(hoveredVehicle.current_speed) : 0))}
                </td>
              </tr>
              <tr>
                <td style={{ color: '#64748b', padding: '2px 0' }}>Veh Battery</td>
                <td style={{ color: '#0f172a', fontWeight: 700, padding: '2px 0' }}>
                  {formatVoltage(hoveredVehicle.current_voltage || hoveredVehicle.metadata?.batteryVoltage)}
                </td>
                <td style={{ color: '#64748b', padding: '2px 0' }}>Speed (Kms)</td>
                <td style={{ color: '#0f172a', fontWeight: 700, padding: '2px 0' }}>
                  {Math.round(hoveredVehicle.current_speed || 0)}
                </td>
              </tr>
              <tr>
                <td style={{ color: '#64748b', padding: '2px 0' }}>Dev Battery</td>
                <td style={{ color: '#0f172a', fontWeight: 700, padding: '2px 0' }}>
                  {(() => {
                    const b = hoveredVehicle.current_battery ?? hoveredVehicle.battery ?? hoveredVehicle.metadata?.devBattery ?? hoveredVehicle.dev_battery ?? hoveredVehicle.device_battery;
                    return b !== undefined && b !== null ? `${b}%` : 'N/A';
                  })()}
                </td>
                <td style={{ color: '#64748b', padding: '2px 0' }}>Direction</td>
                <td style={{ color: '#0f172a', fontWeight: 700, padding: '2px 0' }}>
                  {formatDirection(hoveredVehicle.current_direction)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Location Address */}
          <div style={{
            borderTop: '1px solid rgba(203, 213, 225, 0.8)',
            paddingTop: '4px',
            color: '#475569',
            fontSize: '10px',
            lineHeight: '1.4'
          }}>
            {hoveredVehicleAddress || 'Location unavailable'}
          </div>
        </div>
      )}

      {/* ═══════════ LEFT PANEL: Vehicle List (Docked seamlessly matching Image 2) ═══════════ */}
      <div style={{
        width: '310px',
        height: '100%',
        background: '#FFFFFF',
        borderRight: '1px solid #E2E8F0',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10,
        flexShrink: 0
      }}>
        {/* Header Section */}
        <div style={{ padding: '14px 14px 10px 14px', borderBottom: '1px solid #F1F5F9', background: '#FFFFFF' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div>
              <h2 style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                Fleet Vehicles
              </h2>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, marginTop: '2px' }}>
                {filteredVehicles.length} vehicles
              </div>
            </div>
            <button
              onClick={() => refetch()}
              style={{
                background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B',
                cursor: 'pointer', padding: '5px', borderRadius: '6px', display: 'flex', alignItems: 'center', transition: 'all 0.2s'
              }}
              title="Refresh"
              onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#0F172A'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.color = '#64748B'; }}
            >
              <RefreshCw size={13} />
            </button>
          </div>

          {/* Search vehicle input */}
          <div style={{ position: 'relative', width: '100%', marginBottom: '8px' }}>
            <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search vehicle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px 6px 30px',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                background: '#F8FAFC',
                fontSize: '12px',
                outline: 'none',
                color: '#0F172A',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Status Filter Badges */}
          <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '2px' }}>
            {[
              { key: null, label: `All ${vehicles.length}` },
              { key: 'running', label: `Running ${metrics.running}`, color: '#10B981' },
              { key: 'idle', label: `Idle ${metrics.idle}`, color: '#F59E0B' },
              { key: 'offline', label: `Offline ${metrics.offline}`, color: '#EF4444' },
            ].map(pill => {
              const active = statusFilter === pill.key;
              const isAllPill = pill.key === null;
              return (
                <button
                  key={pill.key || 'all'}
                  onClick={() => setStatusFilter(pill.key)}
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: '14px',
                    border: active ? (isAllPill ? '1px solid #0F172A' : '1px solid #0EA5E9') : '1px solid #E2E8F0',
                    background: active ? (isAllPill ? '#0F172A' : '#E0F2FE') : '#F8FAFC',
                    color: active ? (isAllPill ? '#FFFFFF' : '#0284C7') : (pill.color || '#475569'),
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {pill.color && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: pill.color }} />}
                  {pill.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Vehicle List */}
        <div className="tracking-scroll" style={{
          overflowY: 'auto', padding: '0',
          display: 'flex', flexDirection: 'column', flex: 1
        }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '30px', gap: '8px', opacity: 0.7 }}>
              <RefreshCw size={18} color="#0EA5E9" className="animate-spin" />
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>Loading vehicles...</span>
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px', textAlign: 'center' }}>
              <AlertCircle size={24} color="#94A3B8" style={{ marginBottom: '8px' }} />
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>
                {vehicles.length === 0 ? 'No vehicles assigned' : 'No vehicles match search'}
              </span>
            </div>
          ) : (
            filteredVehicles.map(v => {
              const warning = getExpiryWarning(v);
              const isExpired = warning && warning.type === 'expired';
              const isSelected = currentSelectedVehicles.some(sv => sv.id === v.id);
              const statusKey = getVehicleStatus(v);
              const statusColorsMap = { running: '#10B981', idle: '#F59E0B', parked: '#64748B', offline: '#EF4444', unavailable: '#94A3B8' };
              const statusLabelsMap = { running: 'Running', idle: 'Idle', parked: 'Parked', offline: 'Offline', unavailable: 'No Data' };
              const sc = isExpired ? '#DC2626' : (statusColorsMap[statusKey] || '#94A3B8');
              const labelText = isExpired ? 'EXPIRED' : (statusLabelsMap[statusKey] || 'No Data');
              const isVan = (v.name || '').toLowerCase().includes('van');

              return (
                <div
                  key={v.id}
                  onClick={() => handleVehicleSelect(v)}
                  title={warning ? warning.text : undefined}
                  style={{
                    background: isExpired ? '#FEF2F2' : (isSelected ? '#F0F9FF' : '#FFFFFF'),
                    borderBottom: isExpired ? '1px solid #FECACA' : (isSelected ? '1px solid #BAE6FD' : '1px solid #F1F5F9'),
                    borderLeft: isExpired ? '4px solid #DC2626' : (isSelected ? '4px solid #0EA5E9' : '4px solid transparent'),
                    padding: '12px 14px',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px'
                  }}
                  onMouseEnter={e => {
                    setHoveredVehicleId(v.id);
                    const containerRect = e.currentTarget.closest('.tracking-container')?.getBoundingClientRect() || { top: 0, height: 1000 };
                    const itemRect = e.currentTarget.getBoundingClientRect();
                    setHoverPosY(Math.max(12, Math.min(itemRect.top - containerRect.top, containerRect.height - 350)));
                    if (!isSelected && !isExpired) e.currentTarget.style.background = '#F8FAFC';
                    if (isExpired) e.currentTarget.style.background = '#FEE2E2';
                  }}
                  onMouseLeave={e => {
                    setHoveredVehicleId(null);
                    if (!isSelected && !isExpired) e.currentTarget.style.background = '#FFFFFF';
                    if (isExpired) e.currentTarget.style.background = '#FEF2F2';
                  }}
                >
                  {/* Vehicle Graphic */}
                  <div style={{
                    width: '38px',
                    height: '38px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {isVan ? (
                      <svg width="34" height="26" viewBox="0 0 48 36" fill="none">
                        <path d="M6 16C6 13.5 8 11 11 11H28L36 16V26H6V16Z" fill={isExpired ? '#FEE2E2' : '#F1F5F9'} stroke={isExpired ? '#DC2626' : '#64748B'} strokeWidth="2"/>
                        <path d="M28 11L36 16H42C43.1 16 44 16.9 44 18V26H36V16L28 11Z" fill={isExpired ? '#FCA5A5' : '#E2E8F0'} stroke={isExpired ? '#B91C1C' : '#475569'} strokeWidth="2"/>
                        <circle cx="14" cy="27" r="4" fill={isExpired ? '#7F1D1D' : '#334155'}/>
                        <circle cx="34" cy="27" r="4" fill={isExpired ? '#7F1D1D' : '#334155'}/>
                        <rect x="10" y="14" width="8" height="5" rx="1" fill={isExpired ? '#EF4444' : '#94A3B8'}/>
                      </svg>
                    ) : (
                      <svg width="34" height="26" viewBox="0 0 48 36" fill="none">
                        <rect x="4" y="10" width="24" height="15" rx="2" fill={isExpired ? '#DC2626' : (isSelected ? '#0EA5E9' : '#0284C7')} stroke={isExpired ? '#991B1B' : '#0369A1'} strokeWidth="1.5"/>
                        <path d="M28 13H36L42 19V25H28V13Z" fill={isExpired ? '#EF4444' : (isSelected ? '#38BDF8' : '#0EA5E9')} stroke={isExpired ? '#B91C1C' : '#0284C7'} strokeWidth="1.5"/>
                        <circle cx="12" cy="26" r="4" fill={isExpired ? '#7F1D1D' : '#1E293B'}/>
                        <circle cx="34" cy="26" r="4" fill={isExpired ? '#7F1D1D' : '#1E293B'}/>
                      </svg>
                    )}
                  </div>

                  {/* Middle Details - ALL RED TEXT WHEN EXPIRED */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: isExpired ? '#B91C1C' : '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {v.name}
                    </div>
                    <div style={{ fontSize: '11px', color: isExpired ? '#DC2626' : '#64748B', fontWeight: isExpired ? 600 : 400, marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {v.plate || v.name}
                    </div>
                    <div style={{ fontSize: '10px', color: isExpired ? '#EF4444' : '#94A3B8', fontWeight: isExpired ? 600 : 400, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <span>{formatSpeed(v.current_speed)}</span>
                      <span>·</span>
                      <span>{v.last_seen ? getRelativeTime(v.last_seen) : 'No GPS data'}</span>
                    </div>
                  </div>

                  {/* Right Status Dot & Arrow - ALL RED WHEN EXPIRED */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 700, color: isExpired ? '#DC2626' : sc }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isExpired ? '#DC2626' : sc }} />
                      <span>{labelText}</span>
                    </div>
                    <ChevronRight size={14} color={isExpired ? '#DC2626' : '#94A3B8'} />
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
          liveRouteMetrics={liveRouteMetrics}
        />

        {/* ── Floating Status Pills (top-right of map) ── */}
        <div style={{
          position: 'absolute', top: '12px', right: '12px', zIndex: 1000,
          display: 'flex', gap: '6px', flexWrap: 'wrap'
        }}>
          {[
            { type: 'running', label: 'Running', count: metrics.running, color: '#10b981' },
            { type: 'idle', label: 'Idle', count: metrics.idle, color: '#eab308' },
            { type: 'parked', label: 'Parked', count: metrics.parked, color: '#64748B' },
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
          <div className="tracking-scroll" style={{
            position: 'absolute', top: '54px', right: '12px', bottom: '12px',
            width: '270px', zIndex: 1000, display: 'flex', flexDirection: 'column',
            overflowY: 'auto', paddingBottom: '12px'
          }}>
            {currentSelectedVehicles.map(currentSelectedVehicle => (
              <div key={currentSelectedVehicle.id} style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '14px',
                padding: '0',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
                overflow: 'hidden'
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
                      padding: '8px 12px',
                      display: 'flex', alignItems: 'center', gap: '8px'
                    }}>
                      <AlertTriangle size={15} color={isExpired ? '#EF4444' : '#F59E0B'} style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: '11px', fontWeight: 600, color: isExpired ? '#B91C1C' : '#D97706', lineHeight: 1.3 }}>
                        {warning.text}
                      </span>
                    </div>
                  );
                })()}

                {/* Card Header */}
                <div style={{
                  padding: '12px 14px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'linear-gradient(135deg, #0F172A, #1E293B)',
                  color: '#FFFFFF'
                }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800 }}>{currentSelectedVehicle.name}</div>
                    <div style={{ fontSize: '10px', opacity: 0.8, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>{currentSelectedVehicle.plate || currentSelectedVehicle.name}</span>
                      <span>•</span>
                      <span style={{ fontWeight: 700, color: currentSelectedVehicle.is_online ? '#4ADE80' : '#F87171' }}>
                        {currentSelectedVehicle.is_online ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedVehicles(prev => prev.filter(v => v.id !== currentSelectedVehicle.id));
                      setIsNearbyActive(false);
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
                      cursor: 'pointer', width: '24px', height: '24px', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Telemetry details continuous list (No card background boxes, edge-to-edge dividers) */}
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: '#FFFFFF' }}>
                  {[
                    { label: 'Speed', value: formatSpeed(currentSelectedVehicle.current_speed), icon: Activity, color: '#0EA5E9' },
                    ...(currentSelectedVehicles.length === 1 ? [
                      { label: 'Odometer', value: formatOdometer(liveRouteMetrics[currentSelectedVehicle.id]?.dynamicOdo || currentSelectedVehicle.current_odometer), icon: Compass, color: '#64748B' },
                      { label: 'Ignition', value: currentSelectedVehicle.current_ignition ? 'ON' : 'OFF', icon: Shield, color: currentSelectedVehicle.current_ignition ? '#10B981' : '#64748B' },
                      { label: 'Fuel Level', value: formatFuel(currentSelectedVehicle.current_fuel), icon: BarChart2, color: '#F59E0B' },
                      { label: 'Voltage', value: formatVoltage(currentSelectedVehicle.current_voltage || currentSelectedVehicle.metadata?.batteryVoltage), icon: Cpu, color: '#8B5CF6' }
                    ] : []),
                    { label: 'Last Update', value: getRelativeTime(currentSelectedVehicle.last_seen), icon: Calendar, color: '#64748B' },
                  ].map(item => (
                    <div key={item.label} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '9px 14px', borderBottom: '1px solid #F1F5F9'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#64748B', fontWeight: 600 }}>
                        <item.icon size={13} color={item.color} />
                        <span>{item.label}</span>
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#0F172A' }}>{item.value}</span>
                    </div>
                  ))}

                  {/* Driver Row */}
                  {currentSelectedVehicle.driver_name && currentSelectedVehicles.length === 1 && (
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '9px 14px', borderBottom: '1px solid #F1F5F9',
                      fontSize: '11px', color: '#64748B', fontWeight: 600
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <User size={13} color="#0EA5E9" />
                        <span>Driver</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 700, color: '#0F172A' }}>{currentSelectedVehicle.driver_name}</span>
                        {currentSelectedVehicle.driver_phone && (
                          <a href={`tel:${currentSelectedVehicle.driver_phone}`} style={{ color: '#0284C7', display: 'flex', alignItems: 'center', gap: '2px', textDecoration: 'none' }}>
                            <Phone size={10} color="#0284C7" />
                            <span style={{ fontSize: '10px' }}>{currentSelectedVehicle.driver_phone}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Action Buttons */}
                {currentSelectedVehicles.length === 1 && (
                  <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '6px', background: '#FFFFFF' }}>
                    <button
                      onClick={() => navigate(`/vehicles/${currentSelectedVehicle.id}`)}
                      style={{
                        padding: '9px', borderRadius: '8px', border: 'none',
                        background: '#0F172A',
                        color: '#FFFFFF', fontWeight: 700, fontSize: '11px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        transition: 'all 0.2s', boxShadow: '0 2px 6px rgba(15,23,42,0.12)'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#1E293B'}
                      onMouseLeave={e => e.currentTarget.style.background = '#0F172A'}
                    >
                      Device Details <ChevronRight size={13} />
                    </button>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => navigate(`/vehicles/${currentSelectedVehicle.id}/history`)}
                        style={{
                          flex: 1, padding: '7px', borderRadius: '6px',
                          border: '1px solid #E2E8F0', background: '#F8FAFC',
                          color: '#334155', fontWeight: 700, fontSize: '11px', cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#E2E8F0'; e.currentTarget.style.color = '#0F172A'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.color = '#334155'; }}
                      >History</button>
                      <button
                        onClick={() => navigate(`/vehicles/${currentSelectedVehicle.id}/report`)}
                        style={{
                          flex: 1, padding: '7px', borderRadius: '6px',
                          border: '1px solid #E2E8F0', background: '#F8FAFC',
                          color: '#334155', fontWeight: 700, fontSize: '11px', cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#E2E8F0'; e.currentTarget.style.color = '#0F172A'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.color = '#334155'; }}
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
                      <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>{v.plate || v.name}</span>
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
