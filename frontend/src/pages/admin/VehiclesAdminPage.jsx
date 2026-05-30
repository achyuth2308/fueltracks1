import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Plus, Edit2, Trash2, Loader2, AlertTriangle, Search, Eye, Cpu, CheckCircle } from 'lucide-react';
import * as vehicleApi from '../../api/vehicleApi';
import * as adminApi from '../../api/adminApi';
import AddVehicleModal from '../../components/modals/AddVehicleModal';
import { useAuth } from '../../hooks/useAuth';

const StatusDot = ({ online }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
    <div style={{
      width: '7px', height: '7px', borderRadius: '50%',
      background: online ? '#10b981' : '#374151',
      boxShadow: online ? '0 0 6px rgba(16,185,129,0.5)' : 'none',
    }} />
    <span style={{ fontSize: '10px', fontWeight: 600, color: online ? '#34d399' : '#374151' }}>
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
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const res = await vehicleApi.getVehicles();
      if (res.success) setVehicles(res.data);
    } catch (err) {
      setError('Failed to load fleet registry.');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchVehicles();
    if (user?.role === 'superadmin') {
      adminApi.getOrgs().then(res => { if (res.success) setOrgs(res.data); }).catch(() => {});
    }
  }, [user]);

  const handleSave = async (payload) => {
    if (selectedVehicle) await vehicleApi.updateVehicle(selectedVehicle.id, payload);
    else await vehicleApi.createVehicle(payload);
    fetchVehicles();
  };

  const handleDelete = async (id) => {
    try {
      const res = await vehicleApi.deleteVehicle(id);
      if (res.success) { setDeleteConfirm(null); fetchVehicles(); }
    } catch (err) { alert(err.response?.data?.error || 'Delete failed.'); }
  };

  const filtered = vehicles.filter(v =>
    v.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.plate?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.imei?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ padding: '24px', background: '#0a0f1e', minHeight: 'calc(100vh - 56px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Truck size={16} color="#2563eb" />
            <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#e2e8f0', letterSpacing: '-0.03em' }}>Vehicle Registry</h1>
          </div>
          <p style={{ fontSize: '12px', color: '#374151' }}>Register IMEI-linked GPS devices and manage fleet assets</p>
        </div>
        <button
          onClick={() => { setSelectedVehicle(null); setModalOpen(true); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '9px 16px',
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            border: '1px solid rgba(37,99,235,0.5)',
            borderRadius: '8px', color: 'white', fontSize: '13px', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'none'}
        >
          <Plus size={14} /> Register Vehicle
        </button>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {[
          { label: 'Total Vehicles', value: vehicles.length, color: '#7c8db0' },
          { label: 'Online', value: vehicles.filter(v => v.is_online).length, color: '#10b981' },
          { label: 'Offline', value: vehicles.filter(v => !v.is_online).length, color: '#374151' },
        ].map(s => (
          <div key={s.label} style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 14px', borderRadius: '8px',
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
          }}>
            <span style={{ fontSize: '20px', fontWeight: 800, color: s.color, fontFamily: 'JetBrains Mono, monospace' }}>{s.value}</span>
            <span style={{ fontSize: '11px', color: '#2d3748', fontWeight: 500 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', width: '280px', marginBottom: '14px' }}>
        <Search size={13} color="#2d3748" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search name, plate, IMEI..."
          style={{
            width: '100%', padding: '8px 10px 8px 30px',
            background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '7px', color: '#e2e8f0', fontSize: '12px',
            fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => e.target.style.borderColor = 'rgba(37,99,235,0.5)'}
          onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.05)'}
        />
      </div>

      {/* Table */}
      <div style={{
        background: 'linear-gradient(160deg, #0f1729 0%, #0c1422 100%)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '12px', overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '48px' }}>
            <div style={{ width: '24px', height: '24px', border: '2px solid rgba(37,99,235,0.15)', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
            <span style={{ fontSize: '12px', color: '#2d3748' }}>Loading registry...</span>
          </div>
        ) : error ? (
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <AlertTriangle size={24} color="#ef4444" style={{ margin: '0 auto 8px', display: 'block' }} />
            <p style={{ fontSize: '12px', color: '#f87171' }}>{error}</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {['Vehicle', 'Plate', 'IMEI', 'Organization', 'Driver', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', fontSize: '10px', fontWeight: 700, color: '#2d3748', textAlign: 'left', letterSpacing: '0.08em', textTransform: 'uppercase', background: 'rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#2d3748', fontSize: '12px', fontStyle: 'italic' }}>
                      No vehicles found. Register a new one.
                    </td>
                  </tr>
                ) : (
                  filtered.map(v => (
                    <tr key={v.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>{v.name}</div>
                        {v.make && <div style={{ fontSize: '10px', color: '#374151', marginTop: '1px' }}>{v.make} {v.model}</div>}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: '12px', fontWeight: 600, color: '#7c8db0', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.04em' }}>{v.plate || '—'}</td>
                      <td style={{ padding: '11px 14px', fontSize: '11px', color: '#374151', fontFamily: 'JetBrains Mono, monospace' }}>{v.imei}</td>
                      <td style={{ padding: '11px 14px', fontSize: '12px', color: '#7c8db0', fontWeight: 500 }}>{v.org_name || '—'}</td>
                      <td style={{ padding: '11px 14px' }}>
                        {v.driver_name ? (
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0' }}>{v.driver_name}</div>
                            <div style={{ fontSize: '10px', color: '#374151', fontFamily: 'JetBrains Mono, monospace' }}>{v.driver_phone || '—'}</div>
                          </div>
                        ) : <span style={{ fontSize: '11px', color: '#2d3748', fontStyle: 'italic' }}>Unassigned</span>}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <StatusDot online={v.is_online} />
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button onClick={() => navigate(`/vehicles/${v.id}`)} title="Monitor"
                            style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151', transition: 'all 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#60a5fa'; e.currentTarget.style.background = 'rgba(37,99,235,0.1)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#374151'; e.currentTarget.style.background = 'transparent'; }}>
                            <Eye size={14} />
                          </button>
                          <button onClick={() => { setSelectedVehicle(v); setModalOpen(true); }} title="Edit"
                            style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151', transition: 'all 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#fbbf24'; e.currentTarget.style.background = 'rgba(245,158,11,0.1)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#374151'; e.currentTarget.style.background = 'transparent'; }}>
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => setDeleteConfirm(v.id)} title="Delete"
                            style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151', transition: 'all 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#374151'; e.currentTarget.style.background = 'transparent'; }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-box" style={{ maxWidth: '360px', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={16} color="#ef4444" />
              </div>
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', margin: 0 }}>Delete Vehicle</h3>
                <p style={{ fontSize: '11px', color: '#4a5568', margin: 0 }}>Telemetry logs will be preserved</p>
              </div>
            </div>
            <p style={{ fontSize: '12px', color: '#7c8db0', marginBottom: '18px' }}>Are you sure you want to remove this vehicle from the registry?</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: '7px 14px', background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '7px', color: '#4a5568', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ padding: '7px 14px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '7px', color: '#f87171', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <AddVehicleModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} vehicle={selectedVehicle} orgs={orgs} />
    </div>
  );
};

export default VehiclesAdminPage;
