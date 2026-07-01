import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, Map, Activity, Route, Zap, TrendingUp, Printer, 
  Search, RefreshCw, AlertCircle, Loader2, MapPin, 
  CheckCircle2, PlayCircle, PauseCircle, StopCircle, 
  AlertOctagon, Navigation, RefreshCcw, Gauge, Users, UserCircle 
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useVehicles } from '../../hooks/useVehicles';
import { formatVoltage, formatFuel } from '../../utils/formatUtils';
import AddressText from '../../components/ui/AddressText';

const formatDateTime = (isoString) => {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const date = `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
    return `${time}\n${date}`;
  } catch { return '-'; }
};

const ReportLinkCard = ({ title, desc, path, icon: Icon, color, bg, navigate }) => (
  <div
    onClick={() => navigate(path)}
    style={{ background: '#FFFFFF', padding: '24px', borderRadius: '16px', border: '1px solid #bae6fd', borderTop: '10px solid #2E4867', boxShadow: '0 4px 12px rgba(0,0,0,0.04)', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: '16px' }}
    onMouseEnter={e => { e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 12px 24px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor=color; e.currentTarget.style.borderTopColor=color; }}
    onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor='#bae6fd'; e.currentTarget.style.borderTopColor='#2E4867'; }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={24} />
      </div>
      <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#000000', margin: 0 }}>{title}</h3>
    </div>
    <p style={{ fontSize: '13px', color: '#64748B', margin: 0, lineHeight: 1.5 }}>{desc}</p>
  </div>
);

const MetricCard = ({ label, value, color, icon: Icon, bg }) => (
  <div style={{
    background: '#ffffff',
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1px solid #e0f2fe',
    borderTop: '10px solid #2E4867',
    boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    transition: 'all 0.2s'
  }}>
    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: bg, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={18} />
    </div>
    <div>
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>{value}</div>
    </div>
  </div>
);

const ReportsAdminPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { vehicles, loading, error, refetch } = useVehicles();
  const [activeTab, setActiveTab] = useState('dashboard');
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

  const today = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');

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
    <th style={{ padding: '12px 16px', borderBottom: '1px solid #bae6fd', fontWeight: 800, fontSize: '11px', textAlign: align, whiteSpace: 'nowrap', background: '#EEF5F8', color: '#4d6076', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {children}
    </th>
  );

  const TD = ({ children, align = 'left', style = {} }) => (
    <td style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9', color: '#475569', fontSize: '12px', textAlign: align, whiteSpace: 'pre-line', fontWeight: 500, ...style }}>
      {children}
    </td>
  );

  return (
    <div style={{ padding: '0', background: '#EEF5F8', minHeight: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', fontFamily: "'Inter', system-ui, sans-serif" }}>

      <div style={{ display: 'flex', borderBottom: '1px solid #bae6fd', background: '#ffffff', padding: '0 32px' }}>
        <button style={tabStyle('dashboard')} onClick={() => setActiveTab('dashboard')}>Fleet Dashboard</button>
        <button style={tabStyle('other-reports')} onClick={() => setActiveTab('other-reports')}>Analytics & Reports</button>
      </div>

      {activeTab === 'other-reports' && (
        <div style={{ padding: '40px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          <ReportLinkCard title="Trip Report" desc="View start and end locations, durations, and distances for all completed trips." path="/admin/reports/trip" icon={Map} bg="#F3E8FF" color="#9333EA" navigate={navigate} />
          <ReportLinkCard title="Daily Distance" desc="Analyze total distance travelled by each vehicle on a daily basis." path="/admin/reports/distance" icon={TrendingUp} bg="#E0F2FE" color="#0284C7" navigate={navigate} />
          <ReportLinkCard title="Vehicle Activity" desc="Breakdown of running, idling, stopped, and offline hours for utilization tracking." path="/admin/reports/activity" icon={Activity} bg="#ECFDF5" color="#059669" navigate={navigate} />
          <ReportLinkCard title="Route History" desc="Visualize the exact path a vehicle took on the map with telemetry data points." path="/admin/reports/route" icon={Route} bg="#f0f9ff" color="#f97316" navigate={navigate} />
          <ReportLinkCard title="Ignition Report" desc="Detailed log of all engine ON and OFF events with timestamp and location." path="/admin/reports/ignition" icon={Zap} bg="#FEF2F2" color="#DC2626" navigate={navigate} />
          <ReportLinkCard title="Overspeeding Report" desc="Log of all times vehicles exceeded the speed limit." path="/admin/reports/overspeeding" icon={Gauge} bg="#FFF1F2" color="#E11D48" navigate={navigate} />
          <ReportLinkCard title="Stoppage & Idle Wastage" desc="Detailed breakdown of vehicle stoppages, idling locations, and durations." path="/admin/reports/stoppage" icon={PauseCircle} bg="#FFF7ED" color="#EA580C" navigate={navigate} />
          <ReportLinkCard title="Consolidated Report" desc="Overall summary of the entire fleet's activity and distance travelled." path="/admin/reports/consolidated" icon={Users} bg="#F0FDF4" color="#16A34A" navigate={navigate} />
          <ReportLinkCard title="Individual Vehicle Report" desc="Comprehensive deep-dive into a single vehicle's operations." path="/admin/reports/individual" icon={UserCircle} bg="#EFF6FF" color="#2563EB" navigate={navigate} />
        </div>
      )}

      {activeTab === 'dashboard' && (
        <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          
          {/* Header & Meta Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#000000', margin: '0 0 8px 0' }}>Real-Time Fleet Telemetry</h2>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748B', display: 'flex', gap: '16px' }}>
                <span>Company: <strong style={{ color: '#000' }}>{user?.orgName || '-'}</strong></span>
                <span>Group: <strong style={{ color: '#000' }}>{user?.name || '-'}</strong></span>
                <span>Date: <strong style={{ color: '#000' }}>{today}</strong></span>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button style={{ padding: '10px 20px', background: '#f97316', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(249,115,22,0.2)', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background='#ea580c'} onMouseLeave={e => e.currentTarget.style.background='#f97316'}>
                Last Transmission
              </button>
              <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', border: '1px solid #e0f2fe', background: '#fff', borderRadius: '8px', cursor: 'pointer', color: '#10B981', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }} title="Export Excel">
                <FileText size={18} />
              </button>
              <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', border: '1px solid #e0f2fe', background: '#fff', borderRadius: '8px', cursor: 'pointer', color: '#DC2626', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }} title="Print PDF">
                <Printer size={18} />
              </button>
            </div>
          </div>

          {/* 8 Modern Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
            <MetricCard label="Total Fleet" value={metrics.total} icon={Activity} color="#6366F1" bg="#EEF2FF" />
            <MetricCard label="Online" value={metrics.online} icon={CheckCircle2} color="#8B5CF6" bg="#F5F3FF" />
            <MetricCard label="Running" value={metrics.running} icon={PlayCircle} color="#10B981" bg="#ECFDF5" />
            <MetricCard label="Idle" value={metrics.idle} icon={PauseCircle} color="#F59E0B" bg="#FFFBEB" />
            <MetricCard label="Parking" value={metrics.parking} icon={StopCircle} color="#64748B" bg="#F1F5F9" />
            <MetricCard label="No Data" value={metrics.noData} icon={AlertOctagon} color="#EF4444" bg="#FEF2F2" />
            <MetricCard label="Total KMS" value={metrics.totalKms} icon={Navigation} color="#0EA5E9" bg="#F0F9FF" />
            <MetricCard label="Not Synced" value={metrics.notSynced} icon={RefreshCcw} color="#64748b" bg="#FFF7ED" />
          </div>

          {/* Search Bar & Table Container */}
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #bae6fd', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
            
            {/* Table Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 sm:px-5 border-b border-sky-200 bg-stone-50">
              <div style={{ position: 'relative', width: '320px' }}>
                <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Search vehicle reg no or name..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '10px 16px 10px 38px', border: '1px solid #bae6fd', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', background: '#fff', fontWeight: 500, color: '#000' }}
                />
              </div>
              <button onClick={() => refetch()} style={{ padding: '10px 16px', background: '#fff', border: '1px solid #bae6fd', borderRadius: '8px', cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                <RefreshCw size={16} /> Refresh Feed
              </button>
            </div>

            {/* Scrollable Data Table */}
            <div style={{ overflow: 'auto', flex: 1 }}>
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '300px', gap: '16px' }}>
                  <Loader2 size={32} color="#7ea0b6" className="animate-spin" />
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#4d6076' }}>Syncing telemetry data...</span>
                </div>
              ) : error ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '300px', color: '#EF4444', gap: '8px' }}>
                  <AlertCircle size={24} />
                  <span style={{ fontWeight: 700, fontSize: '14px' }}>Failed to load fleet data.</span>
                </div>
              ) : (
                <table style={{ width: '100%', minWidth: '1600px', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr>
                      <TH align="center">#</TH>
                      <TH>Vehicle Identity</TH>
                      <TH>Registration</TH>
                      <TH>Last Seen At</TH>
                      <TH>Last Comm At</TH>
                      <TH>Driver Name</TH>
                      <TH>Contact</TH>
                      <TH align="right">Odometer</TH>
                      <TH align="right">Speed</TH>
                      <TH align="center">Status</TH>
                      <TH>Duration</TH>
                      <TH align="right">Battery</TH>
                      <TH align="center">Ignition</TH>
                      <TH align="right">Fuel</TH>
                      <TH align="right">Temp</TH>
                      <TH>Nearest Location</TH>
                      <TH align="center">Maps</TH>
                      <TH align="center">Actions</TH>
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
                          <TD>{v.driver_phone || '-'}</TD>
                          <TD align="right" style={{ fontFamily: 'monospace', fontSize: '13px' }}>{Math.round(v.current_odometer || 0).toLocaleString()} km</TD>
                          <TD align="right" style={{ fontFamily: 'monospace', fontSize: '13px', color: speed > 0 ? '#10B981' : '#64748B', fontWeight: 700 }}>{speed} km/h</TD>
                          <TD align="center">
                            <MapPin size={16} color={statusColor} />
                          </TD>
                          <TD style={{ color: '#64748B', fontSize: '12px', fontFamily: 'monospace' }}>00:00:00</TD>
                          <TD align="right" style={{ fontFamily: 'monospace', fontSize: '12px' }}>{formatVoltage(v.current_voltage)}</TD>
                          <TD align="center">
                            <div style={{ display: 'inline-flex', padding: '4px 8px', borderRadius: '4px', background: ignition ? '#ECFDF5' : '#F1F5F9', color: ignition ? '#10B981' : '#64748B', fontSize: '10px', fontWeight: 800 }}>
                              {ignition ? 'ON' : 'OFF'}
                            </div>
                          </TD>
                          <TD align="right" style={{ fontFamily: 'monospace', fontSize: '13px' }}>{formatFuel(v.current_fuel)}</TD>
                          <TD align="right" style={{ fontFamily: 'monospace', fontSize: '13px' }}>0 °C</TD>
                          <TD style={{ maxWidth: '220px', overflow: 'hidden' }}>
                            {(v.lat && v.lng) ? (
                              <AddressText lat={v.lat} lng={v.lng} />
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: '11px', fontStyle: 'italic' }}>Location unavailable</span>
                            )}
                          </TD>
                          <TD align="center">
                            {(v.lat && v.lng) ? (
                              <a href={`https://maps.google.com/?q=${v.lat},${v.lng}`} target="_blank" rel="noopener noreferrer" style={{ color: '#7ea0b6', textDecoration: 'none', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
                                View
                              </a>
                            ) : <span style={{ color: '#cbd5e1', fontSize: '11px' }}>-</span>}
                          </TD>
                          <TD align="center">
                            <span 
                              onClick={() => navigate(`/vehicles/${v.id}/history`)} 
                              style={{ color: '#0EA5E9', textDecoration: 'underline', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer' }}
                            >
                              History
                            </span>
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

      <style dangerouslySetInnerHTML={{ __html: `
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        table tbody tr:hover { background: #f1f5f9 !important; }
      `}} />
    </div>
  );
};

export default ReportsAdminPage;
