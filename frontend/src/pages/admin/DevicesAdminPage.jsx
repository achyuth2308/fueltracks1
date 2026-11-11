import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Server, Loader2, AlertTriangle, Search, ChevronLeft, ChevronRight, X, Truck,
  Building2, Activity, Wifi, WifiOff, Plus, FileSpreadsheet, Download,
  Clock, Trash2, Cpu, Edit2, Copy, Check
} from 'lucide-react';
import { adminApi } from '../../api/axios';
import * as api from '../../api/adminApi';
import { useAuth } from '../../hooks/useAuth';
import ExcelBulkUploadModal from '../../components/ExcelBulkUploadModal';
import DeviceInventoryUploadModal from '../../components/modals/DeviceInventoryUploadModal';
import { generateVehicleOnboardingTemplate } from '../../utils/excelTemplateGenerator';
import { getNoDataThresholdHours } from '../../utils/markerUtils';
import { copyToClipboard } from '../../utils/clipboard';

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

const formatRelativeTime = (ts) => {
  if (!ts) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - Number(ts)) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
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
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;
  const [noDataThreshold, setNoDataThreshold] = useState(getNoDataThresholdHours());
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [copiedImei, setCopiedImei] = useState(null);

  const handleCopyImei = async (imei, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const success = await copyToClipboard(imei);
    if (success) {
      setCopiedImei(imei);
      setTimeout(() => setCopiedImei(null), 2000);
    }
  };

  useEffect(() => {
    const handleThresholdChange = (e) => {
      setNoDataThreshold(e.detail || getNoDataThresholdHours());
    };
    window.addEventListener('nodata-threshold-changed', handleThresholdChange);
    return () => window.removeEventListener('nodata-threshold-changed', handleThresholdChange);
  }, []);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getDevices({ thresholdHours: noDataThreshold });
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
          api_propagation: d.api_propagation,
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
  }, [noDataThreshold]);

  // Helper to determine online state dynamically according to selected No Data time
  const isDeviceOnline = (d) => {
    if (!d.last_update) return false;
    const lastSeenMs = new Date(d.last_update).getTime();
    if (isNaN(lastSeenMs)) return false;
    const thresholdMs = noDataThreshold * 3600 * 1000;
    return (Date.now() - lastSeenMs) < thresholdMs;
  };

  // Counts breakdown strictly matching user's selected No Data threshold
  const totalCount = devices.length;
  const onlineCount = devices.filter(d => isDeviceOnline(d)).length;
  const offlineCount = devices.filter(d => !isDeviceOnline(d) && d.last_update).length;
  const neverCount = devices.filter(d => !d.last_update).length;

  const filtered = devices.filter(d => {
    const matchesSearch =
      (d.imei || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.vehicle_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.type || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.api_propagation?.target || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    const online = isDeviceOnline(d);
    if (statusFilter === 'ONLINE') return online;
    if (statusFilter === 'OFFLINE') return !online && d.last_update;
    if (statusFilter === 'NEVER') return !d.last_update;

    return true;
  });

  // Reset to first page when search or status filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const activePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (activePage - 1) * pageSize;
  const paginatedDevices = filtered.slice(startIndex, startIndex + pageSize);

  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (activePage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (activePage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', activePage - 1, activePage, activePage + 1, '...', totalPages];
  };

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
            onClick={() => generateVehicleOnboardingTemplate(groups, user?.orgName)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition-all cursor-pointer"
            title="Download formatted Excel template for bulk onboarding"
          >
            <Download size={14} className="text-slate-500" />
            <span>Excel Template</span>
          </button>

          <button
            onClick={() => setIsInventoryModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition-all cursor-pointer"
            title="Import hardware stock spreadsheet (APM, Volty) with Serial Numbers & ICCIDs"
          >
            <Cpu size={14} className="text-indigo-600" />
            <span>Device Master / Inventory</span>
          </button>

          <button
            onClick={() => setIsExcelModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition-all cursor-pointer"
          >
            <FileSpreadsheet size={14} className="text-emerald-600" />
            <span>Upload Excel</span>
          </button>

          <button
            onClick={() => navigate('/onBoardDevice')}
            style={{ background: 'var(--brand-primary, #EA580C)' }}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white rounded-lg shadow-sm transition-all cursor-pointer hover:opacity-90"
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

          {/* No Data */}
          <span
            onClick={() => setStatusFilter(statusFilter === 'OFFLINE' ? 'ALL' : 'OFFLINE')}
            style={{ cursor: 'pointer', color: '#dc2626', background: statusFilter === 'OFFLINE' ? '#fef2f2' : '#ffffff', padding: '4px 10px', borderRadius: '6px', border: '1px solid #fecaca' }}
          >
            • No Data: <strong style={{ color: '#ef4444', fontWeight: 700 }}>{offlineCount}</strong>
          </span>

          {/* Unreachable */}
          <span
            onClick={() => setStatusFilter(statusFilter === 'NEVER' ? 'ALL' : 'NEVER')}
            style={{ cursor: 'pointer', color: '#64748b', background: statusFilter === 'NEVER' ? '#e2e8f0' : '#ffffff', padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
          >
            • Unreachable: <strong style={{ color: '#475569', fontWeight: 700 }}>{neverCount}</strong>
          </span>
        </div>
      </div>

      {/* Direct Table View */}
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
        <div style={{ overflowY: 'auto', flex: 1, background: '#ffffff', borderRadius: '8px 8px 0 0', border: '1px solid #e2e8f0', borderBottom: 'none' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--brand-header, #1e1b4b)', position: 'sticky', top: 0, zIndex: 10 }}>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', width: '60px', textAlign: 'center', borderRight: '1px solid rgba(255, 255, 255, 0.1)' }}>SL.NO</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.1)' }}>DEVICE IMEI</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.1)' }}>TYPE</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.1)' }}>ASSIGNED VEHICLE</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.1)' }}>API PROPAGATION</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.1)' }}>STATUS</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.1)' }}>LAST COMMUNICATION</th>
                <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', width: '85px', textAlign: 'center' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {paginatedDevices.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ padding: '40px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.7 }}>
                      <Server size={32} color="#94a3b8" />
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', marginTop: '8px' }}>No devices found</div>
                    </div>
                  </td>
                </tr>
              ) : paginatedDevices.map((d, idx) => {
                const online = isDeviceOnline(d);
                let statusBadge;

                if (!d.last_update) {
                  statusBadge = (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      padding: '3px 8px', borderRadius: '999px',
                      background: '#F1F5F9', border: '1px solid #E2E8F0',
                      color: '#475569', fontSize: '11px', fontWeight: 700
                    }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#94A3B8' }} />
                      Unreachable
                    </span>
                  );
                } else if (online) {
                  statusBadge = (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      padding: '3px 8px', borderRadius: '999px',
                      background: '#ECFDF5', border: '1px solid #A7F3D0',
                      color: '#065F46', fontSize: '11px', fontWeight: 700
                    }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }} />
                      Online
                    </span>
                  );
                } else {
                  statusBadge = (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      padding: '3px 8px', borderRadius: '999px',
                      background: '#FEF2F2', border: '1px solid #FECACA',
                      color: '#991B1B', fontSize: '11px', fontWeight: 700
                    }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EF4444' }} />
                      No Data
                    </span>
                  );
                }

                return (
                  <tr
                    key={d.id}
                    style={{
                      borderBottom: '1px solid #F1F5F9',
                      height: '42px',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {/* Sl. No based on current page */}
                    <td style={{ padding: '8px 14px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#64748b', borderRight: '1px solid #e2e8f0' }}>
                      {startIndex + idx + 1}
                    </td>

                    {/* Device IMEI */}
                    <td style={{ padding: '8px 14px', fontSize: '13px', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace', borderRight: '1px solid #e2e8f0' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <span>{d.imei}</span>
                        {copiedImei === d.imei ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            background: '#ECFDF5',
                            border: '1px solid #A7F3D0',
                            color: '#047857',
                            fontSize: '10.5px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px'
                          }}>
                            <Check size={11} color="#047857" />
                            Copied
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => handleCopyImei(d.imei, e)}
                            title="Copy IMEI to clipboard"
                            style={{
                              border: '1px solid #E2E8F0',
                              background: '#F8FAFC',
                              padding: '3px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              borderRadius: '4px',
                              transition: 'all 0.15s'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = '#EEF2F6';
                              e.currentTarget.style.borderColor = '#CBD5E1';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = '#F8FAFC';
                              e.currentTarget.style.borderColor = '#E2E8F0';
                            }}
                          >
                            <Copy size={12} className="text-slate-500" />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Device Type */}
                    <td style={{ padding: '8px 14px', fontSize: '12px', color: '#475569', fontWeight: 600, borderRight: '1px solid #e2e8f0' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', textTransform: 'uppercase' }}>
                        {d.type}
                      </span>
                    </td>

                    {/* Assigned Vehicle */}
                    <td style={{ padding: '8px 14px', fontSize: '13px', color: '#1e293b', fontWeight: 600, borderRight: '1px solid #e2e8f0' }}>
                      {d.vehicle_id ? (
                        <span
                          onClick={() => navigate(`/admin/vehicles/edit/${d.vehicle_id}`)}
                          style={{
                            cursor: 'pointer',
                            color: '#0F172A',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'color 0.15s'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'var(--brand-primary, #EA580C)'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = '#0F172A'; }}
                          title="Click to view/edit assigned vehicle"
                        >
                          <Truck size={14} className="text-slate-400 shrink-0" />
                          <span>{d.vehicle_name}</span>
                        </span>
                      ) : (
                        <span style={{ color: '#94A3B8', fontStyle: 'italic', fontSize: '12px' }}>
                          Unassigned
                        </span>
                      )}
                    </td>

                    {/* API Propagation */}
                    <td style={{ padding: '8px 14px', borderRight: '1px solid #e2e8f0', minWidth: '190px' }}>
                      {d.api_propagation?.target && d.api_propagation.target !== 'Internal Only' ? (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                              width: '7px',
                              height: '7px',
                              borderRadius: '50%',
                              background: (d.api_propagation.status === 'SUCCESS' || d.api_propagation.status === 'ACTIVE') ? '#10b981' : d.api_propagation.status === 'FAILED' ? '#ef4444' : '#f59e0b',
                              display: 'inline-block',
                              flexShrink: 0
                            }} />
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                              {d.api_propagation.target}
                            </span>
                          </div>
                          <div style={{
                            fontSize: '11px',
                            fontWeight: 500,
                            color: (d.api_propagation.status === 'SUCCESS' || d.api_propagation.status === 'ACTIVE') ? '#059669' : d.api_propagation.status === 'FAILED' ? '#dc2626' : '#d97706',
                            marginTop: '2px',
                            paddingLeft: '13px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <span>●</span>
                            <span>{d.api_propagation.message}</span>
                            {d.api_propagation.timestamp ? (
                              <span>• {formatRelativeTime(d.api_propagation.timestamp)}</span>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#94a3b8', display: 'inline-block' }} />
                          <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>
                            — Internal Only
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '8px 14px', borderRight: '1px solid #e2e8f0' }}>
                      {statusBadge}
                    </td>

                    {/* Last Comm */}
                    <td style={{ padding: '8px 14px', fontSize: '12px', color: '#64748b', fontWeight: 500, borderRight: '1px solid #e2e8f0' }}>
                      {formatLastComm(d.last_update)}
                    </td>

                    {/* Action */}
                    <td style={{ padding: '6px 14px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        {d.vehicle_id ? (
                          <button
                            onClick={() => navigate(`/admin/vehicles/edit/${d.vehicle_id}`)}
                            title="Edit Assigned Vehicle"
                            style={{
                              padding: '5px',
                              borderRadius: '6px',
                              border: '1px solid #E2E8F0',
                              background: '#FFFFFF',
                              cursor: 'pointer',
                              color: '#475569',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.15s'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.color = 'var(--brand-primary, #EA580C)';
                              e.currentTarget.style.borderColor = 'var(--brand-primary, #EA580C)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.color = '#475569';
                              e.currentTarget.style.borderColor = '#E2E8F0';
                            }}
                          >
                            <Edit2 size={13} />
                          </button>
                        ) : null}
                        {isSuperAdmin && (
                          <button
                            onClick={(e) => handleDelete(d.id, e)}
                            title="Delete Device"
                            style={{
                              padding: '5px',
                              borderRadius: '6px',
                              border: '1px solid #E2E8F0',
                              background: '#FFFFFF',
                              cursor: 'pointer',
                              color: '#94A3B8',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.15s'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.color = '#DC2626';
                              e.currentTarget.style.borderColor = '#FCA5A5';
                              e.currentTarget.style.background = '#FEF2F2';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.color = '#94A3B8';
                              e.currentTarget.style.borderColor = '#E2E8F0';
                              e.currentTarget.style.background = '#FFFFFF';
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer bar with Showing info, Rows per page selector, and Pagination */}
      {!loading && !error && filtered.length > 0 && (
        <div style={{
          padding: '10px 16px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderTop: '1px solid #cbd5e1',
          borderRadius: '0 0 8px 8px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
        }}>
          {/* Left: Showing info */}
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            <span>
              Showing <strong style={{ color: '#0f172a' }}>{startIndex + 1}</strong> to{' '}
              <strong style={{ color: '#0f172a' }}>{Math.min(startIndex + pageSize, filtered.length)}</strong> of{' '}
              <strong style={{ color: '#0f172a' }}>{filtered.length}</strong> entries
            </span>
          </div>

          {/* Right: Page Numbers matching FuelTracks UI theme */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {/* Previous page button */}
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={activePage === 1}
                aria-label="Previous page"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: 'none',
                  background: 'transparent',
                  color: activePage === 1 ? '#cbd5e1' : '#475569',
                  cursor: activePage === 1 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={e => {
                  if (activePage !== 1) {
                    e.currentTarget.style.background = '#f1f5f9';
                    e.currentTarget.style.color = '#0f172a';
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = activePage === 1 ? '#cbd5e1' : '#475569';
                }}
              >
                <ChevronLeft size={18} strokeWidth={2.5} />
              </button>

              {/* Page numbers */}
              {getPageNumbers().map((item, i) => {
                if (item === '...') {
                  return (
                    <span
                      key={`ellipsis-${i}`}
                      style={{
                        width: '28px',
                        textAlign: 'center',
                        color: '#94a3b8',
                        fontSize: '14px',
                        userSelect: 'none'
                      }}
                    >
                      …
                    </span>
                  );
                }

                const isActive = item === activePage;
                return (
                  <button
                    type="button"
                    key={item}
                    onClick={() => setCurrentPage(item)}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '13px',
                      fontWeight: isActive ? 700 : 600,
                      color: isActive ? '#ffffff' : '#475569',
                      background: isActive ? '#1e1b4b' : 'transparent',
                      cursor: isActive ? 'default' : 'pointer',
                      transition: 'all 0.15s',
                      boxShadow: isActive ? '0 2px 4px rgba(30, 27, 75, 0.25)' : 'none'
                    }}
                    onMouseEnter={e => {
                      if (!isActive) {
                        e.currentTarget.style.background = '#f1f5f9';
                        e.currentTarget.style.color = '#0f172a';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#475569';
                      }
                    }}
                  >
                    {item}
                  </button>
                );
              })}

              {/* Next page button */}
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={activePage === totalPages}
                aria-label="Next page"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: 'none',
                  background: 'transparent',
                  color: activePage === totalPages ? '#cbd5e1' : '#475569',
                  cursor: activePage === totalPages ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={e => {
                  if (activePage !== totalPages) {
                    e.currentTarget.style.background = '#f1f5f9';
                    e.currentTarget.style.color = '#0f172a';
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = activePage === totalPages ? '#cbd5e1' : '#475569';
                }}
              >
                <ChevronRight size={18} strokeWidth={2.5} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Excel Upload Modal */}
      <DeviceInventoryUploadModal
        isOpen={isInventoryModalOpen}
        onClose={() => setIsInventoryModalOpen(false)}
      />

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
