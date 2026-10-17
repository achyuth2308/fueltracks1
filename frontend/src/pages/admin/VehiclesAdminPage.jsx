import React, { useState, useEffect, useMemo } from 'react';
import { formatLocalDate, formatLocalTime } from '../../utils/dateUtils';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Truck, Plus, Edit2, Trash2, Loader2, AlertTriangle, Search, Eye,
  Server, MapPin, CheckCircle, ChevronLeft, ChevronRight, X, Building2, Users2,
  Activity, FileSpreadsheet, Download, Layers, CheckSquare, Square,
  Filter, Tag, Globe, ArrowUpDown, ArrowUp, ArrowDown, Copy, Check,
  Cpu, Calendar, User, Fuel, Settings, FileText
} from 'lucide-react';
import * as vehicleApi from '../../api/vehicleApi';
import * as adminApi from '../../api/adminApi';
import { useAuth } from '../../hooks/useAuth';
import ExcelBulkUploadModal from '../../components/ExcelBulkUploadModal';
import GoogleFormModal from '../../components/GoogleFormModal';
import { generateVehicleOnboardingTemplate } from '../../utils/excelTemplateGenerator';
const StatusDot = ({ online }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
    <div style={{
      width: '8px', height: '8px', borderRadius: '50%',
      background: online ? '#10B981' : '#a0b4d1ff',
      boxShadow: online ? '0 0 6px rgba(16, 185, 129, 0.42)' : 'none',
    }} />
    <span style={{ fontSize: '11px', fontWeight: 600, color: online ? '#10B981' : '#64748B' }}>
      {online ? 'Online' : 'Offline'}
    </span>
  </div>
);

const CATEGORIES = ['All', 'TG Mining', 'VLTD', 'VLTD + Mining', 'General'];

const VehiclesAdminPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isSuperAdmin = user?.role === 'superadmin';

  const [vehicles, setVehicles] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedOrgId, setSelectedOrgId] = useState('all');
  const [selectedGroupId, setSelectedGroupId] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  // Sorting State
  const [sortKey, setSortKey] = useState(null);
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'

  // Details Panel / Drawer State
  const [viewingVehicle, setViewingVehicle] = useState(null);
  const [drawerSearch, setDrawerSearch] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);

  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isGoogleFormModalOpen, setIsGoogleFormModalOpen] = useState(false);

  const handleCopy = (text, key) => {
    if (!text || text === '-') return;
    navigator.clipboard?.writeText(String(text));
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const params = {
        t: Date.now()
      };
      if (selectedCategory !== 'All') params.category = selectedCategory;
      if (selectedOrgId !== 'all') params.orgId = selectedOrgId;
      if (selectedGroupId !== 'all') params.groupId = selectedGroupId;

      const res = await vehicleApi.getVehicles(params);
      if (res.success) setVehicles(res.data);
    } catch (err) {
      setError('Failed to load fleet registry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, [selectedCategory, selectedOrgId, selectedGroupId]);

  // Re-fetch whenever we navigate back to this page (location.key changes on each navigation)
  useEffect(() => {
    fetchVehicles();
  }, [location.key]);

  useEffect(() => {
    if (isSuperAdmin || user?.role === 'dealer') {
      adminApi.getOrgs().then(res => { if (res.success) setOrgs(res.data); }).catch(() => { });
      adminApi.getGroups().then(res => { if (res.success) setGroups(res.data); }).catch(() => { });
    }
  }, [user, isSuperAdmin]);

  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    if (window.confirm('Are you sure you want to remove this vehicle from the registry?')) {
      try {
        const res = await vehicleApi.deleteVehicle(id);
        if (res.success) {
          if (viewingVehicle?.id === id) setViewingVehicle(null);
          fetchVehicles();
        }
      } catch (err) {
        alert(err.response?.data?.error || 'Delete failed.');
      }
    }
  };

  const filtered = vehicles.filter(v => {
    const q = searchQuery.toLowerCase();
    const meta = v.metadata || {};
    return (
      (v.name || '').toLowerCase().includes(q) ||
      (v.plate || '').toLowerCase().includes(q) ||
      (v.imei || '').toLowerCase().includes(q) ||
      (v.group_name || '').toLowerCase().includes(q) ||
      (v.gps_sim_no || '').toLowerCase().includes(q) ||
      (meta.vlttdSlno || '').toLowerCase().includes(q) ||
      (meta.ownerName || '').toLowerCase().includes(q) ||
      (meta.ownerPhone || '').toLowerCase().includes(q) ||
      (meta.aadharNo || '').toLowerCase().includes(q) ||
      (meta.panNo || '').toLowerCase().includes(q) ||
      (meta.rtoLocation || '').toLowerCase().includes(q) ||
      (meta.salesman || '').toLowerCase().includes(q) ||
      (meta.serviceEngineer || '').toLowerCase().includes(q) ||
      (meta.sensorNo || '').toLowerCase().includes(q) ||
      (meta.sim2 || '').toLowerCase().includes(q) ||
      (meta.iccid || '').toLowerCase().includes(q)
    );
  });

  // Reset to first page when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedOrgId, selectedGroupId]);

  const sortedVehicles = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const metaA = a.metadata || {};
      const metaB = b.metadata || {};
      let valA = '';
      let valB = '';

      switch (sortKey) {
        case 'licenceId':
          valA = a.licenceId || metaA.licenceId || a.licence_no || '';
          valB = b.licenceId || metaB.licenceId || b.licence_no || '';
          break;
        case 'vehicleId':
          valA = metaA.vehicleId || a.plate || '';
          valB = metaB.vehicleId || b.plate || '';
          break;
        case 'name':
          valA = a.name || '';
          valB = b.name || '';
          break;
        case 'orgName':
          valA = a.org_name || '';
          valB = b.org_name || '';
          break;
        case 'deviceId':
          valA = a.imei || a.device_id || '';
          valB = b.imei || b.device_id || '';
          break;
        case 'serverName':
          valA = a.server_name || metaA.serverName || 'Voltsys';
          valB = b.server_name || metaB.serverName || 'Voltsys';
          break;
        case 'lastCommTime':
          valA = a.last_seen || a.last_comm_time || metaA.lastCommTime || 0;
          valB = b.last_seen || b.last_comm_time || metaB.lastCommTime || 0;
          return sortOrder === 'asc' ? (new Date(valA) - new Date(valB)) : (new Date(valB) - new Date(valA));
        case 'gpsSimNo':
          valA = a.gps_sim_no || metaA.sim1 || metaA.simNo || metaA.sim || '';
          valB = b.gps_sim_no || metaB.sim1 || metaB.simNo || metaB.sim || '';
          break;
        case 'licenceIssuedDate':
          valA = a.licence_issued_date || metaA.licenceIssuedDate || metaA.installedDate || metaA.installationDate || 0;
          valB = b.licence_issued_date || metaB.licenceIssuedDate || metaB.installedDate || metaB.installationDate || 0;
          return sortOrder === 'asc' ? (new Date(valA) - new Date(valB)) : (new Date(valB) - new Date(valA));
        case 'onboardDate':
          valA = metaA.onboardingDate || metaA.onboardDate || a.created_at || 0;
          valB = metaB.onboardingDate || metaB.onboardDate || b.created_at || 0;
          return sortOrder === 'asc' ? (new Date(valA) - new Date(valB)) : (new Date(valB) - new Date(valA));
        case 'licenceExpireDate':
          valA = a.licence_expire_date || metaA.licenceExpireDate || metaA.expiryDate || 0;
          valB = b.licence_expire_date || metaB.licenceExpireDate || metaB.expiryDate || 0;
          return sortOrder === 'asc' ? (new Date(valA) - new Date(valB)) : (new Date(valB) - new Date(valA));
        default:
          return 0;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      if (strA < strB) return sortOrder === 'asc' ? -1 : 1;
      if (strA > strB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortOrder]);

  const totalPages = Math.ceil(sortedVehicles.length / pageSize) || 1;
  const activePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (activePage - 1) * pageSize;
  const paginatedVehicles = sortedVehicles.slice(startIndex, startIndex + pageSize);

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

  // Category counts
  const categoryCounts = vehicles.reduce((acc, v) => {
    const cat = v.category || 'General';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="pastel-page-bg" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px 20px', gap: '10px', boxSizing: 'border-box' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '11px', fontWeight: 700, marginBottom: '2px' }}>
            <span>Fleet Management</span>
            <ChevronRight size={12} />
            <span style={{ color: '#ea580c' }}>Vehicle Assets</span>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
            Vehicle Assets Registry
          </h1>
          <p style={{ fontSize: '12px', color: '#475569', margin: '2px 0 0 0' }}>
            Manage fleet assets, telemetry hardware mapping, and full device configuration.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => setIsGoogleFormModalOpen(true)}
            style={{
              padding: '10px 18px', borderRadius: '12px', background: '#FFFFFF',
              border: '1px solid #CBD5E1', color: '#1E293B', fontSize: '13px', fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
            }}
          >
            <Globe size={16} color="#f97316" /> Google Form Link
          </button>

          <button
            onClick={() => generateVehicleOnboardingTemplate(groups, user?.org_name || 'FuelTracks')}
            style={{
              padding: '10px 18px', borderRadius: '12px', background: '#FFFFFF',
              border: '1px solid #CBD5E1', color: '#334155', fontSize: '13px', fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
            }}
          >
            <Download size={16} color="#64748B" /> Download Excel Template
          </button>

          <button
            onClick={() => setIsExcelModalOpen(true)}
            style={{
              padding: '10px 18px', borderRadius: '12px', background: '#0F172A',
              border: 'none', color: '#FFFFFF', fontSize: '13px', fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(15,23,42,0.15)'
            }}
          >
            <FileSpreadsheet size={16} color="#f97316" /> Bulk Excel Onboard
          </button>

          <button
            onClick={() => navigate('/admin/vehicles/new')}
            style={{
              padding: '10px 20px', borderRadius: '12px', background: '#f97316',
              border: 'none', color: '#FFFFFF', fontSize: '13px', fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(249,115,22,0.25)'
            }}
          >
            <Plus size={18} /> Register Vehicle
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3 p-1 bg-white rounded-xl border border-slate-200">
        {CATEGORIES.map(cat => {
          const count = cat === 'All' ? vehicles.length : (categoryCounts[cat] || 0);
          const isSelected = selectedCategory === cat;

          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${isSelected
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
            >
              <span>{cat}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${isSelected ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter Toolbar */}
      <div style={{
        background: '#FFFFFF', borderRadius: '10px', border: '1px solid #E2E8F0',
        padding: '8px 12px', marginBottom: '12px', display: 'flex', gap: '12px',
        alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: 1, minWidth: '280px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search by Vehicle Name, Plate, IMEI, Owner, Group, SIM..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%', padding: '6px 12px 6px 36px', borderRadius: '6px',
                border: '1px solid #CBD5E1', fontSize: '12px', outline: 'none',
                background: '#FFFFFF', color: '#0F172A', boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Org Filter (for Superadmin/Dealer) */}
          {(isSuperAdmin || user?.role === 'dealer') && orgs.length > 0 && (
            <select
              value={selectedOrgId}
              onChange={e => setSelectedOrgId(e.target.value)}
              style={{
                padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1',
                fontSize: '12px', background: '#FFFFFF', color: '#0F172A', outline: 'none', cursor: 'pointer', fontWeight: 600
              }}
            >
              <option value="all">All Organizations</option>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}

          {/* Group Filter */}
          {groups.length > 0 && (
            <select
              value={selectedGroupId}
              onChange={e => setSelectedGroupId(e.target.value)}
              style={{
                padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1',
                fontSize: '12px', background: '#FFFFFF', color: '#0F172A', outline: 'none', cursor: 'pointer', fontWeight: 600
              }}
            >
              <option value="all">All Groups</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Main Content Layout */}
      <div style={{ display: 'flex', gap: '24px', alignItems: 'stretch', flex: 1, minHeight: 0 }}>

        {/* Table Container - Direct View without Card Wrapper */}
        <div style={{ flex: 1, background: '#FFFFFF', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '48px' }}>
              <Loader2 size={36} className="animate-spin" color="#f97316" style={{ marginBottom: '12px' }} />
              <div style={{ fontSize: '14px', color: '#6B7280', fontWeight: 600 }}>Loading vehicles...</div>
            </div>
          ) : error ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#DC2626', gap: '8px' }}>
              <AlertTriangle size={20} />
              <span>{error}</span>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '48px', color: '#6B7280' }}>
              <Truck size={48} color="#CBD5E1" style={{ marginBottom: '12px' }} />
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#334155' }}>No vehicles found</div>
              <div style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px' }}>Try adjusting your search query, category, or group filter.</div>
            </div>
          ) : (
            <>
              <div style={{ overflow: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', whiteSpace: 'nowrap' }}>
                 <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ background: '#1e1b4b' }}>
                    {/* 1. Licence ID */}
                    <th
                      onClick={() => handleSort('licenceId')}
                      style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)', cursor: 'pointer', userSelect: 'none' }}
                      title="Sort by Licence ID"
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span>Licence ID</span>
                        {sortKey === 'licenceId' ? (
                          sortOrder === 'asc' ? <ArrowUp size={13} style={{ color: '#f97316' }} /> : <ArrowDown size={13} style={{ color: '#f97316' }} />
                        ) : (
                          <ArrowUpDown size={13} style={{ opacity: 0.6 }} />
                        )}
                      </div>
                    </th>

                    {/* 2. Vehicle ID */}
                    <th
                      onClick={() => handleSort('vehicleId')}
                      style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)', cursor: 'pointer', userSelect: 'none' }}
                      title="Sort by Vehicle ID"
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span>Vehicle ID</span>
                        {sortKey === 'vehicleId' ? (
                          sortOrder === 'asc' ? <ArrowUp size={13} style={{ color: '#f97316' }} /> : <ArrowDown size={13} style={{ color: '#f97316' }} />
                        ) : (
                          <ArrowUpDown size={13} style={{ opacity: 0.6 }} />
                        )}
                      </div>
                    </th>

                    {/* 3. Vehicle Name */}
                    <th
                      onClick={() => handleSort('name')}
                      style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)', cursor: 'pointer', userSelect: 'none' }}
                      title="Sort by Vehicle Name"
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span>Vehicle Name</span>
                        {sortKey === 'name' ? (
                          sortOrder === 'asc' ? <ArrowUp size={13} style={{ color: '#f97316' }} /> : <ArrowDown size={13} style={{ color: '#f97316' }} />
                        ) : (
                          <ArrowUpDown size={13} style={{ opacity: 0.6 }} />
                        )}
                      </div>
                    </th>

                    {/* 4. Org Name */}
                    <th
                      onClick={() => handleSort('orgName')}
                      style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)', cursor: 'pointer', userSelect: 'none' }}
                      title="Sort by Org Name"
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span>Org Name</span>
                        {sortKey === 'orgName' ? (
                          sortOrder === 'asc' ? <ArrowUp size={13} style={{ color: '#f97316' }} /> : <ArrowDown size={13} style={{ color: '#f97316' }} />
                        ) : (
                          <ArrowUpDown size={13} style={{ opacity: 0.6 }} />
                        )}
                      </div>
                    </th>

                    {/* 5. Device ID */}
                    <th
                      onClick={() => handleSort('deviceId')}
                      style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)', cursor: 'pointer', userSelect: 'none' }}
                      title="Sort by Device ID"
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span>Device ID</span>
                        {sortKey === 'deviceId' ? (
                          sortOrder === 'asc' ? <ArrowUp size={13} style={{ color: '#f97316' }} /> : <ArrowDown size={13} style={{ color: '#f97316' }} />
                        ) : (
                          <ArrowUpDown size={13} style={{ opacity: 0.6 }} />
                        )}
                      </div>
                    </th>

                    {/* 6. Server Name */}
                    <th
                      onClick={() => handleSort('serverName')}
                      style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)', cursor: 'pointer', userSelect: 'none' }}
                      title="Sort by Server Name"
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span>Server Name</span>
                        {sortKey === 'serverName' ? (
                          sortOrder === 'asc' ? <ArrowUp size={13} style={{ color: '#f97316' }} /> : <ArrowDown size={13} style={{ color: '#f97316' }} />
                        ) : (
                          <ArrowUpDown size={13} style={{ opacity: 0.6 }} />
                        )}
                      </div>
                    </th>

                    {/* 7. Last Comm Time */}
                    <th
                      onClick={() => handleSort('lastCommTime')}
                      style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)', cursor: 'pointer', userSelect: 'none' }}
                      title="Sort by Last Communication Time"
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span>Last Comm Time</span>
                        {sortKey === 'lastCommTime' ? (
                          sortOrder === 'asc' ? <ArrowUp size={13} style={{ color: '#f97316' }} /> : <ArrowDown size={13} style={{ color: '#f97316' }} />
                        ) : (
                          <ArrowUpDown size={13} style={{ opacity: 0.6 }} />
                        )}
                      </div>
                    </th>

                    {/* 8. GPS Sim No */}
                    <th
                      onClick={() => handleSort('gpsSimNo')}
                      style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)', cursor: 'pointer', userSelect: 'none' }}
                      title="Sort by GPS SIM No"
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span>GPS Sim No</span>
                        {sortKey === 'gpsSimNo' ? (
                          sortOrder === 'asc' ? <ArrowUp size={13} style={{ color: '#f97316' }} /> : <ArrowDown size={13} style={{ color: '#f97316' }} />
                        ) : (
                          <ArrowUpDown size={13} style={{ opacity: 0.6 }} />
                        )}
                      </div>
                    </th>

                    {/* 9. Licence Issued Date */}
                    <th
                      onClick={() => handleSort('licenceIssuedDate')}
                      style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)', cursor: 'pointer', userSelect: 'none' }}
                      title="Sort by Licence Issued Date"
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span>Licence Issued Date</span>
                        {sortKey === 'licenceIssuedDate' ? (
                          sortOrder === 'asc' ? <ArrowUp size={13} style={{ color: '#f97316' }} /> : <ArrowDown size={13} style={{ color: '#f97316' }} />
                        ) : (
                          <ArrowUpDown size={13} style={{ opacity: 0.6 }} />
                        )}
                      </div>
                    </th>

                    {/* 10. Onboard Date */}
                    <th
                      onClick={() => handleSort('onboardDate')}
                      style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)', cursor: 'pointer', userSelect: 'none' }}
                      title="Sort by Onboard Date"
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span>Onboard Date</span>
                        {sortKey === 'onboardDate' ? (
                          sortOrder === 'asc' ? <ArrowUp size={13} style={{ color: '#f97316' }} /> : <ArrowDown size={13} style={{ color: '#f97316' }} />
                        ) : (
                          <ArrowUpDown size={13} style={{ opacity: 0.6 }} />
                        )}
                      </div>
                    </th>

                    {/* 11. Licence Expire Date */}
                    <th
                      onClick={() => handleSort('licenceExpireDate')}
                      style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)', cursor: 'pointer', userSelect: 'none' }}
                      title="Sort by Licence Expire Date"
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span>Licence Expire Date</span>
                        {sortKey === 'licenceExpireDate' ? (
                          sortOrder === 'asc' ? <ArrowUp size={13} style={{ color: '#f97316' }} /> : <ArrowDown size={13} style={{ color: '#f97316' }} />
                        ) : (
                          <ArrowUpDown size={13} style={{ opacity: 0.6 }} />
                        )}
                      </div>
                    </th>

                    {/* 12. Actions */}
                    <th style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <span>Actions</span>
                        <ArrowUpDown size={13} style={{ opacity: 0.6 }} />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedVehicles.map((v) => {
                    const meta = v.metadata || {};

                    return (
                      <tr
                        key={v.id}
                        onClick={() => setViewingVehicle(v)}
                        style={{
                          borderBottom: '1px solid #e0e7ff', cursor: 'pointer',
                          height: '40px',
                          background: viewingVehicle?.id === v.id ? '#f5f3ff' : 'transparent',
                          transition: 'background 0.15s',
                          whiteSpace: 'nowrap'
                        }}
                        onMouseEnter={e => { if (viewingVehicle?.id !== v.id) e.currentTarget.style.background = '#f8fafc'; }}
                        onMouseLeave={e => { if (viewingVehicle?.id !== v.id) e.currentTarget.style.background = 'transparent'; }}
                      >
                        {/* 1. Licence ID */}
                        <td style={{ padding: '8px 14px', fontSize: '12px', color: '#475569', fontFamily: 'monospace', borderRight: '1px solid #e2e8f0' }}>
                          {v.licenceId || meta.licenceId || v.licence_no || '-'}
                        </td>

                        {/* 2. Vehicle ID */}
                        <td style={{ padding: '8px 14px', fontSize: '13px', color: '#0f172a', fontWeight: 600, borderRight: '1px solid #e2e8f0' }}>
                          {meta.vehicleId || v.plate || '-'}
                        </td>

                        {/* 3. Vehicle Name */}
                        <td style={{ padding: '8px 14px', fontSize: '13px', color: '#0f172a', fontWeight: 700, borderRight: '1px solid #e2e8f0' }}>
                          {v.name || '-'}
                        </td>

                        {/* 4. Org Name */}
                        <td style={{ padding: '8px 14px', fontSize: '12px', color: '#475569', fontWeight: 600, borderRight: '1px solid #e2e8f0' }}>
                          {v.org_name || user?.org_name || '-'}
                        </td>

                        {/* 5. Device ID */}
                        <td style={{ padding: '8px 14px', fontSize: '13px', color: '#0f172a', fontWeight: 700, fontFamily: 'monospace', borderRight: '1px solid #e2e8f0' }}>
                          {v.imei || v.device_id || '-'}
                        </td>

                        {/* 6. Server Name */}
                        <td style={{ padding: '8px 14px', fontSize: '12px', color: '#475569', borderRight: '1px solid #e2e8f0' }}>
                          <span style={{ display: 'inline-block', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                            {v.server_name || meta.serverName || 'Voltsys'}
                          </span>
                        </td>

                        {/* 7. Last Comm Time */}
                        <td style={{ padding: '8px 14px', fontSize: '12px', color: '#334155', fontFamily: 'monospace', borderRight: '1px solid #e2e8f0' }}>
                          {v.last_seen ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: v.is_online ? '#10b981' : '#94a3b8' }} />
                              <span>{formatLocalTime(v.last_seen)}</span>
                            </div>
                          ) : (v.last_comm_time || meta.lastCommTime ? (
                            <span>{formatLocalTime(v.last_comm_time || meta.lastCommTime)}</span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>-</span>
                          ))}
                        </td>

                        {/* 8. GPS Sim No */}
                        <td style={{ padding: '8px 14px', fontSize: '12px', color: '#475569', fontFamily: 'monospace', borderRight: '1px solid #e2e8f0' }}>
                          {v.gps_sim_no || meta.sim1 || meta.simNo || meta.sim || '-'}
                        </td>

                        {/* 9. Licence Issued Date */}
                        <td style={{ padding: '8px 14px', fontSize: '12px', color: '#475569', borderRight: '1px solid #e2e8f0' }}>
                          {v.licence_issued_date || meta.licenceIssuedDate || meta.installedDate || meta.installationDate
                            ? formatLocalDate(v.licence_issued_date || meta.licenceIssuedDate || meta.installedDate || meta.installationDate)
                            : '-'}
                        </td>

                        {/* 10. Onboard Date */}
                        <td style={{ padding: '8px 14px', fontSize: '12px', color: '#475569', borderRight: '1px solid #e2e8f0' }}>
                          {meta.onboardingDate || meta.onboardDate || v.created_at
                            ? formatLocalDate(meta.onboardingDate || meta.onboardDate || v.created_at)
                            : '-'}
                        </td>

                        {/* 11. Licence Expire Date */}
                        <td style={{ padding: '8px 14px', fontSize: '12px', color: '#475569', borderRight: '1px solid #e2e8f0' }}>
                          {v.licence_expire_date || meta.licenceExpireDate || meta.expiryDate
                            ? formatLocalDate(v.licence_expire_date || meta.licenceExpireDate || meta.expiryDate)
                            : '-'}
                        </td>

                        {/* 12. Actions */}
                        <td style={{ padding: '8px 14px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <button
                              onClick={() => navigate(`/admin/vehicles/edit/${v.id}`)}
                              title="Edit Vehicle Details"
                              style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '7px',
                                background: '#f0fdf4',
                                border: '1px solid #bbf7d0',
                                color: '#16a34a',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#dcfce7'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = '#f0fdf4'; }}
                            >
                              <Edit2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer bar with Showing info and Pagination */}
            {!loading && !error && filtered.length > 0 && (
              <div style={{
                padding: '10px 16px',
                background: '#ffffff',
                borderTop: '1px solid #e2e8f0',
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
          </>
        )}
        </div>
      </div>

      {/* Slide-over Drawer / Modal: ALL FIELDS OF VEHICLE */}
      {viewingVehicle && (() => {
        const meta = viewingVehicle.metadata || {};

        const renderField = (label, value, isCode = false, copyId = null) => {
          const strVal = value !== undefined && value !== null && value !== '' ? String(value) : '-';
          const matches = !drawerSearch ||
            label.toLowerCase().includes(drawerSearch.toLowerCase()) ||
            strVal.toLowerCase().includes(drawerSearch.toLowerCase());
          if (!matches) return null;

          return (
            <div
              key={label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                gap: '12px'
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>{label}</span>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', maxWidth: '65%' }}>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: strVal === '-' ? '#94a3b8' : '#0f172a',
                  fontFamily: isCode ? 'monospace' : 'inherit',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textAlign: 'right'
                }}>
                  {strVal}
                </span>
                {copyId && strVal !== '-' && (
                  <button
                    type="button"
                    onClick={() => handleCopy(strVal, copyId)}
                    title="Copy to clipboard"
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px', color: copiedKey === copyId ? '#16a34a' : '#94a3b8' }}
                  >
                    {copiedKey === copyId ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                )}
              </div>
            </div>
          );
        };

        const renderSection = (title, icon, fields) => {
          const renderedFields = fields.filter(Boolean);
          if (renderedFields.length === 0) return null;

          return (
            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{
                padding: '10px 14px',
                background: '#f1f5f9',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                fontWeight: 800,
                color: '#1e293b',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                {icon}
                <span>{title}</span>
                <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#64748b', fontWeight: 600, background: '#ffffff', padding: '1px 6px', borderRadius: '4px' }}>
                  {renderedFields.length} fields
                </span>
              </div>
              <div style={{ padding: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '8px' }}>
                {renderedFields}
              </div>
            </div>
          );
        };

        // Extra metadata items not explicitly handled above
        const standardMetaKeys = new Set([
          'licenceId', 'vehicleId', 'registrationNo', 'vehicleTypeSelect', 'vehicleModel', 'deviceModel',
          'vlttdSlno', 'vltdSlno', 'iccid', 'sim1', 'sim2', 'simNo', 'sim', 'telecomOperator',
          'installationDate', 'onboardDate', 'onboardingDate', 'installedDate', 'madeIn', 'mfgDate',
          'chassisNo', 'engineNo', 'rtoLocation', 'location', 'serviceEngineer', 'serviceEngineerPhone',
          'salesman', 'salesmanPhone', 'ticketId', 'sensorNo', 'vehicleVoltage', 'batteryVoltage',
          'engineOnStatus', 'engineOn', 'ownerName', 'ownerPhone', 'customerName', 'customerPhone',
          'aadharNo', 'panNo', 'email', 'username', 'password', 'fuelType', 'tankSize', 'fuelEmptyAdc',
          'fuelFullAdc', 'expectedMileage', 'deviceOdo', 'assetTrack', 'safetyPark', 'rigMode', 'acToggle',
          'externalDevice', 'secondaryEngine', 'odometerReading', 'odoDistance', 'overSpeedLimit',
          'overspeedDurationAlert', 'idleDurationAlert', 'enableDebugs', 'ipAddress', 'portNo', 'lowBattery',
          'serverName', 'timezone', 'lastCommTime', 'plan_duration_months', 'odometerSnapshot'
        ]);

        const extraMetaEntries = Object.entries(meta).filter(([k, v]) => !standardMetaKeys.has(k) && typeof v !== 'object');

        return (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.5)',
              backdropFilter: 'blur(3px)',
              zIndex: 9999,
              display: 'flex',
              justifyContent: 'flex-end',
              animation: 'fadeIn 0.2s ease-in-out'
            }}
            onClick={() => setViewingVehicle(null)}
          >
            <div
              style={{
                width: '740px',
                maxWidth: '96vw',
                height: '100%',
                background: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '-8px 0 30px rgba(0,0,0,0.25)',
                animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                overflow: 'hidden'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drawer Top Header */}
              <div style={{
                padding: '16px 20px',
                background: '#1e1b4b',
                color: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#f97316'
                  }}>
                    <Truck size={22} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                        {viewingVehicle.name || viewingVehicle.plate || 'Vehicle Details'}
                      </h2>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 800,
                        background: viewingVehicle.is_online ? '#10b981' : '#64748b',
                        color: '#ffffff',
                        textTransform: 'uppercase'
                      }}>
                        {viewingVehicle.is_online ? 'LIVE ONLINE' : 'OFFLINE'}
                      </span>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 700,
                        background: 'rgba(255, 255, 255, 0.15)',
                        color: '#e2e8f0'
                      }}>
                        {viewingVehicle.category || 'General'}
                      </span>
                    </div>
                    <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#cbd5e1', fontFamily: 'monospace' }}>
                      ID: {meta.vehicleId || viewingVehicle.plate || viewingVehicle.imei || '-'}
                    </p>
                  </div>
                </div>

                {/* Header Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => navigate(`/vehicles/${viewingVehicle.id}`)}
                    title="Open Live Tracking Monitor"
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                  >
                    <Eye size={14} /> Monitor
                  </button>
                  <button
                    onClick={() => navigate(`/admin/vehicles/edit/${viewingVehicle.id}`)}
                    title="Edit Full Vehicle Details"
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      background: '#ea580c',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#c2410c'}
                    onMouseLeave={e => e.currentTarget.style.background = '#ea580c'}
                  >
                    <Edit2 size={14} /> Edit
                  </button>
                  <button
                    onClick={() => setViewingVehicle(null)}
                    title="Close details"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                      transition: 'color 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ffffff'}
                    onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Sub-header Filter Search Bar */}
              <div style={{
                padding: '10px 20px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Search size={14} color="#64748b" />
                <input
                  type="text"
                  value={drawerSearch}
                  onChange={(e) => setDrawerSearch(e.target.value)}
                  placeholder="Filter through all vehicle fields (e.g. pan, sim, chassis, voltage, battery, mileage)..."
                  style={{
                    flex: 1,
                    border: 'none',
                    background: 'transparent',
                    fontSize: '12px',
                    outline: 'none',
                    color: '#0f172a'
                  }}
                />
                {drawerSearch && (
                  <button
                    onClick={() => setDrawerSearch('')}
                    style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Drawer Content Body: All Fields Organized */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                background: '#f8fafc'
              }}>
                {/* 1. Asset & Registration Details */}
                {renderSection('1. Asset & Registration Information', <Truck size={15} color="#ea580c" />, [
                  renderField('Licence ID', viewingVehicle.licenceId || meta.licenceId || viewingVehicle.licence_no, true, 'licenceId'),
                  renderField('Vehicle ID', meta.vehicleId || viewingVehicle.plate, false, 'vehicleId'),
                  renderField('Vehicle Name', viewingVehicle.name, false, 'name'),
                  renderField('Registration (Plate)', viewingVehicle.plate || meta.registrationNo, true, 'plate'),
                  renderField('Vehicle Type', viewingVehicle.model || meta.vehicleTypeSelect),
                  renderField('Vehicle Model / Make', viewingVehicle.make || meta.vehicleModel),
                  renderField('Organization Name', viewingVehicle.org_name || user?.org_name),
                  renderField('Category', viewingVehicle.category || 'General'),
                  renderField('Assigned Groups', viewingVehicle.group_name || 'Unassigned'),
                  renderField('Sand Mining', viewingVehicle.is_sand_mining ? 'Enabled' : 'Disabled')
                ])}

                {/* 2. Device & Hardware Telemetry */}
                {renderSection('2. Device & Telemetry Hardware', <Cpu size={15} color="#3b82f6" />, [
                  renderField('Device ID (IMEI)', viewingVehicle.imei || viewingVehicle.device_id, true, 'imei'),
                  renderField('Device Type / Version', viewingVehicle.device_version || meta.deviceModel || viewingVehicle.deviceType || viewingVehicle.model),
                  renderField('VLTD Serial No (SLNO)', meta.vlttdSlno || meta.vltdSlno, true, 'vltdSlno'),
                  renderField('GPS SIM 1 (Sim No)', viewingVehicle.gps_sim_no || meta.sim1 || meta.simNo || meta.sim, true, 'sim1'),
                  renderField('SIM 2', meta.sim2, true, 'sim2'),
                  renderField('ICCID', meta.iccid, true, 'iccid'),
                  renderField('Telecom Operator', meta.telecomOperator),
                  renderField('Server Name', viewingVehicle.server_name || meta.serverName || 'Voltsys'),
                  renderField('Server IP & Port', meta.ipAddress && meta.portNo ? `${meta.ipAddress}:${meta.portNo}` : (meta.ipAddress || meta.portNo || '-')),
                  renderField('APN', viewingVehicle.apn),
                  renderField('Timezone', viewingVehicle.timezone || meta.timezone || 'IST'),
                  renderField('Sensor No', meta.sensorNo, true, 'sensorNo')
                ])}

                {/* 3. Live Telemetry & Engine State */}
                {renderSection('3. Telemetry & Engine State', <Activity size={15} color="#10b981" />, [
                  renderField('Communication Status', viewingVehicle.is_online ? 'Live / Online' : 'Offline / Sleep'),
                  renderField('Last Comm Time', viewingVehicle.last_seen ? formatLocalTime(viewingVehicle.last_seen) : (viewingVehicle.last_comm_time || meta.lastCommTime || '-')),
                  renderField('Ignition State', viewingVehicle.current_ignition !== undefined ? (viewingVehicle.current_ignition ? 'ON' : 'OFF') : (meta.engineOnStatus || meta.engineOn || '-')),
                  renderField('Current Speed', viewingVehicle.current_speed !== undefined ? `${viewingVehicle.current_speed} km/h` : '0 km/h'),
                  renderField('Current Odometer', viewingVehicle.current_odometer !== undefined ? `${Number(viewingVehicle.current_odometer).toLocaleString()} km` : (meta.odometerReading ? `${meta.odometerReading} km` : '-')),
                  renderField('Today Travel Distance', viewingVehicle.today_distance !== undefined ? `${Number(viewingVehicle.today_distance).toFixed(1)} km` : '0 km'),
                  renderField('Vehicle Voltage', viewingVehicle.current_voltage ? `${viewingVehicle.current_voltage} V` : (meta.vehicleVoltage ? `${meta.vehicleVoltage} V` : '-')),
                  renderField('Battery Voltage', viewingVehicle.current_battery ? `${viewingVehicle.current_battery} V` : (meta.batteryVoltage ? `${meta.batteryVoltage} V` : '-')),
                  renderField('GPS Coordinates', viewingVehicle.lat && viewingVehicle.lng ? `${Number(viewingVehicle.lat).toFixed(6)}, ${Number(viewingVehicle.lng).toFixed(6)}` : '-'),
                  renderField('Chassis No', meta.chassisNo, true, 'chassisNo'),
                  renderField('Engine No', meta.engineNo, true, 'engineNo'),
                  renderField('Secondary Engine', meta.secondaryEngine)
                ])}

                {/* 4. Dates & Lifespan */}
                {renderSection('4. Lifespan & Validity Dates', <Calendar size={15} color="#8b5cf6" />, [
                  renderField('Onboard Date', meta.onboardingDate || meta.onboardDate || (viewingVehicle.created_at ? formatLocalDate(viewingVehicle.created_at) : '-')),
                  renderField('Licence Issued Date', viewingVehicle.licence_issued_date || meta.licenceIssuedDate || meta.installedDate || meta.installationDate ? formatLocalDate(viewingVehicle.licence_issued_date || meta.licenceIssuedDate || meta.installedDate || meta.installationDate) : '-'),
                  renderField('Licence Expire Date', viewingVehicle.licence_expire_date || meta.licenceExpireDate || meta.expiryDate ? formatLocalDate(viewingVehicle.licence_expire_date || meta.licenceExpireDate || meta.expiryDate) : '-'),
                  renderField('Manufacturing Date (Mfg)', meta.mfgDate ? formatLocalDate(meta.mfgDate) : meta.mfgDate),
                  renderField('Made In', meta.madeIn || 'India')
                ])}

                {/* 5. Owner KYC & User Account */}
                {renderSection('5. Owner KYC & Account', <User size={15} color="#0284c7" />, [
                  renderField('Owner / Customer Name', meta.ownerName || meta.customerName || viewingVehicle.driver_name),
                  renderField('Owner Mobile / Phone', meta.ownerPhone || meta.customerPhone || viewingVehicle.driver_phone, true, 'ownerPhone'),
                  renderField('Email Address', meta.email),
                  renderField('System Username', meta.username || viewingVehicle.username),
                  renderField('RTO Location', meta.rtoLocation || meta.location),
                  renderField('Aadhar Number', meta.aadharNo, true, 'aadharNo'),
                  renderField('PAN Number', meta.panNo, true, 'panNo')
                ])}

                {/* 6. Personnel & Field Support */}
                {renderSection('6. Field Support & Personnel', <Users2 size={15} color="#d97706" />, [
                  renderField('Service Engineer', meta.serviceEngineer ? `${meta.serviceEngineer} (${meta.serviceEngineerPhone || 'No Phone'})` : '-'),
                  renderField('Salesman', meta.salesman ? `${meta.salesman} (${meta.salesmanPhone || 'No Phone'})` : '-'),
                  renderField('Ticket ID', meta.ticketId, true, 'ticketId')
                ])}

                {/* 7. Fuel & Threshold Settings */}
                {renderSection('7. Fuel & Calibration Settings', <Fuel size={15} color="#16a34a" />, [
                  renderField('Fuel Type', meta.fuelType),
                  renderField('Tank Capacity', meta.tankSize ? `${meta.tankSize} L` : '-'),
                  renderField('Expected Mileage', meta.expectedMileage ? `${meta.expectedMileage} km/L` : '-'),
                  renderField('Fuel Calibration ADC', meta.fuelEmptyAdc || meta.fuelFullAdc ? `Empty: ${meta.fuelEmptyAdc || '0'} | Full: ${meta.fuelFullAdc || '0'}` : '-'),
                  renderField('Over Speed Limit', meta.overSpeedLimit ? `${meta.overSpeedLimit} km/h` : '-'),
                  renderField('Overspeed Duration Alert', meta.overspeedDurationAlert ? `${meta.overspeedDurationAlert} s` : '-'),
                  renderField('Idle Duration Alert', meta.idleDurationAlert ? `${meta.idleDurationAlert} min` : '-'),
                  renderField('Low Battery Alert Threshold', meta.lowBattery ? `${meta.lowBattery} V` : '-')
                ])}

                {/* 8. Feature Toggles */}
                {renderSection('8. Feature Flags & Toggles', <Settings size={15} color="#475569" />, [
                  renderField('Device ODO', meta.deviceOdo || 'NO'),
                  renderField('Asset Tracking', meta.assetTrack || 'NO'),
                  renderField('Safety Park', meta.safetyPark || 'NO'),
                  renderField('RIG Mode', meta.rigMode || 'NO'),
                  renderField('AC Toggle', meta.acToggle || 'NO'),
                  renderField('External Device', meta.externalDevice || 'NO')
                ])}

                {/* 9. Additional Custom Metadata Attributes (if any) */}
                {extraMetaEntries.length > 0 && renderSection('9. Additional Custom Attributes', <FileText size={15} color="#64748b" />,
                  extraMetaEntries.map(([k, val]) => renderField(k, String(val)))
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Bulk Excel Upload Modal */}
      {isExcelModalOpen && (
        <ExcelBulkUploadModal
          isOpen={isExcelModalOpen}
          onClose={() => setIsExcelModalOpen(false)}
          onSuccess={fetchVehicles}
          currentOrgId={user?.org_id}
        />
      )}

      {/* Google Form Link & Integration Modal */}
      <GoogleFormModal
        isOpen={isGoogleFormModalOpen}
        onClose={() => setIsGoogleFormModalOpen(false)}
      />
    </div>
  );
};

export default VehiclesAdminPage;
