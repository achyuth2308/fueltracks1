import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  FileText, Map, Activity, Route, Zap, TrendingUp, Printer,
  Search, RefreshCw, AlertCircle, Loader2, MapPin,
  CheckCircle2, PlayCircle, PauseCircle, StopCircle,
  AlertOctagon, Navigation, RefreshCcw, Gauge, Users, UserCircle,
  Building, Calendar, Wifi, Clock, AlertTriangle, Filter, MoreVertical
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useVehicles } from '../../hooks/useVehicles';
import { formatVoltage, formatFuel } from '../../utils/formatUtils';
import { formatLocalDate, formatLocalTime } from '../../utils/dateUtils';
import AddressText from '../../components/ui/AddressText';

const formatDateTime = (isoString) => {
  return formatLocalTime(isoString);
};

const REPORT_TABS = [
  { title: "Trip Report", path: "/admin/reports/trip", icon: Map, color: "#9333EA", bg: "#F3E8FF" },
  { title: "Daily Distance", path: "/admin/reports/distance", icon: TrendingUp, color: "#0284C7", bg: "#E0F2FE" },
  { title: "Overspeeding", path: "/admin/reports/overspeeding", icon: Gauge, color: "#E11D48", bg: "#FFF1F2" },
  { title: "Stoppage & Idle", path: "/admin/reports/stoppage", icon: PauseCircle, color: "#EA580C", bg: "#FFF7ED" },
  { title: "Consolidated", path: "/admin/reports/consolidated", icon: Users, color: "#16A34A", bg: "#F0FDF4" },
  { title: "Individual", path: "/admin/reports/individual", icon: UserCircle, color: "#2563EB", bg: "#EFF6FF" },
];

const MetricCard = ({ label, value, color, icon: Icon, bg }) => (
  <div style={{
    background: bg,
    padding: '16px 20px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    transition: 'all 0.2s',
  }}>
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontSize: '11px', fontWeight: 800, color: color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>{value}</div>
    </div>
    <div style={{ color: color }}>
      <Icon size={24} />
    </div>
  </div>
);

const ReportsAdminPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { vehicles, loading, error, refetch } = useVehicles();
  const activeTab = location.pathname === '/admin/reports' ? 'dashboard' : 'other-reports';
  const [searchQuery, setSearchQuery] = useState('');

  const metrics = useMemo(() => {
    let running = 0, idle = 0, parking = 0, noData = 0, totalKms = 0, notSynced = 0;
    vehicles.forEach(v => {
      const isOnline = !!v.is_online;
      const speed = v.current_speed || 0;
      const ignition = !!v.current_ignition;
      totalKms += Number(v.current_odometer || 0);
      if (!isOnline) noData++;
      else if (speed > 0) running++;
      else if (ignition) idle++;
      else parking++;
      if (!v.last_seen || (new Date() - new Date(v.last_seen)) > 24 * 60 * 60 * 1000) notSynced++;
    });
    return {
      total: vehicles.length,
      online: running + idle + parking,
      running, idle, parking, noData,
      totalKms: Math.round(totalKms),
      notSynced
    };
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    if (!searchQuery) return vehicles;
    const q = searchQuery.toLowerCase();
    return vehicles.filter(v => v.name?.toLowerCase().includes(q) || v.plate?.toLowerCase().includes(q));
  }, [vehicles, searchQuery]);

  const today = formatLocalDate(new Date());

  const tabStyle = (tab) => ({
    padding: '14px 24px',
    background: 'transparent',
    border: 'none',
    borderBottom: activeTab === tab ? '3px solid #7ea0b6' : '3px solid transparent',
    color: activeTab === tab ? '#000000' : '#f97316',
    fontWeight: activeTab === tab ? 800 : 600,
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textTransform: 'uppercase',
    letterSpacing: '0.02em'
  });

  const TH = ({ children, align = 'left' }) => (
    <th style={{ padding: '16px 20px', fontSize: '10px', fontWeight: 800, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #F1F5F9', textAlign: align, background: '#F8FAFC' }}>
      {children}
    </th>
  );

  const TD = ({ children, align = 'left', style = {} }) => (
    <td style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', color: '#334155', fontSize: '13px', textAlign: align, fontWeight: 500, ...style }}>
      {children}
    </td>
  );

  return (
    <div style={{ padding: '0', background: '#EEF5F8', minHeight: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', fontFamily: "'Inter', system-ui, sans-serif" }}>

      <div style={{ display: 'flex', borderBottom: '1px solid #bae6fd', background: '#ffffff', padding: '0 32px' }}>
        <button style={tabStyle('dashboard')} onClick={() => navigate('/admin/reports')}>Fleet Dashboard</button>
        <button style={tabStyle('other-reports')} onClick={() => navigate('/admin/reports/trip')}>Analytics & Reports</button>
      </div>

      {activeTab === 'other-reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div style={{ display: 'flex', gap: '12px', padding: '16px 32px', background: '#FFFFFF', borderBottom: '1px solid #bae6fd', overflowX: 'auto', flexWrap: 'wrap' }}>
            {REPORT_TABS.map(tab => {
              const isActive = location.pathname.startsWith(tab.path);
              const Icon = tab.icon;
              return (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
                    background: isActive ? tab.bg : '#F8FAFC',
                    color: isActive ? tab.color : '#64748B',
                    border: `1px solid ${isActive ? tab.color : '#E2E8F0'}`,
                    borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                    transition: 'all 0.2s', whiteSpace: 'nowrap'
                  }}
                >
                  <Icon size={18} />
                  {tab.title}
                </button>
              )
            })}
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px', background: '#F8FAFC' }}>
            <Outlet />
          </div>
        </div>
      )}

      {activeTab === 'dashboard' && (
        <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

          {/* Header & Meta Row */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#000000', margin: 0 }}>Real-Time Fleet Telemetry</h2>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748B', display: 'flex', gap: '16px', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Building size={16} /> Company: <strong style={{ color: '#0F172A' }}>{user?.orgName || '-'}</strong></span>
              <span style={{ color: '#CBD5E1' }}>|</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Search size={16} /> Group: <strong style={{ color: '#0F172A' }}>{user?.name || '-'}</strong></span>
              <span style={{ color: '#CBD5E1' }}>|</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={16} /> Date: <strong style={{ color: '#0F172A' }}>{today}</strong></span>
            </div>
          </div>

          {/* 8 Modern Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '32px' }}>
            <MetricCard label="Total Fleet" value={metrics.total} icon={Users} color="#2563EB" bg="#EFF6FF" />
            <MetricCard label="Online" value={metrics.online} icon={Wifi} color="#16A34A" bg="#F0FDF4" />
            <MetricCard label="Running" value={metrics.running} icon={PlayCircle} color="#0D9488" bg="#F0FDFA" />
            <MetricCard label="Idling" value={metrics.idle} icon={Clock} color="#EA580C" bg="#FFF7ED" />
            <MetricCard label="Parking" value={metrics.parking} icon={StopCircle} color="#9333EA" bg="#F5F3FF" />
            <MetricCard label="No Data" value={metrics.noData} icon={AlertTriangle} color="#DC2626" bg="#FEF2F2" />
            <MetricCard label="Total KMS" value={metrics.totalKms} icon={Navigation} color="#3B82F6" bg="#EFF6FF" />
            <MetricCard label="Not Synced" value={metrics.notSynced} icon={RefreshCw} color="#C026D3" bg="#FDF4FF" />
          </div>

          {/* Search Bar & Table Container */}
          <div style={{ background: '#ffffff', borderRadius: '16px', border: 'none', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>

            {/* Table Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: '#FFFFFF', borderBottom: '1px solid #F1F5F9' }}>
              <div style={{ position: 'relative', width: '360px' }}>
                <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Search vehicle reg no or name..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '10px 16px 10px 42px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: '#FFFFFF', fontWeight: 500, color: '#0F172A' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button style={{ padding: '10px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', cursor: 'pointer', color: '#2563EB', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600 }}>
                  <Filter size={16} /> Filters
                </button>
                <button onClick={() => refetch()} style={{ padding: '10px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', cursor: 'pointer', color: '#2563EB', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600 }}>
                  <RefreshCw size={16} /> Refresh
                </button>
              </div>
            </div>

            {/* Scrollable Data Table */}
            <div style={{ overflow: 'auto', flex: 1 }}>
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '300px', gap: '12px' }}>
                  <Loader2 size={32} color="#7ea0b6" className="animate-spin" />
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#4d6076' }}>Syncing telemetry data...</span>
                </div>
              ) : error ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '300px', color: '#EF4444', gap: '8px' }}>
                  <AlertCircle size={24} />
                  <span style={{ fontWeight: 700, fontSize: '14px' }}>Failed to load fleet data.</span>
                </div>
              ) : (
                <table style={{ width: '100%', minWidth: '1400px', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr>
                      <TH align="center">#</TH>
                      <TH>Vehicle Identity</TH>
                      <TH>Registration</TH>
                      <TH>Last Seen At</TH>
                      <TH>Last Comm At</TH>
                      <TH>Driver Name</TH>
                      <TH align="right">Odometer</TH>
                      <TH align="center">Speed</TH>
                      <TH align="center">Status</TH>
                      <TH>Duration</TH>
                      <TH align="right">Battery</TH>
                      <TH align="center">Ignition</TH>
                      <TH>Nearest Location</TH>
                      <TH align="center">Maps</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVehicles.map((v, idx) => {
                      const isOnline = !!v.is_online;
                      const speed = Math.round(v.current_speed || 0);
                      const ignition = !!v.current_ignition;

                      let statusColor = '#94A3B8'; // Offline gray
                      if (isOnline) {
                        if (speed > 0) statusColor = '#10B981'; // Running green
                        else if (ignition) statusColor = '#F59E0B'; // Idle amber
                        else statusColor = '#64748B'; // Parking slate
                      }

                      return (
                        <tr key={v.id} style={{ background: idx % 2 === 0 ? '#ffffff' : '#fafafa', transition: 'background 0.2s' }}>
                          <TD align="center" style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700 }}>{idx + 1}</TD>
                          <TD>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColor }} />
                              <span onClick={() => navigate(`/vehicles/${v.id}`)} style={{ color: '#0f172a', fontWeight: 800, cursor: 'pointer' }}>
                                {v.name || '-'}
                              </span>
                            </div>
                          </TD>
                          <TD style={{ color: '#475569', fontFamily: 'monospace', fontSize: '13px' }}>{v.plate || '-'}</TD>
                          <TD style={{ color: '#64748b', fontSize: '11px', fontFamily: 'monospace' }}>{formatDateTime(v.last_seen)}</TD>
                          <TD style={{ color: '#64748b', fontSize: '11px', fontFamily: 'monospace' }}>{formatDateTime(v.last_seen)}</TD>
                          <TD>{v.driver_name || '-'}</TD>
                          <TD align="right" style={{ fontFamily: 'monospace', fontSize: '13px' }}>{Math.round(v.current_odometer || 0).toLocaleString()} km</TD>
                          <TD align="center" style={{ fontFamily: 'monospace', fontSize: '13px', color: speed > 0 ? '#10B981' : '#64748B', fontWeight: 700 }}>
                            {speed} <span style={{ fontSize: '10px', color: '#94A3B8' }}>km/h</span>
                          </TD>
                          <TD align="center">
                            <MapPin size={16} color={statusColor} />
                          </TD>
                          <TD style={{ color: '#64748B', fontSize: '12px', fontFamily: 'monospace' }}>00:00:00</TD>
                          <TD align="right" style={{ fontFamily: 'monospace', fontSize: '12px' }}>{formatVoltage(v.current_voltage)}</TD>
                          <TD align="center">
                            <div style={{ display: 'inline-flex', padding: '4px 8px', borderRadius: '4px', background: ignition ? '#ECFDF5' : '#111827', color: ignition ? '#10B981' : '#FFFFFF', fontSize: '10px', fontWeight: 800 }}>
                              {ignition ? 'ON' : 'OFF'}
                            </div>
                          </TD>
                          <TD style={{ maxWidth: '220px', overflow: 'hidden' }}>
                            {(v.lat && v.lng) ? (
                              <AddressText lat={v.lat} lng={v.lng} />
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: '11px', fontStyle: 'italic' }}>Location unavailable</span>
                            )}
                          </TD>
                          <TD align="center">
                            {(v.lat && v.lng) ? (
                              <a href={`https://maps.google.com/?q=${v.lat},${v.lng}`} target="_blank" rel="noopener noreferrer" style={{ color: '#3B82F6', display: 'inline-flex', padding: '6px', borderRadius: '6px', background: '#EFF6FF', transition: 'background 0.2s' }} title="View on Google Maps">
                                <Map size={16} />
                              </a>
                            ) : <span style={{ color: '#cbd5e1', fontSize: '11px' }}>-</span>}
                          </TD>
                        </tr>
                      );
                    })}
                    {filteredVehicles.length === 0 && !loading && (
                      <tr>
                        <td colSpan="17" style={{ padding: '60px', textAlign: 'center', color: '#94a3b8', fontSize: '15px', fontWeight: 600 }}>
                          No vehicles found matching your criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        table tbody tr:hover { background: #f1f5f9 !important; }
      `}} />
    </div>
  );
};

export default ReportsAdminPage;
