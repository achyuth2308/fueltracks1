import React, { useState, useEffect, useMemo } from 'react';
import { formatLocalDate, formatLocalTime } from '../../utils/dateUtils';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Truck, Plus, Edit2, Trash2, Loader2, AlertTriangle, Search,
  Server, MapPin, CheckCircle, ChevronLeft, ChevronRight, Building2,
  Activity, FileSpreadsheet, Download, Layers, CheckSquare, Square,
  Filter, Tag, Globe, ArrowUpDown, ArrowUp, ArrowDown,
  Cpu, Fuel, Settings, FileText,
  Shuffle, UserPlus, Sliders, RotateCw, Award
} from 'lucide-react';
import * as vehicleApi from '../../api/vehicleApi';
import * as adminApi from '../../api/adminApi';
import { useAuth } from '../../hooks/useAuth';
import ExcelBulkUploadModal from '../../components/ExcelBulkUploadModal';
import GoogleFormModal from '../../components/GoogleFormModal';
import { generateVehicleOnboardingTemplate } from '../../utils/excelTemplateGenerator';
import FuelTracksSelect from '../../components/ui/FuelTracksSelect';
import ReprocessModal from '../../components/modals/ReprocessModal';
import LiveFuelModal from '../../components/modals/LiveFuelModal';
import FitmentCertificateModal from '../../components/modals/FitmentCertificateModal';
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


  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isGoogleFormModalOpen, setIsGoogleFormModalOpen] = useState(false);
  const [reprocessingVehicle, setReprocessingVehicle] = useState(null);
  const [liveFuelVehicle, setLiveFuelVehicle] = useState(null);
  const [selectedFitmentVehicle, setSelectedFitmentVehicle] = useState(null);
  const [activeActionDropdownId, setActiveActionDropdownId] = useState(null);
  const [dropdownCoords, setDropdownCoords] = useState(null);

  // Close Action dropdown when clicking anywhere outside or scrolling
  useEffect(() => {
    const handleDismiss = () => {
      setActiveActionDropdownId(null);
      setDropdownCoords(null);
    };
    if (activeActionDropdownId) {
      document.addEventListener('click', handleDismiss);
      window.addEventListener('scroll', handleDismiss, true);
    }
    return () => {
      document.removeEventListener('click', handleDismiss);
      window.removeEventListener('scroll', handleDismiss, true);
    };
  }, [activeActionDropdownId]);


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
            <div style={{ width: '210px' }}>
              <FuelTracksSelect
                height={34}
                value={selectedOrgId}
                onChange={setSelectedOrgId}
                placeholder="All Organizations"
                searchable={true}
                searchPlaceholder="Search Organization..."
                emptyMessage="No organizations found"
                menuStyle={{ minWidth: '220px' }}
                options={[
                  { value: 'all', label: 'All Organizations' },
                  ...orgs.map(o => ({ value: o.id, label: o.name }))
                ]}
              />
            </div>
          )}

          {/* Group Filter */}
          {groups.length > 0 && (
            <div style={{ width: '180px' }}>
              <FuelTracksSelect
                height={34}
                value={selectedGroupId}
                onChange={setSelectedGroupId}
                placeholder="All Groups"
                searchable={true}
                searchPlaceholder="Search Group..."
                emptyMessage="No groups found"
                menuStyle={{ minWidth: '190px' }}
                options={[
                  { value: 'all', label: 'All Groups' },
                  ...groups.map(g => ({ value: g.id, label: g.name }))
                ]}
              />
            </div>
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
                        style={{
                          borderBottom: '1px solid #e0e7ff',
                          height: '40px',
                          background: 'transparent',
                          transition: 'background 0.15s',
                          whiteSpace: 'nowrap'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
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
                        <td style={{ padding: '8px 14px', textAlign: 'center', position: 'relative' }} onClick={e => e.stopPropagation()}>
                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (activeActionDropdownId === v.id) {
                                  setActiveActionDropdownId(null);
                                  setDropdownCoords(null);
                                } else {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const menuHeight = 315;
                                  const menuWidth = 195;
                                  
                                  // Prevent bottom cut-off: if not enough space below, shift upward
                                  const spaceBelow = window.innerHeight - rect.bottom;
                                  let top = rect.top;
                                  if (spaceBelow < menuHeight) {
                                    top = Math.max(10, rect.bottom - menuHeight);
                                  }
                                  
                                  // Position to the left of the button
                                  const left = Math.max(10, rect.left - menuWidth - 8);

                                  setDropdownCoords({ top, left });
                                  setActiveActionDropdownId(v.id);
                                }
                              }}
                              title="Click to choose vehicle action"
                              style={{
                                padding: '6px 14px',
                                borderRadius: '8px',
                                background: '#f97316',
                                border: 'none',
                                color: '#ffffff',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                boxShadow: '0 2px 6px rgba(249, 115, 22, 0.25)'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = '#ea580c';
                                e.currentTarget.style.boxShadow = '0 4px 10px rgba(249, 115, 22, 0.35)';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = '#f97316';
                                e.currentTarget.style.boxShadow = '0 2px 6px rgba(249, 115, 22, 0.25)';
                              }}
                            >
                              <span style={{ fontSize: '10px' }}>◀</span>
                              <span>Actions</span>
                            </button>

                            {/* Dropdown Menu - Fixed positioning escapes table overflow to prevent cut-off */}
                            {activeActionDropdownId === v.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  position: 'fixed',
                                  left: `${dropdownCoords?.left || 0}px`,
                                  top: `${dropdownCoords?.top || 0}px`,
                                  background: '#FFFFFF',
                                  borderRadius: '12px',
                                  padding: '6px',
                                  boxShadow: '0 12px 32px rgba(15, 23, 42, 0.2), 0 4px 10px rgba(15, 23, 42, 0.08)',
                                  zIndex: 999999,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px',
                                  minWidth: '195px',
                                  border: '1px solid #fed7aa',
                                  textAlign: 'left'
                                }}
                              >
                                {/* 1. Migration */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveActionDropdownId(null);
                                    navigate(`/admin/vehicles/migration/${v.id}`);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    width: '100%',
                                    padding: '8px 12px',
                                    background: 'transparent',
                                    color: '#1E293B',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.15s ease',
                                    whiteSpace: 'nowrap'
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.background = '#FFF7ED';
                                    e.currentTarget.style.color = '#EA580C';
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = '#1E293B';
                                  }}
                                >
                                  <div style={{
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: '6px',
                                    background: '#FFF7ED',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#EA580C',
                                    flexShrink: 0
                                  }}>
                                    <Shuffle size={14} />
                                  </div>
                                  <span>Migration</span>
                                </button>

                                {/* 2. Edit */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveActionDropdownId(null);
                                    navigate(`/admin/vehicles/edit/${v.id}`);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    width: '100%',
                                    padding: '8px 12px',
                                    background: 'transparent',
                                    color: '#1E293B',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.15s ease',
                                    whiteSpace: 'nowrap'
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.background = '#FFF7ED';
                                    e.currentTarget.style.color = '#EA580C';
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = '#1E293B';
                                  }}
                                >
                                  <div style={{
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: '6px',
                                    background: '#FFF7ED',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#F97316',
                                    flexShrink: 0
                                  }}>
                                    <Edit2 size={14} />
                                  </div>
                                  <span>Edit</span>
                                </button>

                                {/* 3. Add User */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveActionDropdownId(null);
                                    navigate(`/admin/vehicles/add-user/${v.id}`);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    width: '100%',
                                    padding: '8px 12px',
                                    background: 'transparent',
                                    color: '#1E293B',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.15s ease',
                                    whiteSpace: 'nowrap'
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.background = '#FFF7ED';
                                    e.currentTarget.style.color = '#EA580C';
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = '#1E293B';
                                  }}
                                >
                                  <div style={{
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: '6px',
                                    background: '#FFF7ED',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#EA580C',
                                    flexShrink: 0
                                  }}>
                                    <UserPlus size={14} />
                                  </div>
                                  <span>Add User</span>
                                </button>

                                {/* 4. Calibrate */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveActionDropdownId(null);
                                    navigate(`/admin/vehicles/calibrate/${v.id}`);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    width: '100%',
                                    padding: '8px 12px',
                                    background: 'transparent',
                                    color: '#1E293B',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.15s ease',
                                    whiteSpace: 'nowrap'
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.background = '#FFF7ED';
                                    e.currentTarget.style.color = '#EA580C';
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = '#1E293B';
                                  }}
                                >
                                  <div style={{
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: '6px',
                                    background: '#FFF7ED',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#EA580C',
                                    flexShrink: 0
                                  }}>
                                    <Sliders size={14} />
                                  </div>
                                  <span>Calibrate</span>
                                </button>

                                {/* 4b. Live Fuel */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveActionDropdownId(null);
                                    setLiveFuelVehicle(v);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    width: '100%',
                                    padding: '8px 12px',
                                    background: 'transparent',
                                    color: '#1E293B',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.15s ease',
                                    whiteSpace: 'nowrap'
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.background = '#ECFDF5';
                                    e.currentTarget.style.color = '#059669';
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = '#1E293B';
                                  }}
                                >
                                  <div style={{
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: '6px',
                                    background: '#ECFDF5',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#059669',
                                    flexShrink: 0
                                  }}>
                                    <Fuel size={14} />
                                  </div>
                                  <span>Live Fuel</span>
                                </button>

                                {/* 5. Audit Report */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveActionDropdownId(null);
                                    navigate(`/admin/audit-logs?search=${encodeURIComponent(v.plate || v.name || v.imei || '')}`);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    width: '100%',
                                    padding: '8px 12px',
                                    background: 'transparent',
                                    color: '#1E293B',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.15s ease',
                                    whiteSpace: 'nowrap'
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.background = '#FFF7ED';
                                    e.currentTarget.style.color = '#EA580C';
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = '#1E293B';
                                  }}
                                >
                                  <div style={{
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: '6px',
                                    background: '#FFF7ED',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#EA580C',
                                    flexShrink: 0
                                  }}>
                                    <FileText size={14} />
                                  </div>
                                  <span>Audit Report</span>
                                </button>

                                {/* 5b. Fitment Certificate */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveActionDropdownId(null);
                                    setSelectedFitmentVehicle(v);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    width: '100%',
                                    padding: '8px 12px',
                                    background: 'transparent',
                                    color: '#1E293B',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.15s ease',
                                    whiteSpace: 'nowrap'
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.background = '#EFF6FF';
                                    e.currentTarget.style.color = '#2563EB';
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = '#1E293B';
                                  }}
                                >
                                  <div style={{
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: '6px',
                                    background: '#EFF6FF',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#2563EB',
                                    flexShrink: 0
                                  }}>
                                    <Award size={14} />
                                  </div>
                                  <span>Fitment Certificate</span>
                                </button>

                                {/* 6. Rename */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveActionDropdownId(null);
                                    navigate(`/admin/vehicles/rename/${v.id}`);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    width: '100%',
                                    padding: '8px 12px',
                                    background: 'transparent',
                                    color: '#1E293B',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.15s ease',
                                    whiteSpace: 'nowrap'
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.background = '#FFF7ED';
                                    e.currentTarget.style.color = '#EA580C';
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = '#1E293B';
                                  }}
                                >
                                  <div style={{
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: '6px',
                                    background: '#FFF7ED',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#EA580C',
                                    flexShrink: 0
                                  }}>
                                    <Tag size={14} />
                                  </div>
                                  <span>Rename</span>
                                </button>

                                {/* 7. Reprocess */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveActionDropdownId(null);
                                    setReprocessingVehicle(v);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    width: '100%',
                                    padding: '8px 12px',
                                    background: 'transparent',
                                    color: '#1E293B',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.15s ease',
                                    whiteSpace: 'nowrap'
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.background = '#FFF7ED';
                                    e.currentTarget.style.color = '#EA580C';
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = '#1E293B';
                                  }}
                                >
                                  <div style={{
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: '6px',
                                    background: '#FFF7ED',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#EA580C',
                                    flexShrink: 0
                                  }}>
                                    <RotateCw size={14} />
                                  </div>
                                  <span>Reprocess</span>
                                </button>
                              </div>
                            )}
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

      {/* Reprocess for Vehicle Modal */}
      <ReprocessModal
        isOpen={Boolean(reprocessingVehicle)}
        vehicle={reprocessingVehicle}
        onClose={() => setReprocessingVehicle(null)}
        onSuccess={fetchVehicles}
      />

      {/* On-Demand Live Fuel Telemetry Modal */}
      <LiveFuelModal
        isOpen={Boolean(liveFuelVehicle)}
        vehicleId={liveFuelVehicle?.id}
        vehicleName={liveFuelVehicle?.name}
        plate={liveFuelVehicle?.plate}
        imei={liveFuelVehicle?.imei}
        tankCapacity={parseFloat(liveFuelVehicle?.metadata?.tankSize || liveFuelVehicle?.metadata?.fuelConfig?.tankSize || 100)}
        initialFuel={liveFuelVehicle?.current_fuel}
        initialOdometer={liveFuelVehicle?.current_odometer ?? liveFuelVehicle?.odometer ?? liveFuelVehicle?.metadata?.odometerReading}
        fuelType={liveFuelVehicle?.metadata?.fuelCalibration?.fuelType || liveFuelVehicle?.metadata?.fuelType}
        sensorType={liveFuelVehicle?.metadata?.sensorType}
        onClose={() => setLiveFuelVehicle(null)}
      />

      {/* Fitment & Calibration Certificate Modal */}
      <FitmentCertificateModal
        isOpen={Boolean(selectedFitmentVehicle)}
        vehicle={selectedFitmentVehicle}
        onClose={() => setSelectedFitmentVehicle(null)}
      />
    </div>
  );
};

export default VehiclesAdminPage;
