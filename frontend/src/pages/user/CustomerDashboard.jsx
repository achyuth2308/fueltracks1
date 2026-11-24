import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck, Activity, MapPin, Navigation, RefreshCw, AlertCircle, ChevronRight,
  ChevronDown, ChevronLeft, Users2, X, AlertTriangle, User, Compass, Shield,
  Cpu, Search, Maximize2, Minimize2, Fuel, Key, Battery, History, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVehicles } from '../../hooks/useVehicles';
import { useAuth } from '../../hooks/useAuth';
import FleetMap from '../../components/map/FleetMap';
import DummyRazorpayModal from '../../components/modals/DummyRazorpayModal';
import { formatSpeed, formatVoltage, formatDirection } from '../../utils/formatUtils';
import { getRelativeTime, getVehicleExpiryStatus, formatLocalDate } from '../../utils/dateUtils';
import { getAddressFromCoordinates } from '../../utils/geocodeUtils';
import { getDistance } from '../../utils/mapUtils';
import { getVehicleStatus, getVehicleType, getNoDataThresholdHours, setNoDataThresholdHours, NO_DATA_OPTIONS } from '../../utils/markerUtils';
import { hasVehicleFuelCapability } from '../../utils/licenseUtils';
import * as vehicleApi from '../../api/vehicleApi';
import ManualFuelEntryModal from '../../components/fuel/ManualFuelEntryModal';

const getExpiryWarning = (vehicle) => {
  if (!vehicle || !vehicle.licence_expire_date) return null;
  const status = getVehicleExpiryStatus(vehicle.licence_expire_date, vehicle.licence_issued_date, vehicle.metadata);
  if (status.isExpired) {
    return { type: 'expired', text: 'License Expired', diffDays: status.diffDays };
  } else if (status.isExpiring) {
    return {
      type: 'expiring',
      text: `Your license is going to expire in ${status.diffDays} day${status.diffDays === 1 ? '' : 's'}`,
      diffDays: status.diffDays
    };
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
  const { vehicles, groups, loading, error, refetch } = useVehicles();
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const toggleGroupCollapse = (groupId) => setCollapsedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const handleGroupSelect = (groupId) => {
    setSelectedGroupId(prev => prev === groupId ? null : groupId);
    setSelectedVehicle(null);
  };
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [mobileTab, setMobileTab] = useState('list'); // 'list' | 'map'
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dismissedToastId, setDismissedToastId] = useState(null);
  const [dismissedBannerVehicleId, setDismissedBannerVehicleId] = useState(null);
  const [expiredModalVehicle, setExpiredModalVehicle] = useState(null);
  const [hoveredVehicleId, setHoveredVehicleId] = useState(null);
  const [hoverPosY, setHoverPosY] = useState(12);
  const [isFuelEntryOpen, setIsFuelEntryOpen] = useState(false);
  const [selectedFuelVehicle, setSelectedFuelVehicle] = useState(null);
  const [hoveredVehicleAddress, setHoveredVehicleAddress] = useState(null);
  const hoveredVehicle = useMemo(() => vehicles.find(v => v.id === hoveredVehicleId), [vehicles, hoveredVehicleId]);

  const expiringAlertVehicle = useMemo(() => {
    return vehicles.find(v => {
      const w = getExpiryWarning(v);
      return w && (w.type === 'expiring' || w.type === 'expired');
    });
  }, [vehicles]);

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

  const handleRouteFetched = () => { }; // No-op, we don't need this anymore since we fetch all metrics at once

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

  const [noDataThreshold, setNoDataThreshold] = useState(getNoDataThresholdHours());

  useEffect(() => {
    const handleThresholdChange = (e) => {
      setNoDataThreshold(e.detail || getNoDataThresholdHours());
    };
    window.addEventListener('nodata-threshold-changed', handleThresholdChange);
    return () => window.removeEventListener('nodata-threshold-changed', handleThresholdChange);
  }, []);

  const getStatus = (v) => {
    return getVehicleStatus(v, noDataThreshold);
  };

  const metrics = useMemo(() => {
    const m = { running: 0, idle: 0, parked: 0, offline: 0, unavailable: 0, unreachable: 0 };
    vehicles.forEach(v => {
      const s = getStatus(v);
      m[s] = (m[s] || 0) + 1;
    });
    return m;
  }, [vehicles, noDataThreshold]);

  const filtered = useMemo(() => {
    let result = vehicles;
    if (statusFilter) {
      result = result.filter(v => {
        const s = getStatus(v);
        if (statusFilter === 'unreachable') return s === 'unreachable' || s === 'unavailable';
        return s === statusFilter;
      });
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

  const groupedVehicles = useMemo(() => {
    if (!groups || groups.length === 0) return null;

    const groupMap = groups.map(g => {
      const gVehicles = filtered.filter(v =>
        (Array.isArray(v.groups) && v.groups.some(vg => vg.id === g.id || vg.name === g.name)) ||
        (Array.isArray(g.vehicles) && g.vehicles.some(gv => gv.id === v.id)) ||
        (v.group_name && v.group_name.split(',').map(s => s.trim().toLowerCase()).includes(g.name?.trim()?.toLowerCase()))
      );

      const onlineCount = gVehicles.filter(v => v.is_online).length;
      return {
        group: g,
        vehicles: gVehicles,
        totalCount: gVehicles.length,
        onlineCount
      };
    });

    // Check for any unassigned vehicles that don't belong to any of the user's groups
    const assignedIds = new Set();
    groupMap.forEach(gm => gm.vehicles.forEach(v => assignedIds.add(v.id)));
    const unassigned = filtered.filter(v => !assignedIds.has(v.id));

    if (unassigned.length > 0) {
      groupMap.push({
        group: { id: '__unassigned__', name: 'Other / Unassigned' },
        vehicles: unassigned,
        totalCount: unassigned.length,
        onlineCount: unassigned.filter(v => v.is_online).length
      });
    }

    return groupMap;
  }, [groups, filtered]);

  const mapVehicles = useMemo(() => {
    if (selectedGroupId && groupedVehicles) {
      const gm = groupedVehicles.find(g => g.group.id === selectedGroupId);
      if (gm && gm.vehicles) return gm.vehicles;
    }
    return filtered;
  }, [filtered, selectedGroupId, groupedVehicles]);

  const statusColors = { running: '#10b981', idle: '#f59e0b', parked: '#64748B', offline: '#ef4444', unreachable: '#94a3b8', unavailable: '#94a3b8' };
  const statusLabels = { running: 'Running', idle: 'Idle', parked: 'Parked', offline: 'No Data', unreachable: 'Unreachable', unavailable: 'Unreachable' };

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

  const hasNoGpsVehicles = useMemo(() => {
    if (!vehicles || vehicles.length === 0) return false;
    const targetVehicles = currentSelected ? [currentSelected] : filtered;
    return targetVehicles.length > 0 && targetVehicles.every(v => {
      const lat = parseFloat(v.lat);
      const lng = parseFloat(v.lng);
      return isNaN(lat) || isNaN(lng) || lat < 6.5 || lat > 37.5 || lng < 68.0 || lng > 98.0;
    });
  }, [vehicles, currentSelected, filtered]);

  const renderVehicleCard = (v, groupKey = '') => {
    const vWarning = getExpiryWarning(v);
    const isExpired = vWarning && vWarning.type === 'expired';
    const isExpiring = vWarning && vWarning.type === 'expiring';
    const status = getStatus(v);
    const isSelected = currentSelected?.id === v.id;
    const sc = isExpired ? '#DC2626' : (isExpiring ? '#D97706' : statusColors[status]);
    const vHasFuel = hasVehicleFuelCapability(v);
    const isIgnitionOn = !!v.current_ignition;

    return (
      <div
        key={`${groupKey}-${v.id}`}
        onClick={(e) => {
          if (e && e.currentTarget && typeof e.currentTarget.closest === 'function') {
            const container = e.currentTarget.closest('.tracking-container');
            if (container) {
              const containerRect = container.getBoundingClientRect();
              const itemRect = e.currentTarget.getBoundingClientRect();
              setHoverPosY(Math.max(12, Math.min(itemRect.top - containerRect.top, containerRect.height - 350)));
            }
          }
          setSelectedVehicle(prev => prev?.id === v.id ? null : v);
          if (window.innerWidth <= 768) {
            setMobileTab('map');
          }
          if (isExpired) {
            setExpiredModalVehicle(prev => prev?.id === v.id ? null : v);
          } else {
            setExpiredModalVehicle(null);
          }
        }}
        title={vWarning ? vWarning.text : undefined}
        style={{
          background: isExpired ? '#FEF2F2' : (isExpiring ? '#FFFBEB' : (isSelected ? '#ECFDF5' : '#FFFFFF')),
          borderBottom: isExpired ? '1px solid #FECACA' : (isExpiring ? '1px solid #FDE68A' : (isSelected ? '1px solid #A7F3D0' : '1px solid #F1F5F9')),
          borderLeft: isExpired ? '3px solid #DC2626' : (isExpiring ? '3px solid #F59E0B' : (isSelected ? '3px solid #059669' : '3px solid transparent')),
          padding: '5px 8px',
          cursor: 'pointer',
          transition: 'background 0.15s ease',
          display: 'flex',
          flexDirection: 'column',
          gap: '3px'
        }}
        onMouseEnter={e => {
          setHoveredVehicleId(v.id);
          if (e && e.currentTarget && typeof e.currentTarget.closest === 'function') {
            const container = e.currentTarget.closest('.tracking-container');
            if (container) {
              const containerRect = container.getBoundingClientRect();
              const itemRect = e.currentTarget.getBoundingClientRect();
              setHoverPosY(Math.max(12, Math.min(itemRect.top - containerRect.top, containerRect.height - 350)));
            }
          }
          if (!isSelected && !isExpired && !isExpiring) e.currentTarget.style.background = '#F8FAFC';
          if (isExpired) e.currentTarget.style.background = '#FEE2E2';
          if (isExpiring && !isSelected) e.currentTarget.style.background = '#FEF3C7';
        }}
        onMouseLeave={e => {
          setHoveredVehicleId(null);
          if (!isSelected && !isExpired && !isExpiring) e.currentTarget.style.background = '#FFFFFF';
          if (isExpired) e.currentTarget.style.background = '#FEF2F2';
          if (isExpiring && !isSelected) e.currentTarget.style.background = '#FFFBEB';
        }}
      >
        {/* Top Row: Icon + Plate/Name + Status Badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
            {/* Modern Vehicle Icon Squircle */}
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '6px',
              background: isExpired ? '#FEE2E2' : (isSelected ? '#D1FAE5' : '#F1F5F9'),
              border: `1px solid ${isExpired ? '#FECACA' : (isSelected ? '#A7F3D0' : '#E2E8F0')}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {(() => {
                const vType = getVehicleType(v);
                const iconColor = isExpired ? '#DC2626' : (isSelected ? '#059669' : (v.is_online ? '#10B981' : '#64748B'));
                if (vType === 'bike') {
                  return (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="5.5" cy="17.5" r="3.5" />
                      <circle cx="18.5" cy="17.5" r="3.5" />
                      <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5L9 9H5" />
                      <path d="M12 17.5V14l4-3 3 3" />
                    </svg>
                  );
                }
                if (vType === 'car') {
                  return (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 11.2 2 11.8 2 12.3V16c0 .6.4 1 1 1h2" />
                      <circle cx="7" cy="17" r="2" />
                      <path d="M9 17h6" />
                      <circle cx="17" cy="17" r="2" />
                    </svg>
                  );
                }
                return (
                  <Truck size={13} color={iconColor} />
                );
              })()}
            </div>

            {/* Vehicle Plate & Optional Name */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '11.5px',
                fontWeight: 800,
                color: isExpired ? '#B91C1C' : (isSelected ? '#065F46' : '#0F172A'),
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.15
              }}>
                {v.plate || v.name}
              </div>
              {v.name && v.plate && v.name !== v.plate && (
                <div style={{
                  fontSize: '9.5px',
                  fontWeight: 500,
                  color: isExpired ? '#DC2626' : '#64748B',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  marginTop: '1px'
                }}>
                  {v.name}
                </div>
              )}
            </div>
          </div>

          {/* Right Status Badge Pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              fontSize: '8.5px',
              fontWeight: 700,
              padding: '1.5px 4px',
              borderRadius: '8px',
              background: isExpired ? '#FEE2E2' : (isExpiring ? '#FEF3C7' : `${sc}15`),
              color: isExpired ? '#DC2626' : (isExpiring ? '#D97706' : sc),
              border: `1px solid ${isExpired ? '#FECACA' : (isExpiring ? '#FDE68A' : `${sc}30`)}`,
              letterSpacing: '0.01em'
            }}>
              <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: isExpired ? '#DC2626' : sc }} />
              <span>{isExpired ? 'EXPIRED' : (isExpiring ? `EXPIRING (${vWarning.diffDays}d)` : statusLabels[status])}</span>
            </div>
            <ChevronRight size={11} color={isExpired ? '#DC2626' : '#CBD5E1'} />
          </div>
        </div>

        {/* Bottom Row: Key metrics (Ignition, Speed, Fuel, Last seen) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '9.5px',
          color: '#64748B',
          paddingTop: '2px',
          borderTop: '1px dashed #F1F5F9'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
              fontSize: '8.5px',
              fontWeight: 700,
              padding: '1px 3px',
              borderRadius: '3px',
              background: isIgnitionOn ? '#DCFCE7' : '#F1F5F9',
              color: isIgnitionOn ? '#15803D' : '#64748B'
            }}>
              <Key size={8} />
              {isIgnitionOn ? 'ON' : 'OFF'}
            </span>
            <span style={{ fontWeight: 600, color: '#334155', fontSize: '9.5px' }}>
              {v.is_online ? `${Math.round(v.current_speed || 0)} km/h` : '0 km/h'}
            </span>
            {vHasFuel && v.current_fuel !== undefined && v.current_fuel !== null && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFuelVehicle(v);
                  setIsFuelEntryOpen(true);
                }}
                title="Click to Log Manual Fuel Entry"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px',
                  color: '#0284C7',
                  fontWeight: 600,
                  fontSize: '9.5px',
                  cursor: 'pointer',
                  borderRadius: '3px',
                  padding: '0 2px'
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#EA580C'}
                onMouseLeave={e => e.currentTarget.style.color = '#0284C7'}
              >
                <Fuel size={8} />
                {Math.round(Number(v.current_fuel))}L
              </span>
            )}
          </div>

          <div style={{
            fontSize: '9px',
            color: '#94A3B8',
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '110px'
          }}>
            {v.last_seen ? getRelativeTime(v.last_seen) : 'Never connected'}
          </div>
        </div>
      </div>
    );
  };


  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      background: '#f0f2f5', overflow: 'hidden', position: 'relative'
    }}>

      {/* ── Middle Expired License Modal ── */}
      <AnimatePresence>
        {expiredModalVehicle && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, x: -10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.95, x: -10 }}
            style={{
              position: 'absolute',
              top: window.innerWidth > 768 ? `${hoverPosY}px` : '20px',
              left: window.innerWidth > 768 ? '245px' : '12px',
              right: window.innerWidth > 768 ? 'auto' : '12px',
              zIndex: 10000,
              width: window.innerWidth > 768 ? '360px' : 'auto',
              maxWidth: 'calc(100vw - 24px)',
              background: '#FFFFFF',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              border: '1px solid #DC2626'
            }}
          >
            {/* Red Header Bar */}
            <div style={{
              background: '#DC2626',
              color: '#FFFFFF',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '0.2px' }}>
                Licence Expiry Message
              </span>
              <button
                onClick={() => setExpiredModalVehicle(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2px',
                  borderRadius: '4px'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body Content */}
            <div style={{ padding: '24px 20px', background: '#FFFFFF' }}>
              <p style={{
                margin: 0,
                color: '#DC2626',
                fontSize: '14px',
                fontWeight: 600,
                lineHeight: '1.5'
              }}>
                Your license has expired. Please contact sales team or renew yourself
              </p>
            </div>

            {/* Footer Bar */}
            <div style={{
              padding: '12px 16px',
              background: '#F8FAFC',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                onClick={() => setExpiredModalVehicle(null)}
                style={{
                  padding: '6px 18px',
                  background: '#FFFFFF',
                  color: '#475569',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
              >
                Close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                {(() => {
                  const ren = currentSelected.metadata?.renewal_price;
                  const disc = currentSelected.metadata?.discount_price;
                  if (disc && ren && parseFloat(disc) < parseFloat(ren)) {
                    return (
                      <span style={{ marginLeft: '8px', fontWeight: 700, color: '#047857' }}>
                        Renew today for <span style={{ textDecoration: 'line-through', color: '#6B7280' }}>₹{parseFloat(ren).toFixed(2)}</span>{' '}
                        <span style={{ fontWeight: 800, color: '#059669' }}>₹{parseFloat(disc).toFixed(2)}</span>{' '}
                        (Save ₹{(parseFloat(ren) - parseFloat(disc)).toFixed(2)})!
                      </span>
                    );
                  }
                  return null;
                })()}
                <button
                  onClick={() => navigate('/renewals')}
                  style={{ marginLeft: '12px', padding: '6px 14px', background: warning.type === 'expired' ? '#EF4444' : '#F59E0B', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}
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

      {/* ── Top Alert Banner for Expiry & Discount Offer ── */}
      {expiringAlertVehicle && dismissedBannerVehicleId !== expiringAlertVehicle.id && (() => {
        const w = getExpiryWarning(expiringAlertVehicle);
        const isExp = w?.type === 'expired';
        const renPrice = expiringAlertVehicle.metadata?.renewal_price !== undefined && expiringAlertVehicle.metadata?.renewal_price !== null ? parseFloat(expiringAlertVehicle.metadata.renewal_price) : null;
        const discPrice = expiringAlertVehicle.metadata?.discount_price !== undefined && expiringAlertVehicle.metadata?.discount_price !== null && expiringAlertVehicle.metadata?.discount_price !== '' ? parseFloat(expiringAlertVehicle.metadata.discount_price) : null;
        const hasDiscount = renPrice !== null && discPrice !== null && discPrice < renPrice;

        return (
          <div style={{
            background: isExp ? '#FEF2F2' : '#FFFBEB',
            borderBottom: `2px solid ${isExp ? '#FCA5A5' : '#FCD34D'}`,
            padding: '10px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '12px', zIndex: 100, flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <AlertTriangle size={18} color={isExp ? '#DC2626' : '#D97706'} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: isExp ? '#991B1B' : '#B45309' }}>
                {isExp
                  ? `Your license has expired for vehicle ${expiringAlertVehicle.name} (${expiringAlertVehicle.plate || expiringAlertVehicle.imei})!`
                  : `Your license is going to expire in ${w.diffDays} day${w.diffDays === 1 ? '' : 's'} for vehicle ${expiringAlertVehicle.name} (${expiringAlertVehicle.plate || expiringAlertVehicle.imei})!`}
              </span>
              {hasDiscount && (
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#047857', background: '#D1FAE5', border: '1px solid #A7F3D0', padding: '2px 8px', borderRadius: '4px' }}>
                  Renew today for <span style={{ textDecoration: 'line-through', color: '#6B7280' }}>₹{renPrice.toFixed(2)}</span>{' '}
                  <span style={{ color: '#059669', fontWeight: 800 }}>₹{discPrice.toFixed(2)}</span>{' '}
                  (Save ₹{(renPrice - discPrice).toFixed(2)})!
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <button
                onClick={() => navigate('/renewals')}
                style={{
                  padding: '6px 14px', background: isExp ? '#DC2626' : '#F59E0B',
                  color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700,
                  fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                Renew Now
              </button>
              <button
                onClick={() => setDismissedBannerVehicleId(expiringAlertVehicle.id)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: isExp ? '#991B1B' : '#B45309', padding: '4px' }}
                title="Dismiss"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Top Header Bar ── */}
      <div className="bg-white border-b border-gray-200 px-3 py-1.5 sm:px-4 sm:py-2 flex flex-col md:flex-row md:items-center justify-between gap-2 shrink-0 shadow-xs">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '8px',
              background: 'linear-gradient(135deg, #064E3B, #059669)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <MapPin size={15} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
                {user?.name ? `${user.name}'s Dashboard` : 'Fleet Dashboard'}
              </div>
              <div style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 500 }}>
                {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''} in your fleet
              </div>
            </div>
          </div>

          {/* Mobile Tab Switcher */}
          <div className="flex md:hidden items-center bg-slate-100 p-1 rounded-lg border border-slate-200 gap-1">
            <button
              onClick={() => setMobileTab('list')}
              className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${mobileTab === 'list' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
            >
              List
            </button>
            <button
              onClick={() => setMobileTab('map')}
              className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${mobileTab === 'map' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600'
                }`}
            >
              Map
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', maxWidth: '100%', paddingBottom: '2px', WebkitOverflowScrolling: 'touch' }}>

          {/* Status filter pills */}
          {['running', 'idle', 'parked', 'offline', 'unreachable'].map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
              <StatusPill
                label={statusLabels[s]} count={metrics[s] || (s === 'unreachable' ? metrics.unavailable : 0) || 0}
                color={statusColors[s]} active={statusFilter === s || (s === 'unreachable' && statusFilter === 'unavailable')}
                onClick={() => setStatusFilter(prev => prev === s ? null : s)}
              />

            </div>
          ))}

          <button
            onClick={() => setStatusFilter(null)}
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              border: statusFilter === null ? '2px solid #ea580c' : '1px solid #fed7aa',
              background: statusFilter === null ? '#ea580c' : '#fff7ed',
              color: statusFilter === null ? '#ffffff' : '#c2410c',
              fontSize: '12px',
              fontWeight: 700,
              marginLeft: '4px',
              flexShrink: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
              boxShadow: statusFilter === null ? '0 2px 8px rgba(234,88,12,0.3)' : 'none'
            }}
            title={statusFilter ? "Clear filter & Show all" : "Showing all vehicles"}
          >
            <span>Total</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 800 }}>{vehicles.length}</span>
          </button>

          <button
            onClick={() => refetch()}
            style={{
              background: '#f9fafb', border: '1px solid #e5e7eb', color: '#6b7280',
              cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '7px',
              borderRadius: '8px', marginLeft: '4px', flexShrink: 0
            }}
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>

          {/* Manual Fuel Entry Button */}
          <button
            onClick={() => {
              setSelectedFuelVehicle(selectedVehicle || null);
              setIsFuelEntryOpen(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11.5px] font-bold rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700 shadow-2xs transition-colors shrink-0 ml-1 cursor-pointer"
            title="Log Fuel Entry for Vehicle"
          >
            <Fuel size={13} className="text-orange-600" />
            <span>Log Fuel</span>
          </button>

          {/* Desktop Full Map / Show Fleet List Toggle */}
          <button
            onClick={() => setIsSidebarCollapsed(prev => !prev)}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 text-[11.5px] font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-colors shrink-0 ml-1 cursor-pointer"
            title={isSidebarCollapsed ? (vehicles.length === 1 ? "Show Vehicle" : "Show Fleet List") : "Collapse Fleet List (Full Map)"}
          >
            {isSidebarCollapsed ? <Minimize2 size={13} className="text-emerald-600" /> : <Maximize2 size={13} />}
            <span>{isSidebarCollapsed ? (vehicles.length === 1 ? "Show Vehicle" : "Show Fleet") : "Full Map"}</span>
          </button>
        </div>
      </div>

      {/* ── Hover Tooltip Card (Matching Reference Legacy Layout) ── */}
      {hoveredVehicle && (!currentSelected || hoveredVehicle.id !== currentSelected.id) && (
        <div style={{
          position: 'absolute',
          top: window.innerWidth > 768 ? `${hoverPosY}px` : '20px',
          left: window.innerWidth > 768 ? '300px' : '12px',
          right: window.innerWidth > 768 ? 'auto' : '12px',
          width: window.innerWidth > 768 ? '360px' : 'auto',
          maxWidth: 'calc(100vw - 24px)',
          background: 'rgba(241, 245, 249, 0.95)',
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
                  {Math.max(0, Math.round(Number(liveRouteMetrics[hoveredVehicle.id]?.dynamicOdo ?? hoveredVehicle.current_odometer ?? hoveredVehicle.today_distance ?? 0) || 0)).toLocaleString()}
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
                  {Math.round(hoveredVehicle.is_online ? (hoveredVehicle.current_speed || 0) : 0)}
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
            {hoveredVehicleAddress || (hoveredVehicle?.last_seen ? 'Location unavailable' : 'Never communicated')}
          </div>
        </div>
      )}

      {/* ── Body: Vehicle List + Map ── */}
      <div className="tracking-container" style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* Left Panel: Fleet Vehicles List (Docked seamlessly matching Image 2) */}
        {!isSidebarCollapsed && (
          <div
            className={`h-full bg-white border-r border-slate-200 flex-col z-10 shrink-0 w-full md:w-[250px] ${mobileTab === 'list' ? 'flex' : 'hidden md:flex'
              }`}
            style={{ height: '100%', position: 'relative' }}
          >
            {/* Header Section */}
            <div style={{ padding: '8px 10px 6px 10px', borderBottom: '1px solid #F1F5F9', background: '#FFFFFF' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div>
                  <h2 style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                    {vehicles.length === 1 ? 'My Vehicle' : 'Fleet Vehicles'}
                  </h2>
                  <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600, marginTop: '1px' }}>
                    {filtered.length} {filtered.length === 1 ? 'vehicle' : 'vehicles'} {groups?.length ? `• ${groups.length} groups` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    onClick={() => refetch()}
                    style={{
                      background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B',
                      cursor: 'pointer', padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center', transition: 'all 0.2s'
                    }}
                    title="Refresh"
                    onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#0F172A'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.color = '#64748B'; }}
                  >
                    <RefreshCw size={12} />
                  </button>
                  <button
                    onClick={() => setIsSidebarCollapsed(true)}
                    className="hidden md:flex"
                    style={{
                      background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B',
                      cursor: 'pointer', padding: '4px', borderRadius: '6px', alignItems: 'center', transition: 'all 0.2s'
                    }}
                    title="Collapse Fleet List"
                    onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#0F172A'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.color = '#64748B'; }}
                  >
                    <ChevronLeft size={13} />
                  </button>
                </div>
              </div>

              {/* Search vehicle input */}
              <div style={{ position: 'relative', width: '100%' }}>
                <Search size={13} color="#94A3B8" style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Search vehicle..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '5px 8px 5px 28px',
                    borderRadius: '6px',
                    border: '1px solid #E2E8F0',
                    background: '#F8FAFC',
                    fontSize: '11.5px',
                    outline: 'none',
                    color: '#0F172A',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Vehicle List Items */}
            <div className="tracking-scroll" style={{ overflowY: 'auto', padding: '0', display: 'flex', flexDirection: 'column', flex: 1 }}>
              {selectedGroupId && (
                <div style={{
                  padding: '7px 12px',
                  background: '#EFF6FF',
                  borderBottom: '1px solid #BFDBFE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  color: '#1E40AF',
                  position: 'sticky',
                  top: 0,
                  zIndex: 10
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <MapPin size={13} color="#0284C7" />
                    <span>Group: <strong>{groupedVehicles?.find(g => g.group.id === selectedGroupId)?.group.name}</strong> ({mapVehicles.length})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedGroupId(null); setSelectedVehicle(null); }}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #93C5FD',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      color: '#0284C7',
                      cursor: 'pointer'
                    }}
                  >
                    Show All
                  </button>
                </div>
              )}
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
              ) : groupedVehicles ? (
                groupedVehicles.map(gm => {
                  // If search is active and group has 0 matches, hide the group
                  if (searchQuery.trim() && gm.vehicles.length === 0) return null;
                  const isCollapsed = !!collapsedGroups[gm.group.id];

                  return (
                    <div key={gm.group.id} style={{ display: 'flex', flexDirection: 'column' }}>
                      {/* Modern Group Header */}
                      <div
                        onClick={() => handleGroupSelect(gm.group.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '4px 10px',
                          background: selectedGroupId === gm.group.id ? '#EFF6FF' : '#F8FAFC',
                          borderTop: '1px solid #E2E8F0',
                          borderBottom: '1px solid #E2E8F0',
                          borderLeft: selectedGroupId === gm.group.id ? '4px solid #0284C7' : '4px solid transparent',
                          cursor: 'pointer',
                          userSelect: 'none',
                          position: 'sticky',
                          top: selectedGroupId ? '30px' : 0,
                          zIndex: 5,
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={e => { if (selectedGroupId !== gm.group.id) e.currentTarget.style.background = '#F1F5F9'; }}
                        onMouseLeave={e => { if (selectedGroupId !== gm.group.id) e.currentTarget.style.background = '#F8FAFC'; }}
                        title="Click to plot ONLY this group on map"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                          <span style={{
                            fontSize: '11.5px',
                            fontWeight: selectedGroupId === gm.group.id ? 800 : 700,
                            color: selectedGroupId === gm.group.id ? '#0284C7' : '#0F172A',
                            letterSpacing: '0.02em',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {gm.group.name}
                          </span>
                          {selectedGroupId === gm.group.id && (
                            <span style={{
                              fontSize: '9.5px',
                              fontWeight: 700,
                              background: '#0284C7',
                              color: '#FFFFFF',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              letterSpacing: '0.03em',
                              textTransform: 'uppercase'
                            }}>
                              On Map
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '12px',
                            background: '#FFFFFF',
                            border: '1px solid #E2E8F0',
                            color: '#475569'
                          }}>
                            {gm.vehicles.length} {gm.vehicles.length === 1 ? 'veh' : 'vehs'}
                          </span>
                          {gm.onlineCount > 0 && (
                            <span style={{
                              fontSize: '10.5px',
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: '10px',
                              background: '#F0FDF4',
                              border: '1px solid #BBF7D0',
                              color: '#16A34A',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}>
                              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#16A34A' }} />
                              {gm.onlineCount}
                            </span>
                          )}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleGroupCollapse(gm.group.id);
                            }}
                            style={{ padding: '2px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                            title={isCollapsed ? "Expand list" : "Collapse list"}
                          >
                            {isCollapsed ? <ChevronRight size={14} color="#94A3B8" /> : <ChevronDown size={14} color="#94A3B8" />}
                          </div>
                        </div>
                      </div>

                      {/* Group Vehicles List */}
                      {!isCollapsed && (
                        gm.vehicles.length === 0 ? (
                          <div style={{ padding: '12px 16px', fontSize: '11px', color: '#94A3B8', fontStyle: 'italic', background: '#FAFAFA', textAlign: 'center' }}>
                            No vehicles match filters in this group
                          </div>
                        ) : (
                          gm.vehicles.map(v => renderVehicleCard(v, gm.group.id))
                        )
                      )}
                    </div>
                  );
                })
              ) : (
                filtered.map(v => renderVehicleCard(v, 'all'))
              )}
              {/* Mobile Floating Button to switch to Map */}
              <div className="md:hidden" style={{ position: 'absolute', bottom: '16px', right: '16px', zIndex: 100 }}>
                <button
                  onClick={() => setMobileTab('map')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '9px 16px', borderRadius: '30px',
                    background: '#0284C7', color: '#FFFFFF',
                    fontSize: '12px', fontWeight: 700, border: 'none',
                    boxShadow: '0 4px 14px rgba(2,132,199,0.4)', cursor: 'pointer'
                  }}
                >
                  <MapPin size={15} color="#FFFFFF" />
                  <span>View Map</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Right: Map + optional vehicle detail */}
        <div className={`flex-1 relative overflow-hidden h-full ${mobileTab === 'map' ? 'block' : 'hidden md:block'}`}>
          {/* Desktop Floating Button to restore Fleet List when collapsed */}
          {isSidebarCollapsed && (
            <div className="hidden md:block" style={{ position: 'absolute', top: '14px', left: '14px', zIndex: 1000 }}>
              <button
                onClick={() => setIsSidebarCollapsed(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '7px 12px', borderRadius: '8px',
                  background: '#FFFFFF', color: '#0F172A',
                  fontSize: '11px', fontWeight: 700, border: '1px solid #E2E8F0',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)', cursor: 'pointer'
                }}
              >
                <Truck size={14} color="#059669" />
                <span>{vehicles.length === 1 ? "Show Vehicle" : `Show Fleet (${filtered.length})`}</span>
              </button>
            </div>
          )}

          <FleetMap
            vehicles={currentSelected ? (isNearbyActive ? [currentSelected, ...nearbyVehicles] : [currentSelected]) : mapVehicles}
            selectedVehicles={currentSelected ? [currentSelected] : []}
            onMarkerClick={(v) => setSelectedVehicle(v)}
            onMultiTrackClick={(v) => navigate(`/tracking?multitrack=${v.id}`)}
            isNearbyActive={isNearbyActive}
            nearbyRadius={nearbyRadius}
            followSelected={true}
            showRoute={!!currentSelected}
            liveRouteMetrics={liveRouteMetrics}
            gaugesStyle={{
              left: typeof window !== 'undefined' && window.innerWidth > 768 ? '16px' : '12px',
              bottom: typeof window !== 'undefined' && window.innerWidth > 768 ? '20px' : '75px'
            }}
          />

          {/* Floating Notice when vehicle has no live GPS fix */}
          {hasNoGpsVehicles && (
            <div style={{
              position: 'absolute',
              top: '12px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              background: 'rgba(255, 255, 255, 0.96)',
              backdropFilter: 'blur(8px)',
              border: '1px solid #E2E8F0',
              borderRadius: '20px',
              padding: '6px 14px',
              boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              pointerEvents: 'none'
            }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#94A3B8' }} />
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                {currentSelected 
                  ? `${currentSelected.plate || currentSelected.name} has no GPS fix yet (Never connected). Showing default map.` 
                  : (vehicles.length === 1 
                      ? `${vehicles[0]?.plate || vehicles[0]?.name || 'Vehicle'} has no GPS fix yet. Showing default map.`
                      : 'Vehicles have not sent GPS data yet. Showing default map.')}
              </span>
            </div>
          )}

          {/* ── Selected Vehicle Floating HUD Card (Bottom-Left) ── */}
          {currentSelected && (
            <div style={{
              position: 'absolute',
              bottom: window.innerWidth > 768 ? '20px' : '75px',
              left: window.innerWidth > 768 ? '20px' : '12px',
              zIndex: 1000,
              background: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid #E2E8F0',
              borderRadius: '14px',
              padding: '12px 14px',
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.12)',
              width: window.innerWidth > 768 ? '330px' : 'calc(100% - 24px)',
              maxWidth: '360px',
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
            }}>
              {/* Header: Name, Plate, Status pill & Close */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', gap: '8px' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {currentSelected.plate || currentSelected.name}
                  </div>
                  {currentSelected.plate && currentSelected.name && currentSelected.name !== currentSelected.plate && (
                    <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {currentSelected.name}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <span style={{
                    fontSize: '9.5px',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '12px',
                    background: `${statusColors[getStatus(currentSelected)]}18`,
                    color: statusColors[getStatus(currentSelected)],
                    border: `1px solid ${statusColors[getStatus(currentSelected)]}35`
                  }}>
                    {statusLabels[getStatus(currentSelected)]}
                  </span>
                  <button
                    onClick={() => setSelectedVehicle(null)}
                    style={{ background: '#F1F5F9', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: '3px', color: '#64748B', display: 'flex' }}
                    title="Deselect"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* No GPS Fix Alert inside card if coordinates missing */}
              {(!currentSelected.lat || !currentSelected.lng || isNaN(parseFloat(currentSelected.lat)) || parseFloat(currentSelected.lat) < 6.5) && (
                <div style={{
                  background: '#FEF3C7',
                  border: '1px solid #FCD34D',
                  borderRadius: '6px',
                  padding: '5px 8px',
                  marginBottom: '8px',
                  fontSize: '10.5px',
                  color: '#92400E',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <Info size={13} className="shrink-0 text-amber-600" />
                  <span>No live GPS fix recorded. Device is offline or never connected.</span>
                </div>
              )}

              {/* Metrics grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', padding: '7px 0', borderTop: '1px solid #F1F5F9', borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ background: '#F8FAFC', padding: '6px 8px', borderRadius: '6px', border: '1px solid #F1F5F9' }}>
                  <div style={{ fontSize: '9.5px', color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Activity size={10} /> Speed
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A', marginTop: '1px' }}>
                    {formatSpeed(currentSelected.current_speed, currentSelected.is_online)}
                  </div>
                </div>
                <div style={{ background: '#F8FAFC', padding: '6px 8px', borderRadius: '6px', border: '1px solid #F1F5F9' }}>
                  <div style={{ fontSize: '9.5px', color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Key size={10} /> Ignition
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: currentSelected.current_ignition ? '#16A34A' : '#EF4444', marginTop: '1px' }}>
                    {currentSelected.current_ignition ? 'ON' : 'OFF'}
                  </div>
                </div>
                <div style={{ background: '#F8FAFC', padding: '6px 8px', borderRadius: '6px', border: '1px solid #F1F5F9' }}>
                  <div style={{ fontSize: '9.5px', color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Navigation size={10} /> Today Dist
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A', marginTop: '1px' }}>
                    {liveRouteMetrics[currentSelected.id]?.cDist !== undefined ? Number(liveRouteMetrics[currentSelected.id].cDist).toFixed(2) : (Number(currentSelected.today_distance) || 0).toFixed(2)} km
                  </div>
                </div>
                <div style={{ background: '#F8FAFC', padding: '6px 8px', borderRadius: '6px', border: '1px solid #F1F5F9' }}>
                  <div style={{ fontSize: '9.5px', color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Battery size={10} /> Battery
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A', marginTop: '1px' }}>
                    {formatVoltage(currentSelected.current_voltage || currentSelected.metadata?.batteryVoltage)}
                  </div>
                </div>
              </div>

              {/* FUEL METRICS */}
              {hasVehicleFuelCapability(currentSelected) && (
                <div style={{
                  marginTop: '7px',
                  padding: '7px 9px',
                  borderRadius: '8px',
                  background: '#F0F9FF',
                  border: '1px solid #BAE6FD',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '5px', background: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Fuel size={13} color="#FFFFFF" />
                    </div>
                    <div>
                      <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#0369A1', textTransform: 'uppercase' }}>Fuel Level</div>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#0C4A6E' }}>
                        {currentSelected.current_fuel !== undefined && currentSelected.current_fuel !== null
                          ? `${Math.round(Number(currentSelected.current_fuel))} L`
                          : 'Monitoring'}
                        {currentSelected.tank_capacity ? ` / ${currentSelected.tank_capacity} L` : ''}
                      </div>
                    </div>
                  </div>
                  {currentSelected.tank_capacity && currentSelected.current_fuel != null && (
                    <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#0284C7', background: '#E0F2FE', padding: '1px 6px', borderRadius: '10px' }}>
                      {Math.min(100, Math.round((Number(currentSelected.current_fuel) / Number(currentSelected.tank_capacity)) * 100))}%
                    </span>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: hasVehicleFuelCapability(currentSelected) ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', gap: '6px', marginTop: '8px' }}>
                <button
                  onClick={() => navigate(`/tracking?vehicle=${currentSelected.id}`)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '7px',
                    background: '#0F172A',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                  className="hover:opacity-90"
                >
                  <Navigation size={12} />
                  <span>Live Track</span>
                </button>
                <button
                  onClick={() => navigate(`/history?vehicle=${currentSelected.id}`)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '7px',
                    background: '#FFFFFF',
                    color: '#334155',
                    border: '1px solid #CBD5E1',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                  className="hover:bg-slate-50"
                >
                  <History size={12} />
                  <span>Playback</span>
                </button>
                {hasVehicleFuelCapability(currentSelected) && (
                  <button
                    onClick={() => navigate(`/fuel-analytics?vehicle=${currentSelected.id}`)}
                    style={{
                      padding: '6px 8px',
                      borderRadius: '7px',
                      background: '#0284C7',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                    className="hover:opacity-90"
                  >
                    <Activity size={12} />
                    <span>Fuel</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Mobile Floating Button to switch back to List */}
          <div className="md:hidden" style={{ position: 'absolute', bottom: '16px', left: '16px', zIndex: 1000 }}>
            <button
              onClick={() => setMobileTab('list')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '9px 16px', borderRadius: '30px',
                background: '#0F172A', color: '#FFFFFF',
                fontSize: '12px', fontWeight: 700, border: 'none',
                boxShadow: '0 4px 14px rgba(0,0,0,0.35)', cursor: 'pointer'
              }}
            >
              <Truck size={15} color="#38BDF8" />
              <span>Vehicles ({filtered.length})</span>
            </button>
          </div>

          {/* ── Nearby Mode Controls ── */}
          {vehicles.length > 1 && currentSelected && (
            <div style={{
              position: 'absolute',
              bottom: window.innerWidth > 1250 ? '20px' : (window.innerWidth > 768 ? 'auto' : '65px'),
              top: window.innerWidth > 1250 ? 'auto' : (window.innerWidth > 768 ? '105px' : 'auto'),
              right: window.innerWidth > 768 ? '16px' : '12px',
              left: window.innerWidth > 768 ? 'auto' : '12px',
              zIndex: 1000,
              background: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.7)',
              borderRadius: '12px',
              padding: '9px 12px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              width: window.innerWidth > 768 ? '210px' : 'calc(100% - 24px)',
              maxWidth: '220px'
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

      {/* Manual Fuel Entry Modal */}
      {isFuelEntryOpen && (
        <ManualFuelEntryModal
          isOpen={isFuelEntryOpen}
          vehicle={selectedFuelVehicle}
          vehicles={vehicles}
          onClose={() => {
            setIsFuelEntryOpen(false);
            setSelectedFuelVehicle(null);
          }}
          onEntryAdded={() => {
            if (typeof refetch === 'function') refetch();
          }}
        />
      )}

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
