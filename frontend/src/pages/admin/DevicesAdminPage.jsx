import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Server, Loader2, AlertTriangle, Search, ChevronRight, X, Truck,
  Building2, Activity, Wifi, WifiOff, Plus, FileSpreadsheet, Download, Globe,
  Clock, Trash2, Cpu
} from 'lucide-react';
import { adminApi } from '../../api/axios';
import * as api from '../../api/adminApi';
import { useAuth } from '../../hooks/useAuth';
import ExcelBulkUploadModal from '../../components/ExcelBulkUploadModal';
import GoogleFormModal from '../../components/GoogleFormModal';
import { generateVehicleOnboardingTemplate } from '../../utils/excelTemplateGenerator';

const formatLastComm = (isoString) => {
  if (!isoString) return 'Never';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return 'Never';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedHours = String(hours).padStart(2, '0');
  return `${day}-${month}-${year} ${formattedHours}:${minutes}:${seconds} ${ampm}`;
};

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
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, ONLINE, OFFLINE, NEVER
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isGoogleFormModalOpen, setIsGoogleFormModalOpen] = useState(false);

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
    api.getGroups?.().then(res => { if (res.success) setGroups(res.data); }).catch(() => { });
    api.getOrgs?.().then(res => { if (res.success) setOrgs(res.data); }).catch(() => { });
  }, []);

  // Counts breakdown
  const totalCount = devices.length;
  const onlineCount = devices.filter(d => d.is_online).length;
  const offlineCount = devices.filter(d => !d.is_online && d.last_update).length;
  const neverCount = devices.filter(d => !d.last_update).length;

  const filtered = devices.filter(d => {
    const matchesSearch =
      (d.imei || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.vehicle_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.type || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'ONLINE') return d.is_online;
    if (statusFilter === 'OFFLINE') return !d.is_online && d.last_update;
    if (statusFilter === 'NEVER') return !d.last_update;

    return true;
  });

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
    <div style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', background: '#f8fafc' }}>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 shrink-0">
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>Device Inventory</h1>
          <p style={{ fontSize: '14px', color: '#64748b', marginTop: '2px' }}>Monitor hardware telemetry, connectivity, and provision devices in bulk.</p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={() => setIsGoogleFormModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition-all cursor-pointer"
            title="Share Google Form link with technicians/dealers for automatic admin sync"
          >
            <Globe size={14} className="text-blue-600" />
            <span>Google Form Link</span>
          </button>

          <button
            onClick={() => generateVehicleOnboardingTemplate(groups, user?.orgName)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition-all cursor-pointer"
            title="Download formatted Excel template for bulk onboarding"
          >
            <Download size={14} className="text-slate-600" />
            <span>Excel Template</span>
          </button>

          <button
            onClick={() => setIsExcelModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-black rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <FileSpreadsheet size={14} className="text-amber-400" />
            <span>Upload Excel</span>
          </button>

          <button
            onClick={() => navigate('/onBoardDevice')}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>Add Device</span>
          </button>
        </div>
      </div>

      {/* Search & Comprehensive Counters Toolbar */}
      <div style={{
        padding: '12px 0', marginBottom: '12px',
        display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
      }}>
        {/* Search Input */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '340px' }}>
          <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={16} />
          <input
            type="text"
            placeholder="Search IMEI, Vehicle, or Model..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px 8px 36px',
              borderRadius: '8px', border: '1px solid #cbd5e1',
              background: '#ffffff',
              fontSize: '13px', outline: 'none', color: '#334155', boxSizing: 'border-box',
              transition: 'all 0.2s'
            }}
            onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; }}
            onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Counts & Status Filter Badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px', fontSize: '13px', fontWeight: 600 }}>
          {/* Total */}
          <span
            onClick={() => setStatusFilter('ALL')}
            style={{ cursor: 'pointer', color: '#475569', background: statusFilter === 'ALL' ? '#e2e8f0' : '#ffffff', padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
          >
            Total: <strong style={{ color: '#0f172a', fontWeight: 700 }}>{totalCount}</strong>
          </span>

          {/* Online */}
          <span
            onClick={() => setStatusFilter(statusFilter === 'ONLINE' ? 'ALL' : 'ONLINE')}
            style={{ cursor: 'pointer', color: '#059669', background: statusFilter === 'ONLINE' ? '#ecfdf5' : '#ffffff', padding: '4px 10px', borderRadius: '6px', border: '1px solid #a7f3d0' }}
          >
            • Online: <strong style={{ color: '#10b981', fontWeight: 700 }}>{onlineCount}</strong>
          </span>

          {/* Offline */}
          <span
            onClick={() => setStatusFilter(statusFilter === 'OFFLINE' ? 'ALL' : 'OFFLINE')}
            style={{ cursor: 'pointer', color: '#dc2626', background: statusFilter === 'OFFLINE' ? '#fef2f2' : '#ffffff', padding: '4px 10px', borderRadius: '6px', border: '1px solid #fecaca' }}
          >
            • Offline: <strong style={{ color: '#ef4444', fontWeight: 700 }}>{offlineCount}</strong>
          </span>

          {/* Never Communicated */}
          <span
            onClick={() => setStatusFilter(statusFilter === 'NEVER' ? 'ALL' : 'NEVER')}
            style={{ cursor: 'pointer', color: '#64748b', background: statusFilter === 'NEVER' ? '#e2e8f0' : '#ffffff', padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
          >
            • Never Communicated: <strong style={{ color: '#475569', fontWeight: 700 }}>{neverCount}</strong>
          </span>
        </div>
      </div>

      {/* Direct Table View without Card Wrapper */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '40px' }}>
          <Loader2 size={30} color="#3b82f6" className="animate-spin" />
          <span style={{ fontSize: '13px', color: '#64748b', marginTop: '12px' }}>Loading inventory...</span>
        </div>
      ) : error ? (
        <div style={{ padding: '40px', textAlign: 'center', flex: 1 }}>
          <AlertTriangle size={32} color="#ef4444" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>Failed to Load Records</div>
          <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>{error}</div>
        </div>
      ) : (
        <div style={{ overflowY: 'auto', flex: 1, background: '#ffffff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#1e1b4b', position: 'sticky', top: 0, zIndex: 10 }}>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', width: '60px', textAlign: 'center', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>SL.NO</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>DEVICE IMEI</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>TYPE</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>ASSIGNED VEHICLE</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>STATUS</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em' }}>LAST COMMUNICATION</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '40px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.7 }}>
                      <Server size={32} color="#94a3b8" />
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', marginTop: '8px' }}>No devices found</div>
                    </div>
                  </td>
                </tr>
              ) : filtered.map((d, idx) => {
                let statusText = 'Offline';
                let statusColor = '#64748b';
                let dotColor = '#cbd5e1';

                if (!d.last_update) {
                  statusText = 'Never';
                  statusColor = '#64748b';
                  dotColor = '#cbd5e1';
                } else if (d.is_online) {
                  statusText = 'Online';
                  statusColor = '#059669';
                  dotColor = '#10b981';
                } else {
                  statusText = 'Offline';
                  statusColor = '#dc2626';
                  dotColor = '#ef4444';
                }

                return (
                  <tr
                    key={d.id}
                    style={{
                      borderBottom: '1px solid #e0e7ff',
                      height: '38px',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f5f3ff'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {/* Sl. No */}
                    <td style={{ padding: '8px 14px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#64748b', borderRight: '1px solid #e2e8f0' }}>
                      {idx + 1}
                    </td>

                    {/* Device IMEI */}
                    <td style={{ padding: '8px 14px', fontSize: '13px', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace', borderRight: '1px solid #e2e8f0' }}>
                      {d.imei}
                    </td>

                    {/* Device Type */}
                    <td style={{ padding: '8px 14px', fontSize: '12px', color: '#475569', fontWeight: 600, borderRight: '1px solid #e2e8f0' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', textTransform: 'uppercase' }}>
                        {d.type}
                      </span>
                    </td>

                    {/* Assigned Vehicle */}
                    <td style={{ padding: '8px 14px', fontSize: '13px', color: '#1e293b', fontWeight: 600, borderRight: '1px solid #e2e8f0' }}>
                      {d.vehicle_name || 'Unassigned'}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '8px 14px', borderRight: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: dotColor, display: 'inline-block' }} />
                        <span style={{ fontSize: '12px', fontWeight: 600, color: statusColor }}>
                          {statusText}
                        </span>
                      </div>
                    </td>

                    {/* Last Comm */}
                    <td style={{ padding: '8px 14px', fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                      {formatLastComm(d.last_update)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer info bar */}
      {!loading && !error && filtered.length > 0 && (
        <div style={{ padding: '8px 0', fontSize: '12px', color: '#64748b', fontWeight: 500, display: 'flex', justifyContent: 'between', alignItems: 'center' }}>
          <span>Showing 1 to {filtered.length} of {filtered.length} entries</span>
        </div>
      )}

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

      {/* Google Form Link & Integration Modal */}
      <GoogleFormModal
        isOpen={isGoogleFormModalOpen}
        onClose={() => setIsGoogleFormModalOpen(false)}
      />

    </div>
  );
};

export default DevicesAdminPage;
