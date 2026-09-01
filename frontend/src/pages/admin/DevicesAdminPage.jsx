import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Server, Loader2, AlertTriangle, Search, ChevronRight, X, Truck,
  Building2, Activity, Wifi, WifiOff, Plus, FileSpreadsheet, Download, Cpu
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
    <div className="colorful-mesh-bg" style={{ padding: '32px', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 shrink-0">
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em', textShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>Device Inventory</h1>
          <p style={{ fontSize: '15px', color: 'rgba(255, 255, 255, 0.85)', marginTop: '4px' }}>Monitor hardware telemetry, connectivity, and provision devices in bulk.</p>
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
        <div className="glass-card-colorful" style={{
          borderRadius: '20px', display: 'flex', flexDirection: 'column',
          flex: '100%', transition: 'all 0.3s ease', overflow: 'hidden'
        }}>
          {/* Search Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.2)' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
              <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.7)' }} size={16} />
              <input
                type="text"
                placeholder="Search IMEI, Vehicle, or Model..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="glass-input-colorful"
                style={{
                  width: '100%', padding: '10px 14px 10px 38px',
                  borderRadius: '12px',
                  fontSize: '14px', outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '14px', fontWeight: 600 }}>
              <span style={{ color: 'rgba(255,255,255,0.8)' }}>Total: <span style={{ color: '#FFFFFF' }}>{devices.length}</span></span>
              <span style={{ color: 'rgba(255,255,255,0.8)' }}>Online: <span style={{ color: '#6ee7b7' }}>{devices.filter(d => d.is_online).length}</span></span>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <Loader2 size={32} color="#FFFFFF" className="animate-spin" />
              <span style={{ fontSize: '15px', color: 'rgba(255,255,255,0.8)', marginTop: '12px' }}>Loading inventory...</span>
            </div>
          ) : error ? (
            <div style={{ padding: '40px', textAlign: 'center', flex: 1 }}>
              <AlertTriangle size={32} color="#fca5a5" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#FFFFFF' }}>Failed to Load Records</div>
              <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', marginTop: '4px' }}>{error}</div>
            </div>
          ) : (
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.15)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    {['Device IMEI', 'Type', 'Assigned Vehicle', 'Status', 'Last Comm'].map(h => (
                      <th key={h} style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '80px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.7 }}>
                          <Server size={48} color="rgba(255,255,255,0.5)" style={{ marginBottom: '16px' }} />
                          <div style={{ fontSize: '18px', fontWeight: 700, color: '#FFFFFF' }}>No devices found</div>
                          <div style={{ fontSize: '15px', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>Awaiting device configuration.</div>
                        </div>
                      </td>
                    </tr>
                  ) : filtered.map((d) => (
                    <tr
                      key={d.id}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.08)', cursor: 'default',
                        background: 'transparent',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF', fontFamily: 'monospace' }}>{d.imei}</div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, color: '#FFFFFF' }}>
                          <Cpu size={12} />
                          {d.type}
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Truck size={16} color="#FFFFFF" />
                          </div>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>{d.vehicle_name}</div>
                            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>{d.org_name}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: d.is_online ? '#6ee7b7' : 'rgba(255,255,255,0.5)' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: d.is_online ? '#10B981' : 'rgba(255,255,255,0.3)', boxShadow: d.is_online ? '0 0 8px #10B981' : 'none' }}></div>
                          {d.is_online ? 'Online' : 'Offline'}
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
                          {d.last_update ? new Date(d.last_update).toLocaleTimeString() : 'Never'}
                        </div>
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
