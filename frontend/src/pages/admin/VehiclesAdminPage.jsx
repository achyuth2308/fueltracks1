import React, { useState, useEffect } from 'react';
import { formatLocalDate, formatLocalTime } from '../../utils/dateUtils';
import { useNavigate } from 'react-router-dom';
import { Truck, Plus, Edit2, Trash2, Loader2, AlertTriangle, Search, Eye, Server, MapPin, CheckCircle, ChevronRight, X, Building2, Users2, Activity } from 'lucide-react';
import * as vehicleApi from '../../api/vehicleApi';
import * as adminApi from '../../api/adminApi';
import { useAuth } from '../../hooks/useAuth';

const StatusDot = ({ online }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
    <div style={{
      width: '8px', height: '8px', borderRadius: '50%',
      background: online ? '#10B981' : '#94A3B8',
      boxShadow: online ? '0 0 6px rgba(16,185,129,0.4)' : 'none',
    }} />
    <span style={{ fontSize: '11px', fontWeight: 600, color: online ? '#10B981' : '#64748B' }}>
      {online ? 'Online' : 'Offline'}
    </span>
  </div>
);

const VehiclesAdminPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');

  // Details Panel State
  const [viewingVehicle, setViewingVehicle] = useState(null);

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const res = await vehicleApi.getVehicles({ t: Date.now() });
      if (res.success) setVehicles(res.data);
    } catch (err) {
      setError('Failed to load fleet registry.');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchVehicles();
    if (user?.role === 'superadmin') {
      adminApi.getOrgs().then(res => { if (res.success) setOrgs(res.data); }).catch(() => { });
    }
  }, [user]);

  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    if (window.confirm('Are you sure you want to remove this vehicle from the registry?')) {
      try {
        const res = await vehicleApi.deleteVehicle(id);
        if (res.success) {
          if (viewingVehicle?.id === id) setViewingVehicle(null);
          fetchVehicles();
        }
      } catch (err) { alert(err.response?.data?.error || 'Delete failed.'); }
    }
  };

  const filtered = vehicles.filter(v =>
    v.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.plate?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.imei?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ padding: '32px', background: '#EEF5F8', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em' }}>Vehicle Assets</h1>
          <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>Manage fleet assets, telemetry mapping, and real-time tracking.</p>
        </div>

      </div>

      <div style={{ display: 'flex', gap: '24px', flex: 1, minHeight: 0 }}>

        {/* Left Side: List */}
        <div style={{
          background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0',
          boxShadow: '0 4px 6px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column',
          flex: viewingVehicle ? '1' : '100%', transition: 'all 0.3s ease', overflow: 'hidden'
        }}>
          {/* Search Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 sm:px-5 border-b border-slate-200">
            <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
              <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} size={16} />
              <input
                type="text"
                placeholder="Search name, plate, IMEI..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px 10px 38px',
                  borderRadius: '10px', border: '1px solid #CBD5E1',
                  fontSize: '14px', outline: 'none', color: '#111827', boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '16px', fontSize: '13px', fontWeight: 600 }}>
              <span style={{ color: '#64748B' }}>Total: <span style={{ color: '#111827' }}>{vehicles.length}</span></span>
              <span style={{ color: '#64748B' }}>Online: <span style={{ color: '#10B981' }}>{vehicles.filter(v => v.is_online).length}</span></span>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <Loader2 size={32} color="#f97316" className="animate-spin" />
              <span style={{ fontSize: '14px', color: '#6B7280', marginTop: '12px' }}>Loading fleet registry...</span>
            </div>
          ) : error ? (
            <div style={{ padding: '40px', textAlign: 'center', flex: 1 }}>
              <AlertTriangle size={32} color="#EF4444" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>Failed to Load Records</div>
              <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>{error}</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
              <table style={{ minWidth: '2400px', width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    {['Vehicle ID', 'Vehicle Name', 'Registration No', 'Device ID', 'Server Name', 'Last Comm Time', 'GPS Sim No', 'Status', 'Device Model', 'Version', 'TimeZone', 'APN', 'Licence Issued', 'Onboard Date', 'Licence Expire', 'Made In', 'Mfg Date', 'Chassis No', 'Alt Vehicle Name', 'Service Engineer', 'Salesman', 'Ticket Id', 'Sensor No', 'Remarks', 'Action'].map(h => (
                      <th key={h} style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan="25" style={{ padding: '60px', textAlign: 'center', color: '#6B7280', fontSize: '14px' }}>No vehicles found.</td>
                    </tr>
                  ) : filtered.map((v) => (
                    <tr
                      key={v.id}
                      onClick={() => setViewingVehicle(v)}
                      style={{
                        borderBottom: '1px solid #F1F5F9', cursor: 'pointer',
                        background: viewingVehicle?.id === v.id ? '#f0f9ff' : 'transparent',
                        transition: 'background 0.2s',
                        whiteSpace: 'nowrap'
                      }}
                      onMouseEnter={e => { if (viewingVehicle?.id !== v.id) e.currentTarget.style.background = '#F8FAFC'; }}
                      onMouseLeave={e => { if (viewingVehicle?.id !== v.id) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#111827', fontWeight: 600, fontFamily: 'monospace' }}>{v.metadata?.vehicleId || '-'}</td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#111827', fontWeight: 700 }}>{v.name || '-'}</td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#111827', fontWeight: 700 }}>{v.plate || '-'}</td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#111827', fontWeight: 600, fontFamily: 'monospace' }}>{v.imei || '-'}</td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>{v.server_name || '-'}</td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>{v.last_seen ? formatLocalTime(v.last_seen) : '-'}</td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569', fontFamily: 'monospace' }}>{v.gps_sim_no || '-'}</td>
                      <td style={{ padding: '16px 20px' }}><StatusDot online={v.is_online} /></td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>{v.model || 'nill'}</td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>{v.device_version || '-'}</td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>{v.timezone || '-'}</td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>{v.apn || '-'}</td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>{v.licence_issued_date ? formatLocalDate(v.licence_issued_date) : '-'}</td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>{v.created_at ? formatLocalDate(v.created_at) : '-'}</td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>{v.licence_expire_date ? formatLocalDate(v.licence_expire_date) : '-'}</td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>{v.metadata?.madeIn || '-'}</td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>{v.metadata?.mfgDate || '-'}</td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>{v.metadata?.chassisNo || '-'}</td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>{v.metadata?.altVehicleName || '-'}</td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>{v.metadata?.serviceEngineer || '-'}</td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>{v.metadata?.salesman || '-'}</td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>{v.metadata?.ticketId || '-'}</td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>{v.metadata?.sensorNo || '-'}</td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.metadata?.remarks || '-'}</td>
                      <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', background: '#F8FAFC', color: '#f97316' }}>
                          <Eye size={16} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Side: Details Panel */}
        {viewingVehicle && (
          <div style={{
            width: '300px', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0',
            boxShadow: '0 4px 6px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column',
            overflow: 'hidden', animation: 'fadeInRight 0.3s ease'
          }}>
            {/* Details Header */}
            <div style={{ padding: '24px', borderBottom: '1px solid #F1F5F9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{
                  width: '64px', height: '64px', borderRadius: '16px', background: '#EEF5F8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px'
                }}>
                  <Truck size={32} color="#f97316" />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ padding: '4px 10px', borderRadius: '8px', background: viewingVehicle.is_online ? '#D1FAE5' : '#F1F5F9', color: viewingVehicle.is_online ? '#059669' : '#64748B', fontSize: '11px', fontWeight: 700 }}>
                    {viewingVehicle.is_online ? 'LIVE' : 'OFFLINE'}
                  </div>
                  <button
                    onClick={() => setViewingVehicle(null)}
                    style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', transition: 'background 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F1F5F9'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#111827', marginBottom: '4px' }}>{viewingVehicle.name}</h2>
              <p style={{ fontSize: '13px', color: '#6B7280', fontFamily: 'monospace' }}>{viewingVehicle.plate || 'No Plate'}</p>

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button onClick={(e) => { e.stopPropagation(); navigate(`/vehicles/${viewingVehicle.id}`); }} style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#EEF5F8', border: '1px solid #e0f2fe', color: '#f97316', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}>
                  <Eye size={16} /> Live Monitor
                </button>
                <button onClick={(e) => { e.stopPropagation(); navigate(`/admin/vehicles/edit/${viewingVehicle.id}`); }} style={{ padding: '10px', borderRadius: '8px', background: '#EEF5F8', border: '1px solid #E2E8F0', color: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Edit2 size={16} />
                </button>
                <button onClick={(e) => handleDelete(viewingVehicle.id, e)} style={{ padding: '10px', borderRadius: '8px', background: '#FEF2F2', border: '1px solid #FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Details Content */}
            <div style={{ padding: '24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

              <div>
                <h3 style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Operational Context</h3>
                <div style={{ background: '#EEF5F8', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid #F1F5F9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #E2E8F0' }}><Building2 size={16} color="#64748B" /></div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Organization</div>
                      <div style={{ fontSize: '13px', color: '#111827', fontWeight: 700 }}>{viewingVehicle.org_name || 'None'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #E2E8F0' }}><Users2 size={16} color="#64748B" /></div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Assigned Group</div>
                      <div style={{ fontSize: '13px', color: '#111827', fontWeight: 700 }}>{viewingVehicle.group_name || '—'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #E2E8F0' }}><Server size={16} color="#64748B" /></div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Assigned Device</div>
                      <div style={{ fontSize: '13px', color: '#111827', fontWeight: 700, fontFamily: 'monospace' }}>IMEI: {viewingVehicle.imei}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Telemetry & Activity</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>Current Location</span>
                  <span style={{ fontSize: '13px', color: '#111827', fontWeight: 700 }}>
                    {viewingVehicle.lat && viewingVehicle.lng ? `${Number(viewingVehicle.lat).toFixed(4)}, ${Number(viewingVehicle.lng).toFixed(4)}` : 'Unknown'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>Current Speed</span>
                  <span style={{ fontSize: '13px', color: '#111827', fontWeight: 700 }}>{viewingVehicle.current_speed || 0} km/h</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
                  <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>Last Update</span>
                  <span style={{ fontSize: '13px', color: '#111827', fontWeight: 700 }}>
                    {viewingVehicle.last_update ? new Date(viewingVehicle.last_update).toLocaleTimeString() : 'Never'}
                  </span>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes fadeInRight {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}} />
    </div>
  );
};

export default VehiclesAdminPage;
