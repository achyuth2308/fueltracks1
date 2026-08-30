import React, { useState, useEffect } from 'react';
import { formatLocalDate, formatLocalTime } from '../../utils/dateUtils';
import { useNavigate } from 'react-router-dom';
import {
  Truck, Plus, Edit2, Trash2, Loader2, AlertTriangle, Search, Eye,
  Server, MapPin, CheckCircle, ChevronRight, X, Building2, Users2,
  Activity, FileSpreadsheet, Download, Layers, CheckSquare, Square,
  Filter, Tag
} from 'lucide-react';
import * as vehicleApi from '../../api/vehicleApi';
import * as adminApi from '../../api/adminApi';
import { useAuth } from '../../hooks/useAuth';
import ExcelBulkUploadModal from '../../components/ExcelBulkUploadModal';
import BulkAssignGroupsModal from '../../components/BulkAssignGroupsModal';
import { generateVehicleOnboardingTemplate } from '../../utils/excelTemplateGenerator';

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

const CATEGORIES = ['All', 'TG Mining', 'VLTD', 'VLTD + Mining', 'General'];

const VehiclesAdminPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
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

  // Details Panel State
  const [viewingVehicle, setViewingVehicle] = useState(null);

  // Selection & Modals
  const [selectedVehicleIds, setSelectedVehicleIds] = useState([]);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isBulkGroupModalOpen, setIsBulkGroupModalOpen] = useState(false);

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

  useEffect(() => {
    if (isSuperAdmin || user?.role === 'dealer') {
      adminApi.getOrgs().then(res => { if (res.success) setOrgs(res.data); }).catch(() => {});
      adminApi.getGroups().then(res => { if (res.success) setGroups(res.data); }).catch(() => {});
    }
  }, [user, isSuperAdmin]);

  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    if (window.confirm('Are you sure you want to remove this vehicle from the registry?')) {
      try {
        const res = await vehicleApi.deleteVehicle(id);
        if (res.success) {
          if (viewingVehicle?.id === id) setViewingVehicle(null);
          setSelectedVehicleIds(prev => prev.filter(vId => vId !== id));
          fetchVehicles();
        }
      } catch (err) {
        alert(err.response?.data?.error || 'Delete failed.');
      }
    }
  };

  const toggleSelectVehicle = (id, e) => {
    if (e) e.stopPropagation();
    setSelectedVehicleIds(prev =>
      prev.includes(id) ? prev.filter(vId => vId !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedVehicleIds.length === filtered.length) {
      setSelectedVehicleIds([]);
    } else {
      setSelectedVehicleIds(filtered.map(v => v.id));
    }
  };

  const filtered = vehicles.filter(v => {
    const q = searchQuery.toLowerCase();
    const meta = v.metadata || {};
    return (
      v.name?.toLowerCase().includes(q) ||
      v.plate?.toLowerCase().includes(q) ||
      v.imei?.toLowerCase().includes(q) ||
      v.group_name?.toLowerCase().includes(q) ||
      v.gps_sim_no?.toLowerCase().includes(q) ||
      meta.vlttdSlno?.toLowerCase().includes(q) ||
      meta.ownerName?.toLowerCase().includes(q) ||
      meta.ownerPhone?.toLowerCase().includes(q) ||
      meta.aadharNo?.toLowerCase().includes(q) ||
      meta.panNo?.toLowerCase().includes(q) ||
      meta.rtoLocation?.toLowerCase().includes(q) ||
      meta.salesman?.toLowerCase().includes(q) ||
      meta.serviceEngineer?.toLowerCase().includes(q) ||
      meta.sensorNo?.toLowerCase().includes(q) ||
      meta.sim2?.toLowerCase().includes(q) ||
      meta.iccid?.toLowerCase().includes(q) ||
      meta.username?.toLowerCase().includes(q)
    );
  });

  const selectedVehiclesList = vehicles.filter(v => selectedVehicleIds.includes(v.id));

  // Category counts
  const categoryCounts = vehicles.reduce((acc, v) => {
    const cat = v.category || 'General';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ background: '#EEF5F8', minHeight: '100%', padding: '32px', boxSizing: 'border-box' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748B', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
            <span>Fleet Management</span>
            <ChevronRight size={14} />
            <span style={{ color: '#f97316' }}>Vehicle Assets</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.02em' }}>
            Vehicle Assets Registry
          </h1>
          <p style={{ fontSize: '14px', color: '#6B7280', margin: '4px 0 0 0' }}>
            Manage fleet assets, telemetry hardware mapping, and full device configuration.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
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
      <div className="flex flex-wrap items-center gap-2 mb-6 p-1.5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
        {CATEGORIES.map(cat => {
          const count = cat === 'All' ? vehicles.length : (categoryCounts[cat] || 0);
          const isSelected = selectedCategory === cat;

          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isSelected
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span>{cat}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                isSelected ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter Toolbar */}
      <div style={{
        background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0',
        padding: '16px 20px', marginBottom: '24px', display: 'flex', gap: '16px',
        alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap',
        boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
      }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1, minWidth: '280px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} color="#94A3B8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search by Vehicle Name, Plate, IMEI, Owner, Group, SIM..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px 10px 42px', borderRadius: '10px',
                border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none',
                background: '#F8FAFC', color: '#0F172A', boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Org Filter (for Superadmin/Dealer) */}
          {(isSuperAdmin || user?.role === 'dealer') && orgs.length > 0 && (
            <select
              value={selectedOrgId}
              onChange={e => setSelectedOrgId(e.target.value)}
              style={{
                padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1',
                fontSize: '13px', background: '#F8FAFC', color: '#0F172A', outline: 'none', cursor: 'pointer'
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
                padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1',
                fontSize: '13px', background: '#F8FAFC', color: '#0F172A', outline: 'none', cursor: 'pointer'
              }}
            >
              <option value="all">All Groups</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
        </div>

        {/* Selection Actions */}
        {selectedVehicleIds.length > 0 && (
          <div className="flex items-center gap-3 bg-orange-50 px-4 py-2 rounded-xl border border-orange-200">
            <span className="text-xs font-bold text-orange-950">
              {selectedVehicleIds.length} vehicle{selectedVehicleIds.length !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => setIsBulkGroupModalOpen(true)}
              className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
            >
              <Layers size={14} /> Bulk Assign Groups
            </button>
            <button
              onClick={() => setSelectedVehicleIds([])}
              className="text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer underline"
            >
              Deselect
            </button>
          </div>
        )}
      </div>

      {/* Main Content Layout */}
      <div style={{ display: 'flex', gap: '24px', alignItems: 'stretch' }}>
        
        {/* Table Container */}
        <div style={{
          flex: 1, background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0',
          boxShadow: '0 4px 6px rgba(0,0,0,0.02)', overflow: 'hidden', display: 'flex', flexDirection: 'column'
        }}>
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
            <div style={{ overflow: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#FAFAFA', zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #E2E8F0', fontSize: '11px', textTransform: 'uppercase', color: '#64748B', fontWeight: 700, letterSpacing: '0.05em' }}>
                    <th style={{ padding: '14px 12px', width: '40px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedVehicleIds.length === filtered.length && filtered.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                      />
                    </th>
                    <th style={{ padding: '14px 12px', width: '50px', textAlign: 'center' }}>Sl.No</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center' }}>Action</th>
                    <th style={{ padding: '14px 16px' }}>LicenceId</th>
                    <th style={{ padding: '14px 16px' }}>Device Type</th>
                    <th style={{ padding: '14px 16px' }}>Device ID(IMEI)</th>
                    <th style={{ padding: '14px 16px' }}>ICCID</th>
                    <th style={{ padding: '14px 16px' }}>VLTD SLNO</th>
                    <th style={{ padding: '14px 16px' }}>Vehicle Id</th>
                    <th style={{ padding: '14px 16px' }}>Vehicle Name</th>
                    <th style={{ padding: '14px 16px' }}>Registration Number</th>
                    <th style={{ padding: '14px 16px' }}>Vehicle Type</th>
                    <th style={{ padding: '14px 16px' }}>Chassis Number</th>
                    <th style={{ padding: '14px 16px' }}>GPS SIM Number 1</th>
                    <th style={{ padding: '14px 16px' }}>GPS SIM Number 2</th>
                    <th style={{ padding: '14px 16px' }}>Odometer</th>
                    <th style={{ padding: '14px 16px' }}>Vehicle Voltage</th>
                    <th style={{ padding: '14px 16px' }}>Ignition ON Status</th>
                    <th style={{ padding: '14px 16px' }}>Sensor Number</th>
                    <th style={{ padding: '14px 16px' }}>Service Engineer Number</th>
                    <th style={{ padding: '14px 16px' }}>Service Mobile Number</th>
                    <th style={{ padding: '14px 16px' }}>Salesman</th>
                    <th style={{ padding: '14px 16px' }}>Salesman Mobile Number</th>
                    <th style={{ padding: '14px 16px' }}>Installation Date</th>
                    <th style={{ padding: '14px 16px' }}>Onboarding Date</th>
                    <th style={{ padding: '14px 16px' }}>Owner Name</th>
                    <th style={{ padding: '14px 16px' }}>Owner Mobile Number</th>
                    <th style={{ padding: '14px 16px' }}>Owner Email ID</th>
                    <th style={{ padding: '14px 16px' }}>Owner Location</th>
                    <th style={{ padding: '14px 16px' }}>Owner Aadhar ID</th>
                    <th style={{ padding: '14px 16px' }}>Owner Pancard Number</th>
                    <th style={{ padding: '14px 16px' }}>Username</th>
                    <th style={{ padding: '14px 16px' }}>Password</th>
                    <th style={{ padding: '14px 16px' }}>Group</th>
                    <th style={{ padding: '14px 16px' }}>Category</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v, idx) => {
                    const isSelected = selectedVehicleIds.includes(v.id);
                    const meta = v.metadata || {};

                    return (
                      <tr
                        key={v.id}
                        onClick={() => setViewingVehicle(v)}
                        style={{
                          borderBottom: '1px solid #F1F5F9', cursor: 'pointer',
                          background: isSelected ? '#fff7ed' : (viewingVehicle?.id === v.id ? '#f0f9ff' : 'transparent'),
                          transition: 'background 0.2s',
                          whiteSpace: 'nowrap'
                        }}
                        onMouseEnter={e => { if (viewingVehicle?.id !== v.id && !isSelected) e.currentTarget.style.background = '#F8FAFC'; }}
                        onMouseLeave={e => { if (viewingVehicle?.id !== v.id && !isSelected) e.currentTarget.style.background = 'transparent'; }}
                      >
                        {/* Checkbox */}
                        <td style={{ padding: '14px 12px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => toggleSelectVehicle(v.id, e)}
                            className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                          />
                        </td>

                        {/* 1. Sl.No */}
                        <td style={{ padding: '14px 12px', textAlign: 'center', fontSize: '13px', fontWeight: 700, color: '#64748B' }}>
                          {idx + 1}
                        </td>

                        {/* 2. Action (View / Edit / Delete buttons right after Sl.No!) */}
                        <td style={{ padding: '14px 16px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              onClick={() => setViewingVehicle(v)}
                              title="View Quick Details"
                              style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              onClick={() => navigate(`/admin/vehicles/edit/${v.id}`)}
                              title="Edit Vehicle Details"
                              style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={(e) => handleDelete(v.id, e)}
                              title="Delete Vehicle"
                              style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#FEF2F2', border: '1px solid #FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>

                        {/* 3. LicenceId */}
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569', fontFamily: 'monospace' }}>
                          {meta.licenceId || v.licence_no || '-'}
                        </td>

                        {/* 4. Device Type */}
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#111827', fontWeight: 600 }}>
                          {v.model || meta.deviceModel || 'AIS140'}
                        </td>

                        {/* 5. Device ID(IMEI) */}
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#111827', fontWeight: 700, fontFamily: 'monospace' }}>
                          {v.imei || '-'}
                        </td>

                        {/* 6. ICCID */}
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748B', fontFamily: 'monospace' }}>
                          {meta.iccid || '-'}
                        </td>

                        {/* 7. VLTD SLNO */}
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748B', fontFamily: 'monospace' }}>
                          {meta.vlttdSlno || meta.vltdSlno || '-'}
                        </td>

                        {/* 8. Vehicle Id */}
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#111827', fontWeight: 600 }}>
                          {meta.vehicleId || v.plate || '-'}
                        </td>

                        {/* 9. Vehicle Name */}
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#111827', fontWeight: 700 }}>
                          {v.name || '-'}
                        </td>

                        {/* 10. Registration Number */}
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#111827', fontWeight: 700 }}>
                          {v.plate || meta.registrationNo || '-'}
                        </td>

                        {/* 11. Vehicle Type */}
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569' }}>
                          {meta.vehicleTypeSelect || v.vehicle_type || 'Truck'}
                        </td>

                        {/* 12. Chassis Number */}
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748B', fontFamily: 'monospace' }}>
                          {meta.chassisNo || '-'}
                        </td>

                        {/* 13. GPS SIM Number 1 */}
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569', fontFamily: 'monospace' }}>
                          {v.gps_sim_no || meta.sim1 || '-'}
                        </td>

                        {/* 14. GPS SIM Number 2 */}
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569', fontFamily: 'monospace' }}>
                          {meta.sim2 || '-'}
                        </td>

                        {/* 15. Odometer */}
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#111827', fontWeight: 600 }}>
                          {meta.odoDistance ? `${meta.odoDistance} km` : '0 km'}
                        </td>

                        {/* 16. Vehicle Voltage */}
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569' }}>
                          {meta.vehicleVoltage || meta.batteryVoltage || '12V'}
                        </td>

                        {/* 17. Ignition ON Status */}
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569' }}>
                          {meta.engineOnStatus || meta.engineOn || 'Voltage+Ignition'}
                        </td>

                        {/* 18. Sensor Number */}
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748B' }}>
                          {meta.sensorNo || '-'}
                        </td>

                        {/* 19. Service Engineer Number */}
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569' }}>
                          {meta.serviceEngineer || '-'}
                        </td>

                        {/* 20. Service Mobile Number */}
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569', fontFamily: 'monospace' }}>
                          {meta.serviceEngineerPhone || '-'}
                        </td>

                        {/* 21. Salesman */}
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569' }}>
                          {meta.salesman || '-'}
                        </td>

                        {/* 22. Salesman Mobile Number */}
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569', fontFamily: 'monospace' }}>
                          {meta.salesmanPhone || '-'}
                        </td>

                        {/* 23. Installation Date */}
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748B' }}>
                          {meta.installationDate || meta.installedDate || '-'}
                        </td>

                        {/* 24. Onboarding Date */}
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748B' }}>
                          {meta.onboardingDate || meta.onboardDate || (v.created_at ? formatLocalDate(v.created_at) : '-')}
                        </td>

                        {/* 25. Owner Name */}
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#111827', fontWeight: 600 }}>
                          {meta.ownerName || meta.customerName || v.driver_name || '-'}
                        </td>

                        {/* 26. Owner Mobile Number */}
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569', fontFamily: 'monospace' }}>
                          {meta.ownerPhone || meta.customerPhone || v.driver_phone || '-'}
                        </td>

                        {/* 27. Owner Email ID */}
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569' }}>
                          {meta.email || '-'}
                        </td>

                        {/* 28. Owner Location */}
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569' }}>
                          {meta.rtoLocation || '-'}
                        </td>

                        {/* 29. Owner Aadhar ID */}
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748B', fontFamily: 'monospace' }}>
                          {meta.aadharNo || '-'}
                        </td>

                        {/* 30. Owner Pancard Number */}
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748B', fontFamily: 'monospace' }}>
                          {meta.panNo || '-'}
                        </td>

                        {/* 31. Username */}
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569', fontWeight: 600 }}>
                          {meta.username || '-'}
                        </td>

                        {/* 32. Password */}
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#94A3B8', fontFamily: 'monospace' }}>
                          {meta.password ? '••••••••' : '-'}
                        </td>

                        {/* 33. Group */}
                        <td style={{ padding: '14px 16px' }}>
                          {v.group_name ? (
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {v.group_name.split(',').map((g, i) => (
                                <span key={i} className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded text-[10px] font-semibold">
                                  {g.trim()}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs italic">Unassigned</span>
                          )}
                        </td>

                        {/* 34. Category Badge */}
                        <td style={{ padding: '14px 16px' }}>
                          <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                            v.category === 'TG Mining' ? 'bg-amber-100 text-amber-900 border border-amber-200' :
                            v.category === 'VLTD' ? 'bg-blue-100 text-blue-900 border border-blue-200' :
                            v.category === 'VLTD + Mining' ? 'bg-purple-100 text-purple-900 border border-purple-200' :
                            'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {v.category || 'General'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Side: Details Panel */}
        {viewingVehicle && (
          <div style={{
            width: '380px', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0',
            boxShadow: '0 4px 6px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column',
            overflow: 'hidden', animation: 'fadeInRight 0.3s ease'
          }}>
            {/* Details Header */}
            <div style={{ padding: '20px', borderBottom: '1px solid #F1F5F9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{
                  width: '52px', height: '52px', borderRadius: '14px', background: '#EEF5F8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px'
                }}>
                  <Truck size={26} color="#f97316" />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ padding: '4px 10px', borderRadius: '8px', background: viewingVehicle.is_online ? '#D1FAE5' : '#F1F5F9', color: viewingVehicle.is_online ? '#059669' : '#64748B', fontSize: '11px', fontWeight: 700 }}>
                    {viewingVehicle.is_online ? 'LIVE' : 'OFFLINE'}
                  </div>
                  <button
                    onClick={() => setViewingVehicle(null)}
                    style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', transition: 'background 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F1F5F9'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-1">
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#111827' }}>{viewingVehicle.name}</h2>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  viewingVehicle.category === 'TG Mining' ? 'bg-amber-100 text-amber-900' :
                  viewingVehicle.category === 'VLTD' ? 'bg-blue-100 text-blue-900' :
                  viewingVehicle.category === 'VLTD + Mining' ? 'bg-purple-100 text-purple-900' :
                  'bg-slate-100 text-slate-700'
                }`}>
                  {viewingVehicle.category || 'General'}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#6B7280', fontFamily: 'monospace' }}>{viewingVehicle.plate || viewingVehicle.name}</p>

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button onClick={(e) => { e.stopPropagation(); navigate(`/vehicles/${viewingVehicle.id}`); }} style={{ flex: 1, padding: '8px', borderRadius: '8px', background: '#EEF5F8', border: '1px solid #e0f2fe', color: '#f97316', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}>
                  <Eye size={14} /> Monitor
                </button>
                <button onClick={(e) => { e.stopPropagation(); navigate(`/admin/vehicles/edit/${viewingVehicle.id}`); }} style={{ padding: '8px 12px', borderRadius: '8px', background: '#EEF5F8', border: '1px solid #E2E8F0', color: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Edit2 size={14} />
                </button>
                <button onClick={(e) => handleDelete(viewingVehicle.id, e)} style={{ padding: '8px 12px', borderRadius: '8px', background: '#FEF2F2', border: '1px solid #FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Details Content */}
            <div style={{ padding: '20px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Assigned Groups */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>Assigned Groups</div>
                {viewingVehicle.group_name ? (
                  <div className="flex flex-wrap gap-1.5">
                    {viewingVehicle.group_name.split(',').map((g, i) => (
                      <span key={i} className="px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-800 rounded-md text-xs font-bold">
                        {g.trim()}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-400 text-xs italic">Unassigned</span>
                )}
              </div>

              {/* Hardware Specs */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>Hardware Specs</div>
                <div style={{ background: '#F8FAFC', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Device Type:</span>
                    <span style={{ fontWeight: 600, color: '#0F172A' }}>{viewingVehicle.model || viewingVehicle.metadata?.deviceModel || 'AIS140'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>IMEI Number:</span>
                    <span style={{ fontWeight: 600, color: '#0F172A', fontFamily: 'monospace' }}>{viewingVehicle.imei || '-'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>VLTD SLNO:</span>
                    <span style={{ fontWeight: 600, color: '#0F172A', fontFamily: 'monospace' }}>{viewingVehicle.metadata?.vlttdSlno || viewingVehicle.metadata?.vltdSlno || '-'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>SIM 1:</span>
                    <span style={{ fontWeight: 600, color: '#0F172A', fontFamily: 'monospace' }}>{viewingVehicle.gps_sim_no || viewingVehicle.metadata?.sim1 || '-'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>SIM 2:</span>
                    <span style={{ fontWeight: 600, color: '#0F172A', fontFamily: 'monospace' }}>{viewingVehicle.metadata?.sim2 || '-'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>ICCID:</span>
                    <span style={{ fontWeight: 600, color: '#0F172A', fontFamily: 'monospace' }}>{viewingVehicle.metadata?.iccid || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Owner KYC */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>Owner KYC</div>
                <div style={{ background: '#F8FAFC', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Name:</span>
                    <span style={{ fontWeight: 600, color: '#0F172A' }}>{viewingVehicle.metadata?.ownerName || viewingVehicle.metadata?.customerName || viewingVehicle.driver_name || '-'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Mobile:</span>
                    <span style={{ fontWeight: 600, color: '#0F172A', fontFamily: 'monospace' }}>{viewingVehicle.metadata?.ownerPhone || viewingVehicle.metadata?.customerPhone || viewingVehicle.driver_phone || '-'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Location:</span>
                    <span style={{ fontWeight: 600, color: '#0F172A' }}>{viewingVehicle.metadata?.rtoLocation || '-'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Aadhar:</span>
                    <span style={{ fontWeight: 600, color: '#0F172A', fontFamily: 'monospace' }}>{viewingVehicle.metadata?.aadharNo || '-'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>PAN:</span>
                    <span style={{ fontWeight: 600, color: '#0F172A', fontFamily: 'monospace' }}>{viewingVehicle.metadata?.panNo || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Personnel */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>Personnel</div>
                <div style={{ background: '#F8FAFC', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Service Engineer:</span>
                    <span style={{ fontWeight: 600, color: '#0F172A' }}>{viewingVehicle.metadata?.serviceEngineer || '-'} ({viewingVehicle.metadata?.serviceEngineerPhone || 'N/A'})</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Salesman:</span>
                    <span style={{ fontWeight: 600, color: '#0F172A' }}>{viewingVehicle.metadata?.salesman || '-'} ({viewingVehicle.metadata?.salesmanPhone || 'N/A'})</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Bulk Excel Upload Modal */}
      {isExcelModalOpen && (
        <ExcelBulkUploadModal
          isOpen={isExcelModalOpen}
          onClose={() => setIsExcelModalOpen(false)}
          onSuccess={() => {
            setIsExcelModalOpen(false);
            fetchVehicles();
          }}
          currentOrgId={user?.org_id}
        />
      )}

      {/* Bulk Assign Groups Modal */}
      {isBulkGroupModalOpen && (
        <BulkAssignGroupsModal
          isOpen={isBulkGroupModalOpen}
          onClose={() => setIsBulkGroupModalOpen(false)}
          selectedVehicles={selectedVehiclesList}
          groups={groups}
          onSuccess={() => {
            setIsBulkGroupModalOpen(false);
            setSelectedVehicleIds([]);
            fetchVehicles();
          }}
        />
      )}

    </div>
  );
};

export default VehiclesAdminPage;
