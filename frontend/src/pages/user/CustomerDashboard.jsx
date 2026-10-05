import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Activity, MapPin, Navigation, RefreshCw, AlertCircle, ChevronRight, Users2, X, AlertTriangle, User, Compass, Shield, Cpu, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVehicles } from '../../hooks/useVehicles';
import { useAuth } from '../../hooks/useAuth';
import FleetMap from '../../components/map/FleetMap';
import DummyRazorpayModal from '../../components/modals/DummyRazorpayModal';
import { formatSpeed, formatVoltage, formatDirection } from '../../utils/formatUtils';
import { getRelativeTime, getVehicleExpiryStatus, formatLocalDate } from '../../utils/dateUtils';
import { getAddressFromCoordinates } from '../../utils/geocodeUtils';
import { getDistance } from '../../utils/mapUtils';
import { getVehicleStatus } from '../../utils/markerUtils';
import * as vehicleApi from '../../api/vehicleApi';

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

const StatusPill = ({ label, count, color, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '6px 12px', borderRadius: '20px',
      border: `2px solid ${color}`,
      background: active ? `${color}18` : '#fff',
      boxShadow: active ? `0 2px 8px ${color}25` : `0 1px 3px ${color}15`,
      cursor: 'pointer', fontSize: '12px', fontWeight: 700,
      color: active ? color : '#374151',
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
  const [searchQuery, setSearchQuery] = useState('');
  const [dismissedToastId, setDismissedToastId] = useState(null);
  const [hoveredVehicleId, setHoveredVehicleId] = useState(null);
  const [hoverPosY, setHoverPosY] = useState(12);
  const [hoveredVehicleAddress, setHoveredVehicleAddress] = useState(null);
  const hoveredVehicle = useMemo(() => vehicles.find(v => v.id === hoveredVehicleId), [vehicles, hoveredVehicleId]);

  const [isNearbyActive, setIsNearbyActive] = useState(false);
  const [nearbyRadius, setNearbyRadius] = useState(5);
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
    const interval = setInterval(fetchTodayMetrics, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, []);

  const handleRouteFetched = () => {}; // No-op, we don't need this anymore since we fetch all metrics at once

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
    if (!v.last_seen) return 'unavailable';
    if (!v.is_online) return 'offline';
    if ((v.current_speed || 0) > 2.0) return 'running';
    if (v.current_ignition) return 'idle';
    return 'parked';
  };

  const metrics = useMemo(() => {
    const m = { running: 0, idle: 0, parked: 0, offline: 0, unavailable: 0 };
    vehicles.forEach(v => m[getStatus(v)]++);
    return m;
  }, [vehicles]);

  const filtered = useMemo(() => {
    let result = vehicles;
    if (statusFilter) {
      result = result.filter(v => getStatus(v) === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(v =>
        (v.name || '').toLowerCase().includes(q) ||
        (v.plate || '').toLowerCase().includes(q) ||
        (v.driver_name || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [vehicles, statusFilter, searchQuery]);

  const statusColors = { running: '#10b981', idle: '#f59e0b', parked: '#64748B', offline: '#ef4444', unavailable: '#94a3b8' };
  const statusLabels = { running: 'Running', idle: 'Idle', parked: 'Parked', offline: 'Offline', unavailable: 'No Data' };

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
          {['running', 'idle', 'parked', 'offline', 'unavailable'].map(s => (
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

      {/* ── Hover Tooltip Card (Matching Reference Legacy Layout) ── */}
      {hoveredVehicle && (!currentSelected || hoveredVehicle.id !== currentSelected.id) && (
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
            justify: 'space-between',
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
                  {liveRouteMetrics[hoveredVehicle.id] !== undefined ? Math.round(liveRouteMetrics[hoveredVehicle.id].dynamicOdo).toLocaleString() : Math.round(hoveredVehicle.current_odometer || 0).toLocaleString()}
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
                  {hoveredVehicle.metadata?.devBattery || hoveredVehicle.dev_battery || hoveredVehicle.device_battery
                    ? `${hoveredVehicle.metadata?.devBattery || hoveredVehicle.dev_battery || hoveredVehicle.device_battery}%`
                    : 'N/A'}
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

      {/* ── Body: Vehicle List + Map ── */}
      <div className="tracking-container" style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* Left Panel: Fleet Vehicles List (Docked seamlessly matching Image 2) */}
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
                  {filtered.length} vehicles
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

          {/* Vehicle List Items */}
          <div className="tracking-scroll" style={{ overflowY: 'auto', padding: '0', display: 'flex', flexDirection: 'column', flex: 1 }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '30px', gap: '8px', opacity: 0.7 }}>
                <RefreshCw size={18} color="#0EA5E9" className="animate-spin" />
                <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>Loading vehicles...</span>
              </div>
            ) : error ? (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <AlertCircle size={24} color="#ef4444" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontSize: '12px', color: '#64748B' }}>Failed to load vehicles</div>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px', textAlign: 'center' }}>
                <Truck size={28} color="#94A3B8" style={{ marginBottom: '8px' }} />
                <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>
                  {vehicles.length === 0 ? 'No vehicles assigned' : 'No vehicles match search'}
                </span>
              </div>
            ) : (
              filtered.map(v => {
                const status = getStatus(v);
                const isSelected = currentSelected?.id === v.id;
                const sc = statusColors[status];
                const isVan = (v.name || '').toLowerCase().includes('van');
                return (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVehicle(prev => prev?.id === v.id ? null : v)}
                    title={getExpiryWarning(v) ? getExpiryWarning(v).text : undefined}
                    style={{
                      background: isSelected ? '#F0F9FF' : '#FFFFFF',
                      borderBottom: isSelected ? '1px solid #BAE6FD' : '1px solid #F1F5F9',
                      borderLeft: isSelected ? '4px solid #0EA5E9' : '4px solid transparent',
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
                      if (!isSelected) e.currentTarget.style.background = '#F8FAFC';
                    }}
                    onMouseLeave={e => {
                      setHoveredVehicleId(null);
                      if (!isSelected) e.currentTarget.style.background = '#FFFFFF';
                    }}
                  >
                    {/* Vehicle Icon Graphic */}
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
                          <path d="M6 16C6 13.5 8 11 11 11H28L36 16V26H6V16Z" fill="#F1F5F9" stroke="#64748B" strokeWidth="2"/>
                          <path d="M28 11L36 16H42C43.1 16 44 16.9 44 18V26H36V16L28 11Z" fill="#E2E8F0" stroke="#475569" strokeWidth="2"/>
                          <circle cx="14" cy="27" r="4" fill="#334155"/>
                          <circle cx="34" cy="27" r="4" fill="#334155"/>
                          <rect x="10" y="14" width="8" height="5" rx="1" fill="#94A3B8"/>
                        </svg>
                      ) : (
                        <svg width="34" height="26" viewBox="0 0 48 36" fill="none">
                          <rect x="4" y="10" width="24" height="15" rx="2" fill={isSelected ? '#0EA5E9' : '#0284C7'} stroke="#0369A1" strokeWidth="1.5"/>
                          <path d="M28 13H36L42 19V25H28V13Z" fill={isSelected ? '#38BDF8' : '#0EA5E9'} stroke="#0284C7" strokeWidth="1.5"/>
                          <circle cx="12" cy="26" r="4" fill="#1E293B"/>
                          <circle cx="34" cy="26" r="4" fill="#1E293B"/>
                        </svg>
                      )}
                    </div>

                    {/* Middle Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {v.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {v.plate || v.name}
                      </div>
                      <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <span>{formatSpeed(v.current_speed)}</span>
                        <span>·</span>
                        <span>{v.last_seen ? getRelativeTime(v.last_seen) : 'No GPS data'}</span>
                      </div>
                    </div>

                    {/* Right Status Dot & Arrow */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 700, color: sc }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: sc }} />
                        <span>{statusLabels[status]}</span>
                      </div>
                      <ChevronRight size={14} color="#94A3B8" />
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
            showRoute={!!currentSelected}
            liveRouteMetrics={liveRouteMetrics}
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
