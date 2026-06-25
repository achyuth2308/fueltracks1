import React, { useState, useEffect } from 'react';
import { Server, Loader2, AlertTriangle, Search, ChevronRight, X, Truck, Building2, Activity, Wifi, WifiOff, Plus } from 'lucide-react';
import { adminApi } from '../../api/axios';

const DevicesAdminPage = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getDevices();
      if (res.success) {
        // Map backend database fields to UI fields
        const mappedDevices = res.data.map(d => ({
          id: d.id,
          imei: d.device_id,
          type: d.device_type || 'GPS Tracker',
          vehicle_name: d.vehicle_id || 'Unassigned',
          org_name: d.org_name || '—',
          group_name: 'Unassigned',
          is_online: d.is_online || false,
          last_update: d.last_seen || null,
          vehicle_id: d.vehicle_id,
        }));
        setDevices(mappedDevices);
      }
    } catch (err) {
      setError('Failed to load device inventory.');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const filtered = devices.filter(d =>
    d.imei?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.vehicle_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this device?')) {
      try {
        const res = await adminApi.deleteDevice(id);
        if (res.success) {
          fetchDevices();
        }
      } catch (err) {
        alert('Failed to delete device.');
      }
    }
  };

  return (
    <div style={{ padding: '32px', background: '#EEF5F8', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em' }}>Device Inventory</h1>
          <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>Monitor hardware telemetry, connectivity, and vehicle assignments.</p>
        </div>
        <button
          onClick={() => window.location.href = '/onBoardDevice'}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: '#f97316', color: '#FFFFFF',
            padding: '10px 20px', borderRadius: '10px',
            fontSize: '14px', fontWeight: 600, border: 'none',
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(249,115,22,0.2)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(249,115,22,0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(249,115,22,0.2)'; }}
        >
          <Plus size={18} />
          <span>Add Device</span>
        </button>
      </div>

      <div style={{ display: 'flex', gap: '24px', flex: 1, minHeight: 0 }}>

        {/* Left Side: List */}
        <div style={{
          background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0',
          boxShadow: '0 4px 6px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column',
          flex: '100%', transition: 'all 0.3s ease', overflow: 'hidden'
        }}>
          {/* Search Bar */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
              <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} size={16} />
              <input
                type="text"
                placeholder="Search IMEI or Vehicle..."
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
              <span style={{ color: '#64748B' }}>Total: <span style={{ color: '#111827' }}>{devices.length}</span></span>
              <span style={{ color: '#64748B' }}>Online: <span style={{ color: '#10B981' }}>{devices.filter(d => d.is_online).length}</span></span>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <Loader2 size={32} color="#f97316" className="animate-spin" />
              <span style={{ fontSize: '14px', color: '#6B7280', marginTop: '12px' }}>Loading inventory...</span>
            </div>
          ) : error ? (
            <div style={{ padding: '40px', textAlign: 'center', flex: 1 }}>
              <AlertTriangle size={32} color="#EF4444" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>Failed to Load Records</div>
              <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>{error}</div>
            </div>
          ) : (
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <table style={{ w: '100%', width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    {['Device IMEI', 'Type', 'Assigned Vehicle', 'Status', 'Last Comm', ''].map(h => (
                      <th key={h} style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ padding: '80px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.5 }}>
                          <Server size={48} color="#94A3B8" style={{ marginBottom: '16px' }} />
                          <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>No devices found</div>
                          <div style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>Awaiting device configuration.</div>
                        </div>
                      </td>
                    </tr>
                  ) : filtered.map((d) => (
                    <tr
                      key={d.id}
                      style={{
                        borderBottom: '1px solid #F1F5F9', cursor: 'default',
                        background: 'transparent',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827', fontFamily: 'monospace' }}>{d.imei}</div>
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569', fontWeight: 500 }}>
                        {d.type}
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#111827', fontWeight: 600 }}>
                        {d.vehicle_name || 'Unassigned'}
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: d.is_online ? '#10B981' : '#94A3B8', boxShadow: d.is_online ? '0 0 6px rgba(16,185,129,0.4)' : 'none' }} />
                          <span style={{ fontSize: '11px', fontWeight: 600, color: d.is_online ? '#10B981' : '#64748B' }}>
                            {d.is_online ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '12px', color: '#64748B', fontWeight: 500 }}>
                        {d.last_update ? new Date(d.last_update).toLocaleTimeString() : 'Never'}
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <button
                          onClick={(e) => handleDelete(d.id, e)}
                          style={{
                            background: '#FEF2F2', color: '#DC2626', border: '1px solid #FEE2E2', padding: '6px 12px',
                            borderRadius: '6px', fontSize: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', cursor: 'pointer'
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
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

export default DevicesAdminPage;
