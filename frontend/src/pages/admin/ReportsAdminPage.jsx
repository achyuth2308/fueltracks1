import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  FileText, ArrowLeft, Map, Activity, Route, Zap, TrendingUp, Printer,
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

  // Unique modern executive cards with sleek gradients, subtle icons, and frosted counters
  const STATUS_CARDS = [
    { key: 'total', label: 'Total Fleet', value: metrics.total, grad: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)', icon: Users, accent: '#A5B4FC' },
    { key: 'online', label: 'Online', value: metrics.online, grad: 'linear-gradient(135deg, #064E3B 0%, #047857 100%)', icon: Wifi, accent: '#6EE7B7' },
    { key: 'running', label: 'Running', value: metrics.running, grad: 'linear-gradient(135deg, #0F766E 0%, #0D9488 100%)', icon: PlayCircle, accent: '#5EEAD4' },
    { key: 'idle', label: 'Idle', value: metrics.idle, grad: 'linear-gradient(135deg, #C2410C 0%, #EA580C 100%)', icon: Clock, accent: '#FDBA74' },
    { key: 'parking', label: 'Parking', value: metrics.parking, grad: 'linear-gradient(135deg, #374151 0%, #4B5563 100%)', icon: StopCircle, accent: '#CBD5E1' },
    { key: 'noData', label: 'No Data', value: metrics.noData, grad: 'linear-gradient(135deg, #9F1239 0%, #BE123C 100%)', icon: AlertTriangle, accent: '#FDA4AF' },
    { key: 'totalKms', label: 'Total KMS', value: metrics.totalKms, grad: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)', icon: Navigation, accent: '#93C5FD' },
    { key: 'notSynced', label: 'Not Synced', value: metrics.notSynced, grad: 'linear-gradient(135deg, #0369A1 0%, #0284C7 100%)', icon: WifiOff, accent: '#7DD3FC' }
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

  const REPORT_TABS = [
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
    { path: '/admin/reports/consolidated', label: 'Vehicle Consolidated' },
    { path: '/admin/reports/fuel-refill', label: 'Fuel Refill Report' },
    { path: '/admin/reports/fuel-consumption', label: 'Fuel Consumption' },
    { path: '/admin/reports/fuel-theft', label: 'Fuel Theft Report' },
    { path: '/admin/reports/fuel-consolidated', label: 'Fuel Consolidated' },
    { path: '/admin/reports/kmpl-mileage', label: 'KMPL Mileage Report' },
    { path: '/admin/reports/lph-burn-rate', label: 'LPH Engine Burn Rate' }
  ];

  const exportColumns = ['Vehicle Name', 'Reg No', 'Last Seen', 'Last Comm', 'Driver', 'Driver Mobile', 'Kms', 'Speed', 'Status', 'Duration', 'Veh Battery', 'A/C', 'Fuel (Ltrs)', 'Celsius', 'Nearest Location'];

  const getExportData = () => {
    return filteredVehicles.map(v => {
      const seen = formatDateTimeLines(v.last_seen);
      const comm = formatDateTimeLines(v.last_communication || v.last_seen || v.updated_at);
      const speed = Math.round(v.current_speed || 0);
      const ignition = !!(v.current_ignition !== undefined ? v.current_ignition : v.ignition);
      const details = getVehicleStatusDetails(v);
      return {
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
        'Fuel (Ltrs)': v.current_fuel !== undefined ? Number(v.current_fuel).toFixed(1) : (v.fuel_level !== undefined ? Number(v.fuel_level).toFixed(1) : '0'),
        'Celsius': v.temperature !== undefined ? `${v.temperature}` : '0',
        'Nearest Location': v.address || '-'
      };
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
          onClick={() => navigate(-1)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            border: '1px solid #CBD5E1',
            background: '#FFFFFF',
            cursor: 'pointer',
            color: '#334155',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            transition: 'all 0.15s ease',
            flexShrink: 0
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#94A3B8'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#CBD5E1'; }}
          title="Go Back"
        >
          <ArrowLeft size={16} />
        </button>
        {REPORT_TABS.map(tab => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              style={{
                padding: '9px 14px',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2.5px solid #059669' : '2.5px solid transparent',
                borderRadius: '4px 4px 0 0',
                color: isActive ? '#047857' : '#1E293B',
                fontWeight: isActive ? 800 : 600,
                fontSize: '11.5px',
                letterSpacing: '0.02em',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.18s ease'
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.color = '#047857';
                  e.currentTarget.style.background = '#F0FDF4';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.color = '#1E293B';
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
        <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'auto', background: '#FFFFFF', gap: '6px' }}>

          {/* 8 Unique Modern Executive Cards (2 rows of 4, compact & elegant) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '6px',
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
                    background: card.grad,
                    borderRadius: '6px',
                    padding: '6px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    border: isSelected ? '1px solid #FFFFFF' : '1px solid rgba(255, 255, 255, 0.15)',
                    boxShadow: isSelected
                      ? '0 0 0 2px #2563EB, 0 4px 10px rgba(0,0,0,0.2)'
                      : '0 1px 3px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.18)',
                    transition: 'all 0.18s ease',
                    userSelect: 'none'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.18)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = isSelected
                      ? '0 0 0 2px #2563EB, 0 4px 10px rgba(0,0,0,0.2)'
                      : '0 1px 3px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.18)';
                  }}
                  title={`Click to filter by ${card.label}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Icon size={13} color={card.accent} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#FFFFFF', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                      {card.label}
                    </span>
                  </div>
                  <span style={{
                    background: 'rgba(255, 255, 255, 0.22)',
                    backdropFilter: 'blur(4px)',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 800,
                    color: '#FFFFFF',
                    minWidth: '22px',
                    textAlign: 'center',
                    boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.1)'
                  }}>
                    {card.value}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Compact Action & Search Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            padding: '2px 0',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                border: '1px solid #CBD5E1',
                borderRadius: '4px',
                padding: '3px 8px',
                background: '#F8FAFC',
                width: '240px'
              }}>
                <Search size={12} color="#64748B" />
                <input
                  type="text"
                  placeholder="Search vehicle reg no or name..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: '11px', color: '#0F172A' }}
                />
              </div>

              {statusFilter !== 'all' && (
                <button
                  onClick={() => setStatusFilter('all')}
                  style={{
                    background: '#EFF6FF',
                    border: '1px solid #DBEAFE',
                    color: '#2563EB',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Filtered: {statusFilter} &times;
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
                  gap: '4px',
                  background: '#F0FDF4',
                  border: '1px solid #DCFCE7',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#15803D',
                  cursor: filteredVehicles.length ? 'pointer' : 'not-allowed'
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
                  gap: '4px',
                  background: '#FEF2F2',
                  border: '1px solid #FEE2E2',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#B91C1C',
                  cursor: filteredVehicles.length ? 'pointer' : 'not-allowed'
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
                  gap: '4px',
                  background: '#F8FAFC',
                  border: '1px solid #CBD5E1',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#475569',
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={12} />
                Refresh
              </button>
            </div>
          </div>

          {/* Table Container - True Excel Grid Layout with Exact Columns */}
          <div style={{
            flex: 1,
            border: '1px solid #CBD5E1',
            overflow: 'auto',
            background: '#FFFFFF'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', minWidth: '1300px' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr style={{ background: '#064E3B', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
                  <th style={{ background: '#064E3B', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '8px 6px', border: '1px solid rgba(255,255,255,0.15)', textAlign: 'left', minWidth: '130px' }}>Vehicle Name</th>
                  <th style={{ background: '#064E3B', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '8px 6px', border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center', width: '90px' }}>Reg No</th>
                  <th style={{ background: '#064E3B', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '8px 6px', border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center', width: '85px' }}>Last Seen</th>
                  <th style={{ background: '#064E3B', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '8px 6px', border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center', width: '85px' }}>Last Comm</th>
                  <th style={{ background: '#064E3B', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '8px 6px', border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center', width: '80px' }}>Driver</th>
                  <th style={{ background: '#064E3B', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '8px 6px', border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center', width: '90px' }}>Driver Mobile</th>
                  <th style={{ background: '#064E3B', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '8px 6px', border: '1px solid rgba(255,255,255,0.15)', textAlign: 'right', width: '60px' }}>Kms</th>
                  <th style={{ background: '#064E3B', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '8px 6px', border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center', width: '50px' }}>Speed</th>
                  <th style={{ background: '#064E3B', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '8px 6px', border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center', width: '55px' }}>Position</th>
                  <th style={{ background: '#064E3B', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '8px 6px', border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center', width: '80px' }}>Duration HH:MM:SS</th>
                  <th style={{ background: '#064E3B', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '8px 6px', border: '1px solid rgba(255,255,255,0.15)', textAlign: 'right', width: '70px' }}>Veh Battery</th>
                  <th style={{ background: '#064E3B', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '8px 6px', border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center', width: '50px' }}>A/C</th>
                  <th style={{ background: '#064E3B', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '8px 6px', border: '1px solid rgba(255,255,255,0.15)', textAlign: 'right', width: '65px' }}>Fuel (Ltrs)</th>
                  <th style={{ background: '#064E3B', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '8px 6px', border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center', width: '50px' }}>Celsius</th>
                  <th style={{ background: '#064E3B', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '8px 6px', border: '1px solid rgba(255,255,255,0.15)', textAlign: 'left', minWidth: '200px' }}>Nearest Location</th>
                  <th style={{ background: '#064E3B', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '8px 6px', border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center', width: '50px' }}>G-Map</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={16} style={{ padding: '30px', textAlign: 'center', border: '1px solid #CBD5E1' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#059669', fontSize: '12px', fontWeight: 600 }}>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Syncing fleet telemetry data...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredVehicles.length === 0 ? (
                  <tr>
                    <td colSpan={16} style={{ padding: '24px', textAlign: 'center', color: '#64748B', border: '1px solid #CBD5E1', fontSize: '12px' }}>
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
                        onMouseEnter={e => e.currentTarget.style.background = '#ECFDF5'}
                        onMouseLeave={e => e.currentTarget.style.background = bg}
                      >
                        <td style={{ padding: '4px 6px', border: '1px solid #CBD5E1', color: '#0284C7', fontWeight: 700, fontSize: '11.5px', whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => navigate(`/vehicles/${v.id}`)}>
                          {v.name || '-'}
                        </td>
                        <td style={{ padding: '4px 6px', border: '1px solid #CBD5E1', color: '#1E293B', fontWeight: 600, fontSize: '11px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                          {v.plate || '-'}
                        </td>
                        <td style={{ padding: '2px 4px', border: '1px solid #CBD5E1', textAlign: 'center', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                          <div style={{ fontSize: '11px', color: '#0F172A', fontWeight: 600 }}>{seen.time}</div>
                          <div style={{ fontSize: '10px', color: '#64748B' }}>{seen.date}</div>
                        </td>
                        <td style={{ padding: '2px 4px', border: '1px solid #CBD5E1', textAlign: 'center', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                          <div style={{ fontSize: '11px', color: '#0F172A', fontWeight: 600 }}>{comm.time}</div>
                          <div style={{ fontSize: '10px', color: '#64748B' }}>{comm.date}</div>
                        </td>
                        <td style={{ padding: '4px 6px', border: '1px solid #CBD5E1', color: '#334155', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {v.driver_name || '-'}
                        </td>
                        <td style={{ padding: '4px 6px', border: '1px solid #CBD5E1', color: '#334155', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {v.driver_phone || v.driver_mobile || '-'}
                        </td>
                        <td style={{ padding: '4px 6px', border: '1px solid #CBD5E1', color: '#0F172A', fontWeight: 600, fontSize: '11px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {v.distance_today !== undefined ? Number(v.distance_today).toFixed(2) : (v.today_kms !== undefined ? Number(v.today_kms).toFixed(2) : (v.current_odometer ? (Number(v.current_odometer) % 1000).toFixed(2) : '0.00'))}
                        </td>
                        <td style={{ padding: '4px 6px', border: '1px solid #CBD5E1', color: speed > 0 ? '#10B981' : '#64748B', fontWeight: 700, fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {speed}
                        </td>
                        <td style={{ padding: '4px 6px', border: '1px solid #CBD5E1', textAlign: 'center' }}>
                          {renderMapPointer(details)}
                        </td>
                        <td style={{ padding: '4px 6px', border: '1px solid #CBD5E1', color: '#334155', fontSize: '10.5px', textAlign: 'center', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                          {getVehicleDuration(v)}
                        </td>
                        <td style={{ padding: '4px 6px', border: '1px solid #CBD5E1', color: '#334155', fontSize: '11px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {formatVoltage(v.current_voltage || v.metadata?.batteryVoltage)}
                        </td>
                        <td style={{ padding: '4px 6px', border: '1px solid #CBD5E1', textAlign: 'center', whiteSpace: 'nowrap', fontWeight: 700, fontSize: '10.5px', color: ignition ? '#10B981' : '#64748B' }}>
                          {ignition ? 'ON' : 'OFF'}
                        </td>
                        <td style={{ padding: '4px 6px', border: '1px solid #CBD5E1', color: '#0F172A', fontSize: '11px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {v.current_fuel !== undefined ? Number(v.current_fuel).toFixed(1) : (v.fuel_level !== undefined ? Number(v.fuel_level).toFixed(1) : '0')}
                        </td>
                        <td style={{ padding: '4px 6px', border: '1px solid #CBD5E1', color: '#334155', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {v.temperature !== undefined ? `${v.temperature}` : '0'}
                        </td>
                        <td style={{ padding: '4px 6px', border: '1px solid #CBD5E1', color: '#1E293B', fontSize: '11px', textAlign: 'left', minWidth: '200px', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.2 }}>
                          {v.address ? v.address : ((v.lat && v.lng) ? <AddressText lat={v.lat} lng={v.lng} /> : <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Location unavailable</span>)}
                        </td>
                        <td style={{ padding: '4px 6px', border: '1px solid #CBD5E1', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {(v.lat && v.lng) ? (
                            <a
                              href={`https://maps.google.com/?q=${v.lat},${v.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#0284C7', fontWeight: 700, fontSize: '11px', textDecoration: 'none' }}
                              onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                              onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                            >
                              Link
                            </a>
                          ) : '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
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
