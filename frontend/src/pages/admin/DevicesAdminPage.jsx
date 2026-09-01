import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Server, Loader2, AlertTriangle, Search, ChevronRight, X, Truck,
  Building2, Activity, Wifi, WifiOff, Plus, FileSpreadsheet, Download
} from 'lucide-react';
import { adminApi } from '../../api/axios';
import * as api from '../../api/adminApi';
import { useAuth } from '../../hooks/useAuth';
import ExcelBulkUploadModal from '../../components/ExcelBulkUploadModal';
import { generateVehicleOnboardingTemplate } from '../../utils/excelTemplateGenerator';

const DevicesAdminPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin';

  const [devices, setDevices] = useState([]);
  const [groups, setGroups] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getDevices();
      if (res.success) {
        const mappedDevices = res.data.map(d => ({
          id: d.id,
          imei: d.device_id,
          type: d.device_type || 'GPS Tracker',
          vehicle_name: d.vehicle_name || 'Unassigned',
          org_name: d.org_name || '—',
          group_name: 'Unassigned',
          is_online: d.is_online || false,
          last_update: d.last_seen || null,
          vehicle_id: d.vehicle_uuid,
        }));
        setDevices(mappedDevices);
      }
    } catch (err) {
      setError('Failed to load device inventory.');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchDevices();
    api.getGroups?.().then(res => { if (res.success) setGroups(res.data); }).catch(() => {});
    api.getOrgs?.().then(res => { if (res.success) setOrgs(res.data); }).catch(() => {});
  }, []);

  const filtered = devices.filter(d =>
    d.imei?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.vehicle_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.type?.toLowerCase().includes(searchQuery.toLowerCase())
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
    <div className="pastel-page-bg" style={{ padding: '32px', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 shrink-0">
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.02em' }}>Device Inventory</h1>
          <p style={{ fontSize: '15px', color: '#64748b', marginTop: '4px' }}>Monitor hardware telemetry, connectivity, and provision devices in bulk.</p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={() => generateVehicleOnboardingTemplate(groups, user?.orgName)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-sm transition-all cursor-pointer"
            title="Download formatted Excel template for bulk onboarding"
          >
            <Download size={14} className="text-slate-500" />
            <span>Excel Template</span>
          </button>

          <button
            onClick={() => setIsExcelModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-xl shadow-md shadow-slate-900/10 transition-all cursor-pointer"
          >
            <FileSpreadsheet size={15} className="text-orange-400" />
            <span>Upload Excel</span>
          </button>

          <button
            onClick={() => navigate('/onBoardDevice')}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: '#f97316', color: '#FFFFFF',
              padding: '10px 20px', borderRadius: '12px',
              fontSize: '14px', fontWeight: 700, border: 'none',
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
      </div>

      <div style={{ display: 'flex', gap: '24px', flex: 1, minHeight: 0 }}>

        {/* List Card */}
        <div style={{
          background: '#FFFFFF', borderRadius: '16px', border: '1px solid #e2e8f0',
          boxShadow: '0 10px 30px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column',
          flex: '100%', transition: 'all 0.3s ease', overflow: 'hidden'
        }}>
          {/* Search Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5 border-b" style={{ borderColor: '#e2e8f0' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '340px' }}>
              <Search style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={18} />
              <input
                type="text"
                placeholder="Search IMEI, Vehicle, or Model..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', padding: '12px 16px 12px 44px',
                  borderRadius: '12px', border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  fontSize: '14px', outline: 'none', color: '#334155', boxSizing: 'border-box',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => { e.target.style.background = '#ffffff'; e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
                onBlur={(e) => { e.target.style.background = '#f8fafc'; e.target.style.borderColor = '#cbd5e1'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
            <div style={{ display: 'flex', gap: '20px', fontSize: '14px', fontWeight: 600 }}>
              <span style={{ color: '#64748b' }}>Total: <span style={{ color: '#1e293b' }}>{devices.length}</span></span>
              <span style={{ color: '#64748b' }}>Online: <span style={{ color: '#10b981' }}>{devices.filter(d => d.is_online).length}</span></span>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <Loader2 size={32} color="#3b82f6" className="animate-spin" />
              <span style={{ fontSize: '15px', color: '#64748b', marginTop: '16px' }}>Loading inventory...</span>
            </div>
          ) : error ? (
            <div style={{ padding: '40px', textAlign: 'center', flex: 1 }}>
              <AlertTriangle size={36} color="#ef4444" style={{ margin: '0 auto 16px' }} />
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Failed to Load Records</div>
              <div style={{ fontSize: '14px', color: '#64748b', marginTop: '6px' }}>{error}</div>
            </div>
          ) : (
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <table className="pastel-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    {['Sl.No', 'Device IMEI', 'Type', 'Assigned Vehicle', 'Status', 'Last Comm'].map((h, i) => (
                      <th key={h} style={{ 
                        padding: '16px 20px', 
                        fontSize: '12px', 
                        fontWeight: 700, 
                        textTransform: 'uppercase', 
                        letterSpacing: '0.05em' 
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '100px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.8 }}>
                          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                            <Server size={40} color="#94a3b8" />
                          </div>
                          <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>No devices found</div>
                          <div style={{ fontSize: '15px', color: '#64748b', marginTop: '6px' }}>Awaiting device configuration.</div>
                        </div>
                      </td>
                    </tr>
                  ) : filtered.map((d, idx) => (
                    <tr
                      key={d.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9', cursor: 'default',
                        background: 'transparent',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '18px 20px', textAlign: 'center', fontSize: '13px', fontWeight: 700, color: '#64748B' }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: '18px 20px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>{d.imei}</div>
                      </td>
                      <td style={{ padding: '18px 20px', fontSize: '13px', color: '#475569', fontWeight: 500 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', padding: '5px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                          <Server size={12} color="#64748b" />
                          {d.type}
                        </div>
                      </td>
                      <td style={{ padding: '18px 20px', fontSize: '14px', color: '#0f172a', fontWeight: 600 }}>
                        {d.vehicle_name || 'Unassigned'}
                      </td>
                      <td style={{ padding: '18px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: d.is_online ? '#10b981' : '#cbd5e1', boxShadow: d.is_online ? '0 0 10px rgba(16,185,129,0.3)' : 'none' }} />
                          <span style={{ fontSize: '13px', fontWeight: 600, color: d.is_online ? '#059669' : '#64748b' }}>
                            {d.is_online ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '18px 20px', fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                        {d.last_update ? new Date(d.last_update).toLocaleTimeString() : 'Never'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Excel Upload Modal */}
      <ExcelBulkUploadModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        onSuccess={() => {
          setIsExcelModalOpen(false);
          fetchDevices();
        }}
        availableGroups={groups}
        availableOrgs={orgs}
        currentOrgId={user?.orgId}
        isSuperAdmin={isSuperAdmin}
      />

    </div>
  );
};

export default DevicesAdminPage;
