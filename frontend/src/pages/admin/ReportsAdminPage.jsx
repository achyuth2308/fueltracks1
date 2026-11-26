import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  FileText, ArrowLeft, Map, Activity, Route, Zap, TrendingUp, Printer, Truck,
  Search, RefreshCw, AlertCircle, Loader2, MapPin,
  PlayCircle, PauseCircle, StopCircle, Navigation,
  Gauge, Users, UserCircle, Building, Calendar, Wifi, WifiOff,
  Clock, AlertTriangle, Filter, Droplets, FileSpreadsheet, ExternalLink
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useVehicles } from '../../hooks/useVehicles';
import { formatVoltage } from '../../utils/formatUtils';
import { formatLocalDate } from '../../utils/dateUtils';
import AddressText from '../../components/ui/AddressText';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';
import { hasAnyFuelVehicle } from '../../utils/licenseUtils';

const formatDateTimeLines = (isoString) => {
  if (!isoString) return { time: '-', date: '-' };
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return { time: '-', date: '-' };
  const pad = n => String(n).padStart(2, '0');
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const date = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
  return { time, date };
};

const formatHMS = (seconds) => {
  if (!seconds || seconds <= 0 || isNaN(seconds)) return '00:00:00';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const getVehicleDuration = (v) => {
  if (v.duration_seconds) return formatHMS(v.duration_seconds);
  if (v.status_since) {
    const sec = Math.floor((Date.now() - new Date(v.status_since).getTime()) / 1000);
    if (sec > 0 && sec < 86400 * 30) return formatHMS(sec);
  }
  if (v.last_seen) {
    const sec = Math.floor((Date.now() - new Date(v.last_seen).getTime()) / 1000);
    if (sec > 0 && sec < 86400 * 30) return formatHMS(sec);
  }
  return '00:00:00';
};

// Accurate status detection aligned with speed, ignition & telemetry activity
const getVehicleStatusDetails = (v) => {
  const speed = Math.round(v.current_speed !== undefined ? v.current_speed : (v.speed || 0));
  const ignition = !!(v.current_ignition !== undefined ? v.current_ignition : v.ignition);
  const rawStatus = (v.status || '').toLowerCase();

  // 1. Moving / Running
  if (rawStatus === 'running' || speed > 2) {
    return {
      status: 'running',
      label: 'Running',
      color: '#10B981',
      pinColor: '#10B981', // Radiant Emerald Green
      pinColorDark: '#047857'
    };
  }

  // 2. Idle (Ignition ON, Stationary)
  if (rawStatus === 'idle' || (ignition && speed <= 2)) {
    return {
      status: 'idle',
      label: 'Idle',
      color: '#F59E0B',
      pinColor: '#F59E0B', // Radiant Amber
      pinColorDark: '#B45309'
    };
  }

  // 3. Parked (Explicitly Parked or stopped)
  if (rawStatus === 'parked') {
    return {
      status: 'parked',
      label: 'Parked',
      color: '#EF4444',
      pinColor: '#EF4444', // Radiant Ruby Red
      pinColorDark: '#B91C1C'
    };
  }

  // 4. Time-based detection for remaining
  if (v.last_seen) {
    const diffMs = Date.now() - new Date(v.last_seen).getTime();
    if (diffMs < 30 * 60 * 1000) {
      // Recent packet within 30 min, engine OFF -> Parked
      return {
        status: 'parked',
        label: 'Parked',
        color: '#EF4444',
        pinColor: '#EF4444',
        pinColorDark: '#B91C1C'
      };
    } else {
      // Exceeded 30 min without communication -> No Data
      return {
        status: 'nodata',
        label: 'No Data',
        color: '#64748B',
        pinColor: '#64748B', // Titanium Slate
        pinColorDark: '#334155'
      };
    }
  }

  // Never seen -> Unreachable
  return {
    status: 'unreachable',
    label: 'Unreachable',
    color: '#94A3B8',
    pinColor: '#94A3B8', // Platinum Pearl
    pinColorDark: '#475569'
  };
};

const renderMapPointer = (details) => {
  return (
    <div title={details.label} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
      <svg width="18" height="22" viewBox="0 0 24 28" fill="none" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.25))' }}>
        <path
          d="M12 0C5.372 0 0 5.372 0 12c0 9 12 16 12 16s12-7 12-16c0-6.628-5.372-12-12-12z"
          fill={details.pinColor}
          stroke="#FFFFFF"
          strokeWidth="1.2"
        />
        <circle cx="12" cy="11" r="4.2" fill="#FFFFFF" />
        <circle cx="12" cy="11" r="2.2" fill={details.pinColor} />
      </svg>
    </div>
  );
};

const ReportsAdminPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { vehicles, loading, error, refetch } = useVehicles();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const metrics = useMemo(() => {
    let running = 0, idle = 0, parking = 0, noData = 0, unreachable = 0, totalKms = 0, notSynced = 0;
    vehicles.forEach(v => {
      totalKms += Number(v.current_odometer || 0);
      const details = getVehicleStatusDetails(v);
      if (details.status === 'running') running++;
      else if (details.status === 'idle') idle++;
      else if (details.status === 'parked') parking++;
      else if (details.status === 'nodata') noData++;
      else unreachable++;

      if (!v.last_seen || (Date.now() - new Date(v.last_seen).getTime()) > 24 * 60 * 60 * 1000) notSynced++;
    });
    return {
      total: vehicles.length,
      online: running + idle + parking,
      running, idle, parking, noData, unreachable,
      totalKms: Math.round(totalKms),
      notSynced
    };
  }, [vehicles]);

  // Modern executive status cards with clean design system
  const STATUS_CARDS = [
    { key: 'total', label: 'Total Fleet', value: metrics.total, color: '#4F46E5', bg: '#EEF2FF', icon: Users },
    { key: 'online', label: 'Online', value: metrics.online, color: '#059669', bg: '#ECFDF5', icon: Wifi },
    { key: 'running', label: 'Running', value: metrics.running, color: '#0D9488', bg: '#F0FDFA', icon: PlayCircle },
    { key: 'idle', label: 'Idle', value: metrics.idle, color: '#EA580C', bg: '#FFF7ED', icon: Clock },
    { key: 'parking', label: 'Parking', value: metrics.parking, color: '#475569', bg: '#F8FAFC', icon: StopCircle },
    { key: 'noData', label: 'No Data', value: metrics.noData, color: '#DC2626', bg: '#FEF2F2', icon: AlertTriangle },
    { key: 'totalKms', label: 'Total KMS', value: metrics.totalKms, color: '#2563EB', bg: '#EFF6FF', icon: Navigation },
    { key: 'notSynced', label: 'Not Synced', value: metrics.notSynced, color: '#0284C7', bg: '#F0F9FF', icon: WifiOff }
  ];

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      const details = getVehicleStatusDetails(v);
      if (statusFilter === 'online') {
        if (details.status !== 'running' && details.status !== 'idle' && details.status !== 'parked') return false;
      } else if (statusFilter === 'running') {
        if (details.status !== 'running') return false;
      } else if (statusFilter === 'idle') {
        if (details.status !== 'idle') return false;
      } else if (statusFilter === 'parking') {
        if (details.status !== 'parked') return false;
      } else if (statusFilter === 'noData') {
        if (details.status !== 'nodata' && details.status !== 'unreachable') return false;
      } else if (statusFilter === 'notSynced') {
        if (v.last_seen && (Date.now() - new Date(v.last_seen).getTime()) <= 24 * 60 * 60 * 1000) return false;
      }

      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (v.name || '').toLowerCase().includes(q) || (v.plate || '').toLowerCase().includes(q) || (v.driver_name || '').toLowerCase().includes(q);
    });
  }, [vehicles, searchQuery, statusFilter]);

  // Check whether any vehicle has a fuel sensor installed or licensed
  const hasFuelFeature = useMemo(() => {
    if (user?.role === 'superadmin' || user?.role === 'dealer') return true;
    if (!vehicles || vehicles.length === 0) return false;
    return hasAnyFuelVehicle(vehicles);
  }, [vehicles, user]);

  const isFuelTab = location.pathname.startsWith('/admin/reports/fuel-') || 
                    location.pathname === '/admin/reports/kmpl-mileage' || 
                    location.pathname === '/admin/reports/lph-burn-rate';

  useEffect(() => {
    if (!loading && vehicles.length > 0 && !hasFuelFeature && isFuelTab) {
      navigate('/admin/reports/distance', { replace: true });
    }
  }, [loading, vehicles, hasFuelFeature, isFuelTab, navigate]);

  const GENERAL_REPORT_TABS = [
    { path: '/admin/reports/dashboard', label: 'Fleet Dashboard' },
    { path: '/admin/reports/distance', label: 'Daily Distance' },
    { path: '/admin/reports/ignition', label: 'Engine ON' },
    { path: '/admin/reports/overspeeding', label: 'Overspeeding' },
    { path: '/admin/reports/stoppage', label: 'Stoppage' },
    { path: '/admin/reports/idle', label: 'Idle Wastage' },
    { path: '/admin/reports/individual', label: 'Individual' },
    { path: '/admin/reports/trip', label: 'Automated Trips' },
    { path: '/admin/reports/manual-trips', label: 'Manual Trips' },
    { path: '/admin/reports/daily-trip', label: 'Total Trip' },
    { path: '/admin/reports/consolidated', label: 'Vehicle Consolidated' }
  ];

  const FUEL_REPORT_TABS = [
    { path: '/admin/reports/fuel-refill', label: 'Fuel Refill Report', isFuel: true },
    { path: '/admin/reports/fuel-consumption', label: 'Fuel Consumption', isFuel: true },
    { path: '/admin/reports/fuel-theft', label: 'Fuel Theft Report', isFuel: true },
    { path: '/admin/reports/fuel-consolidated', label: 'Fuel Consolidated', isFuel: true },
    { path: '/admin/reports/kmpl-mileage', label: 'KMPL Mileage Report', isFuel: true },
    { path: '/admin/reports/lph-burn-rate', label: 'LPH Engine Burn Rate', isFuel: true }
  ];

  const REPORT_TABS = useMemo(() => {
    if (isFuelTab) {
      return FUEL_REPORT_TABS;
    }
    return GENERAL_REPORT_TABS;
  }, [isFuelTab]);

  const exportColumns = useMemo(() => {
    const cols = ['Vehicle Name', 'Reg No', 'Last Seen', 'Last Comm', 'Driver', 'Driver Mobile', 'Kms', 'Speed', 'Status', 'Duration', 'Veh Battery', 'A/C'];
    if (hasFuelFeature) cols.push('Fuel (Ltrs)');
    cols.push('Celsius', 'Nearest Location');
    return cols;
  }, [hasFuelFeature]);

  const getExportData = () => {
    return filteredVehicles.map(v => {
      const seen = formatDateTimeLines(v.last_seen);
      const comm = formatDateTimeLines(v.last_communication || v.last_seen || v.updated_at);
      const speed = Math.round(v.current_speed || 0);
      const ignition = !!(v.current_ignition !== undefined ? v.current_ignition : v.ignition);
      const details = getVehicleStatusDetails(v);
      const row = {
        'Vehicle Name': v.name || '-',
        'Reg No': v.plate || '-',
        'Last Seen': `${seen.time} ${seen.date}`,
        'Last Comm': `${comm.time} ${comm.date}`,
        'Driver': v.driver_name || '-',
        'Driver Mobile': v.driver_phone || v.driver_mobile || '-',
        'Kms': v.distance_today !== undefined ? Number(v.distance_today).toFixed(2) : (v.today_kms !== undefined ? Number(v.today_kms).toFixed(2) : (v.current_odometer ? (Number(v.current_odometer) % 1000).toFixed(2) : '0.00')),
        'Speed': speed,
        'Status': details.label,
        'Duration': getVehicleDuration(v),
        'Veh Battery': formatVoltage(v.current_voltage || v.metadata?.batteryVoltage),
        'A/C': ignition ? 'ON' : 'OFF',
      };
      if (hasFuelFeature) {
        row['Fuel (Ltrs)'] = v.current_fuel !== undefined ? Number(v.current_fuel).toFixed(1) : (v.fuel_level !== undefined ? Number(v.fuel_level).toFixed(1) : '0');
      }
      row['Celsius'] = v.temperature !== undefined ? `${v.temperature}` : '0';
      row['Nearest Location'] = v.address || '-';
      return row;
    });
  };

  return (
    <div style={{ padding: '0', background: '#F8FAFC', height: '100%', minHeight: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', fontFamily: "'Inter', system-ui, sans-serif", overflow: 'hidden' }}>

      {/* ═══════════ TOP HORIZONTAL REPORT TABS BAR ═══════════ */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0',
        padding: '0 8px',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        flexShrink: 0,
        gap: '4px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
      }}>
        <button
          type="button"
          onClick={() => {
            if (isFuelTab) {
              navigate('/admin/reports/distance');
            } else {
              navigate(-1);
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: isFuelTab ? '5px' : '0',
            padding: isFuelTab ? '0 10px' : '0',
            height: '30px',
            borderRadius: '6px',
            border: '1px solid #CBD5E1',
            background: isFuelTab ? '#F8FAFC' : '#FFFFFF',
            cursor: 'pointer',
            color: '#334155',
            fontSize: '11px',
            fontWeight: 700,
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            transition: 'all 0.15s ease',
            flexShrink: 0
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.borderColor = '#94A3B8'; }}
          onMouseLeave={e => { e.currentTarget.style.background = isFuelTab ? '#F8FAFC' : '#FFFFFF'; e.currentTarget.style.borderColor = '#CBD5E1'; }}
          title={isFuelTab ? "Back to General Reports" : "Go Back"}
        >
          <ArrowLeft size={14} />
          {isFuelTab && <span>General Reports</span>}
        </button>
        {REPORT_TABS.map(tab => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              style={{
                padding: '7px 12px',
                background: isActive ? '#FFF7ED' : 'transparent',
                border: 'none',
                borderBottom: isActive ? '2.5px solid #EA580C' : '2.5px solid transparent',
                borderRadius: '6px 6px 0 0',
                color: isActive ? '#EA580C' : '#334155',
                fontWeight: isActive ? 800 : 600,
                fontSize: '11.5px',
                letterSpacing: '0.01em',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.color = '#EA580C';
                  e.currentTarget.style.background = '#F8FAFC';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.color = '#334155';
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ═══════════ CONTENT (DASHBOARD OR OUTLET) ═══════════ */}
      {location.pathname === '/admin/reports/dashboard' ? (
        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'auto', background: '#F8FAFC', gap: '10px' }}>

          {/* 8 Modern Clean Stat Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
            gap: '8px',
            flexShrink: 0
          }}>
            {STATUS_CARDS.map(card => {
              const isSelected = statusFilter === card.key;
              const Icon = card.icon;
              return (
                <div
                  key={card.key}
                  onClick={() => setStatusFilter(prev => prev === card.key ? 'all' : card.key)}
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    border: isSelected ? '1.5px solid #EA580C' : '1px solid #E2E8F0',
                    borderTop: `3px solid ${card.color}`,
                    boxShadow: isSelected
                      ? '0 0 0 2px rgba(234, 88, 12, 0.15), 0 2px 6px rgba(0,0,0,0.06)'
                      : '0 1px 3px rgba(0,0,0,0.04)',
                    transition: 'all 0.15s ease',
                    userSelect: 'none'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.08)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = isSelected
                      ? '0 0 0 2px rgba(234, 88, 12, 0.15), 0 2px 6px rgba(0,0,0,0.06)'
                      : '0 1px 3px rgba(0,0,0,0.04)';
                  }}
                  title={`Click to filter by ${card.label}`}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748B', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      {card.label}
                    </span>
                    <span style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', lineHeight: 1.1 }}>
                      {card.value}
                    </span>
                  </div>
                  <div style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    background: card.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Icon size={15} color={card.color} strokeWidth={2.4} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action & Search Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            padding: '2px 0',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '260px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '6px 10px',
                background: '#FFFFFF',
                width: '100%',
                maxWidth: '300px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
              }}>
                <Search size={14} color="#64748B" />
                <input
                  type="text"
                  placeholder="Search vehicle reg no or name..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: '12px', color: '#0F172A' }}
                />
              </div>

              {statusFilter !== 'all' && (
                <button
                  onClick={() => setStatusFilter('all')}
                  style={{
                    background: '#EFF6FF',
                    border: '1px solid #BFDBFE',
                    color: '#1D4ED8',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>Filtered: {statusFilter}</span>
                  <span style={{ fontWeight: 800 }}>&times;</span>
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={() => exportToExcel(getExportData(), 'fleet_telemetry_dashboard')}
                disabled={filteredVehicles.length === 0}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  color: '#15803D',
                  cursor: filteredVehicles.length ? 'pointer' : 'not-allowed',
                  transition: 'all 0.15s ease'
                }}
              >
                <FileSpreadsheet size={13} color="#16A34A" />
                Excel
              </button>

              <button
                onClick={() => exportToPDF(exportColumns, getExportData(), 'Fleet Telemetry Dashboard', 'fleet_telemetry_dashboard')}
                disabled={filteredVehicles.length === 0}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  color: '#B91C1C',
                  cursor: filteredVehicles.length ? 'pointer' : 'not-allowed',
                  transition: 'all 0.15s ease'
                }}
              >
                <FileText size={13} color="#DC2626" />
                PDF
              </button>

              <button
                onClick={() => refetch()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  color: '#334155',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <RefreshCw size={12} color="#64748B" />
                Refresh
              </button>
            </div>
          </div>

          {/* Table Card Container */}
          <div style={{
            flex: 1,
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
            overflow: 'hidden',
            background: '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', minWidth: '1300px' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ background: '#0F172A', borderBottom: '1px solid #1E293B' }}>
                    <th style={{ background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '9px 8px', borderRight: '1px solid rgba(255,255,255,0.08)', textAlign: 'left', minWidth: '130px' }}>Vehicle Name</th>
                    <th style={{ background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '9px 8px', borderRight: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', width: '90px' }}>Reg No</th>
                    <th style={{ background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '9px 8px', borderRight: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', width: '85px' }}>Last Seen</th>
                    <th style={{ background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '9px 8px', borderRight: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', width: '85px' }}>Last Comm</th>
                    <th style={{ background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '9px 8px', borderRight: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', width: '85px' }}>Driver</th>
                    <th style={{ background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '9px 8px', borderRight: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', width: '95px' }}>Driver Mobile</th>
                    <th style={{ background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '9px 8px', borderRight: '1px solid rgba(255,255,255,0.08)', textAlign: 'right', width: '65px' }}>Kms</th>
                    <th style={{ background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '9px 8px', borderRight: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', width: '55px' }}>Speed</th>
                    <th style={{ background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '9px 8px', borderRight: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', width: '60px' }}>Position</th>
                    <th style={{ background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '9px 8px', borderRight: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', width: '90px' }}>Duration HH:MM:SS</th>
                    <th style={{ background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '9px 8px', borderRight: '1px solid rgba(255,255,255,0.08)', textAlign: 'right', width: '75px' }}>Veh Battery</th>
                    <th style={{ background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '9px 8px', borderRight: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', width: '55px' }}>A/C</th>
                    {hasFuelFeature && (
                      <th style={{ background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '9px 8px', borderRight: '1px solid rgba(255,255,255,0.08)', textAlign: 'right', width: '70px' }}>Fuel (Ltrs)</th>
                    )}
                    <th style={{ background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '9px 8px', borderRight: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', width: '55px' }}>Celsius</th>
                    <th style={{ background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '9px 8px', borderRight: '1px solid rgba(255,255,255,0.08)', textAlign: 'left', minWidth: '200px' }}>Nearest Location</th>
                    <th style={{ background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '9px 8px', textAlign: 'center', width: '55px' }}>G-Map</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={hasFuelFeature ? 16 : 15} style={{ padding: '36px', textAlign: 'center', borderBottom: '1px solid #E2E8F0' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#EA580C', fontSize: '12.5px', fontWeight: 600 }}>
                          <Loader2 size={16} className="animate-spin text-orange-600" />
                          <span>Syncing fleet telemetry data...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredVehicles.length === 0 ? (
                    <tr>
                      <td colSpan={hasFuelFeature ? 16 : 15} style={{ padding: '32px', textAlign: 'center', color: '#64748B', borderBottom: '1px solid #E2E8F0', fontSize: '12.5px' }}>
                        No vehicles found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredVehicles.map((v, idx) => {
                      const speed = Math.round(v.current_speed !== undefined ? v.current_speed : (v.speed || 0));
                      const ignition = !!(v.current_ignition !== undefined ? v.current_ignition : v.ignition);
                      const details = getVehicleStatusDetails(v);

                      const seen = formatDateTimeLines(v.last_seen);
                      const comm = formatDateTimeLines(v.last_communication || v.last_seen || v.updated_at);
                      const bg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';

                      return (
                        <tr
                          key={v.id}
                          style={{ background: bg, transition: 'background 0.15s ease' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#FFF7ED'}
                          onMouseLeave={e => e.currentTarget.style.background = bg}
                        >
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #F1F5F9', color: '#0284C7', fontWeight: 700, fontSize: '12px', whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => navigate(`/vehicles/${v.id}`)}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                              <Truck size={13} color="#0284C7" />
                              <span style={{ textDecoration: 'none' }} onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>{v.name || '—'}</span>
                            </div>
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #F1F5F9', color: '#1E293B', fontWeight: 600, fontSize: '11px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                            {v.plate || <span style={{ color: '#94A3B8' }}>—</span>}
                          </td>
                          <td style={{ padding: '4px 6px', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #F1F5F9', textAlign: 'center', whiteSpace: 'nowrap', lineHeight: 1.25 }}>
                            <div style={{ fontSize: '11px', color: '#0F172A', fontWeight: 600 }}>{seen.time}</div>
                            <div style={{ fontSize: '10px', color: '#64748B' }}>{seen.date}</div>
                          </td>
                          <td style={{ padding: '4px 6px', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #F1F5F9', textAlign: 'center', whiteSpace: 'nowrap', lineHeight: 1.25 }}>
                            <div style={{ fontSize: '11px', color: '#0F172A', fontWeight: 600 }}>{comm.time}</div>
                            <div style={{ fontSize: '10px', color: '#64748B' }}>{comm.date}</div>
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #F1F5F9', color: '#334155', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {v.driver_name || <span style={{ color: '#94A3B8' }}>—</span>}
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #F1F5F9', color: '#334155', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {v.driver_phone || v.driver_mobile || <span style={{ color: '#94A3B8' }}>—</span>}
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #F1F5F9', color: '#0F172A', fontWeight: 600, fontSize: '11px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {v.distance_today !== undefined ? Number(v.distance_today).toFixed(2) : (v.today_kms !== undefined ? Number(v.today_kms).toFixed(2) : (v.current_odometer ? (Number(v.current_odometer) % 1000).toFixed(2) : '0.00'))}
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #F1F5F9', color: speed > 0 ? '#10B981' : '#64748B', fontWeight: 700, fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {speed}
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #F1F5F9', textAlign: 'center' }}>
                            {renderMapPointer(details)}
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #F1F5F9', color: '#334155', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                            {getVehicleDuration(v)}
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #F1F5F9', color: '#334155', fontSize: '11px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600 }}>
                            {formatVoltage(v.current_voltage || v.metadata?.batteryVoltage)}
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #F1F5F9', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 700,
                              background: ignition ? '#ECFDF5' : '#F1F5F9',
                              color: ignition ? '#047857' : '#64748B',
                              border: ignition ? '1px solid #A7F3D0' : '1px solid #E2E8F0'
                            }}>
                              {ignition ? 'ON' : 'OFF'}
                            </span>
                          </td>
                          {hasFuelFeature && (
                            <td style={{ padding: '6px 8px', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #F1F5F9', color: '#0F172A', fontSize: '11px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600 }}>
                              {v.current_fuel !== undefined ? Number(v.current_fuel).toFixed(1) : (v.fuel_level !== undefined ? Number(v.fuel_level).toFixed(1) : '0')}
                            </td>
                          )}
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #F1F5F9', color: '#334155', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {v.temperature !== undefined ? `${v.temperature}` : '0'}
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #F1F5F9', color: '#1E293B', fontSize: '11px', textAlign: 'left', minWidth: '200px', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.25 }}>
                            {v.address ? v.address : ((v.lat && v.lng) ? <AddressText lat={v.lat} lng={v.lng} /> : <span style={{ color: '#94A3B8' }}>Location unavailable</span>)}
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #E2E8F0', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {(v.lat && v.lng) ? (
                              <a
                                href={`https://maps.google.com/?q=${v.lat},${v.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#0284C7', fontWeight: 700, fontSize: '11px', textDecoration: 'none' }}
                                onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                                onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                              >
                                View
                              </a>
                            ) : <span style={{ color: '#94A3B8' }}>—</span>}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div style={{
              padding: '7px 12px',
              background: '#F8FAFC',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11.5px',
              color: '#64748B',
              fontWeight: 600,
              flexShrink: 0
            }}>
              <span>Showing <strong>{filteredVehicles.length}</strong> of <strong>{vehicles.length}</strong> vehicles</span>
              {statusFilter !== 'all' && (
                <span style={{ color: '#EA580C', fontWeight: 700 }}>Filter applied: {statusFilter}</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Outlet />
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}} />
    </div>
  );
};

export default ReportsAdminPage;
