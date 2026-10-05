import React, { useState, useEffect } from 'react';
import { formatLocalDate, formatLocalTime } from '../../utils/dateUtils';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Truck, Plus, Edit2, Trash2, Loader2, AlertTriangle, Search, Eye,
  Server, MapPin, CheckCircle, ChevronRight, X, Building2, Users2,
  Activity, FileSpreadsheet, Download, Layers, CheckSquare, Square,
  Filter, Tag, Globe
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

  // Details Panel State
  const [viewingVehicle, setViewingVehicle] = useState(null);

  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isGoogleFormModalOpen, setIsGoogleFormModalOpen] = useState(false);

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
            <div style={{ overflow: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', whiteSpace: 'nowrap' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ background: '#1e1b4b' }}>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', width: '50px', textAlign: 'center', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>SL.NO</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', textAlign: 'center', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>ACTION</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>LICENCEID</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>DEVICE TYPE</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>DEVICE ID(IMEI)</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>ICCID</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>VLTD SLNO</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>VEHICLE ID</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>VEHICLE NAME</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>REGISTRATION NUMBER</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>VEHICLE TYPE</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>CHASSIS NUMBER</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>GPS SIM NUMBER 1</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>GPS SIM NUMBER 2</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>ODOMETER</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>VEHICLE VOLTAGE</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>IGNITION ON STATUS</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>SENSOR NUMBER</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>SERVICE ENGINEER NAME</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>SERVICE ENGINEER MOBILE NUMBER</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>SALESMAN</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>SALESMAN MOBILE NUMBER</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>INSTALLATION DATE</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>ONBOARDING DATE</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>OWNER NAME</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>OWNER MOBILE NUMBER</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>OWNER EMAIL ID</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>OWNER LOCATION</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>OWNER AADHAR ID</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>OWNER PANCARD NUMBER</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>USERNAME</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>PASSWORD</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>GROUP</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em' }}>CATEGORY</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v, idx) => {
                    const meta = v.metadata || {};

                    return (
                      <tr
                        key={v.id}
                        onClick={() => setViewingVehicle(v)}
                        style={{
                          borderBottom: '1px solid #e0e7ff', cursor: 'pointer',
                          height: '38px',
                          background: viewingVehicle?.id === v.id ? '#f5f3ff' : 'transparent',
                          transition: 'background 0.15s',
                          whiteSpace: 'nowrap'
                        }}
                        onMouseEnter={e => { if (viewingVehicle?.id !== v.id) e.currentTarget.style.background = '#f5f3ff'; }}
                        onMouseLeave={e => { if (viewingVehicle?.id !== v.id) e.currentTarget.style.background = 'transparent'; }}
                      >
                        {/* 1. Sl.No */}
                        <td style={{ padding: '6px 12px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#64748b', borderRight: '1px solid #e2e8f0' }}>
                          {idx + 1}
                        </td>

                        {/* 2. Action (View / Edit / Delete buttons right after Sl.No!) */}
                        <td style={{ padding: '6px 12px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              onClick={() => setViewingVehicle(v)}
                              title="View Quick Details"
                              style={{ width: '26px', height: '26px', borderRadius: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => navigate(`/admin/vehicles/edit/${v.id}`)}
                              title="Edit Vehicle Details"
                              style={{ width: '26px', height: '26px', borderRadius: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={(e) => handleDelete(v.id, e)}
                              title="Delete Vehicle"
                              style={{ width: '26px', height: '26px', borderRadius: '6px', background: '#fef2f2', border: '1px solid #fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>

                        {/* 3. LicenceId */}
                        <td style={{ padding: '6px 12px', fontSize: '12px', color: '#475569', fontFamily: 'monospace', borderRight: '1px solid #e2e8f0' }}>
                          {v.licenceId || meta.licenceId || v.licence_no || '-'}
                        </td>

                        {/* 4. Device Type */}
                        <td style={{ padding: '6px 12px', fontSize: '12px', color: '#0f172a', fontWeight: 600, borderRight: '1px solid #e2e8f0' }}>
                          {v.deviceType || v.device_version || meta.deviceModel || '-'}
                        </td>

                        {/* 5. Device ID(IMEI) */}
                        <td style={{ padding: '6px 12px', fontSize: '13px', color: '#0f172a', fontWeight: 700, fontFamily: 'monospace', borderRight: '1px solid #e2e8f0' }}>
                          {v.imei || '-'}
                        </td>

                        {/* 6. ICCID */}
                        <td style={{ padding: '6px 12px', fontSize: '12px', color: '#64748b', fontFamily: 'monospace', borderRight: '1px solid #e2e8f0' }}>
                          {meta.iccid || '-'}
                        </td>

                        {/* 7. VLTD SLNO */}
                        <td style={{ padding: '6px 12px', fontSize: '12px', color: '#64748b', fontFamily: 'monospace', borderRight: '1px solid #e2e8f0' }}>
                          {meta.vlttdSlno || meta.vltdSlno || '-'}
                        </td>

                        {/* 8. Vehicle Id */}
                        <td style={{ padding: '6px 12px', fontSize: '12px', color: '#0f172a', fontWeight: 600, borderRight: '1px solid #e2e8f0' }}>
                          {meta.vehicleId || v.plate || '-'}
                        </td>

                        {/* 9. Vehicle Name */}
                        <td style={{ padding: '6px 12px', fontSize: '13px', color: '#0f172a', fontWeight: 700, borderRight: '1px solid #e2e8f0' }}>
                          {v.name || '-'}
                        </td>

                        {/* 10. Registration Number */}
                        <td style={{ padding: '6px 12px', fontSize: '13px', color: '#0f172a', fontWeight: 700, borderRight: '1px solid #e2e8f0' }}>
                          {v.plate || meta.registrationNo || '-'}
                        </td>

                        {/* 11. Vehicle Type */}
                        <td style={{ padding: '6px 12px', fontSize: '12px', color: '#475569', borderRight: '1px solid #e2e8f0' }}>
                          {v.model || meta.vehicleTypeSelect || '-'}
                        </td>

                        {/* 12. Chassis Number */}
                        <td style={{ padding: '6px 12px', fontSize: '12px', color: '#64748b', fontFamily: 'monospace', borderRight: '1px solid #e2e8f0' }}>
                          {meta.chassisNo || '-'}
                        </td>

                        {/* 13. GPS SIM Number 1 */}
                        <td style={{ padding: '6px 12px', fontSize: '12px', color: '#475569', fontFamily: 'monospace', borderRight: '1px solid #e2e8f0' }}>
                          {v.gps_sim_no || meta.sim1 || '-'}
                        </td>

                        {/* 14. GPS SIM Number 2 */}
                        <td style={{ padding: '6px 12px', fontSize: '12px', color: '#475569', fontFamily: 'monospace', borderRight: '1px solid #e2e8f0' }}>
                          {meta.sim2 || '-'}
                        </td>

                        {/* 15. Odometer */}
                        <td style={{ padding: '6px 12px', fontSize: '12px', color: '#0f172a', fontWeight: 600, borderRight: '1px solid #e2e8f0' }}>
                          {meta.odoDistance ? `${meta.odoDistance} km` : '0 km'}
                        </td>

                        {/* 16. Vehicle Voltage */}
                        <td style={{ padding: '6px 12px', fontSize: '12px', color: '#475569', borderRight: '1px solid #e2e8f0' }}>
                          {meta.vehicleVoltage || meta.batteryVoltage || '12V'}
                        </td>

                        {/* 17. Ignition ON Status */}
                        <td style={{ padding: '6px 12px', fontSize: '12px', color: '#475569', borderRight: '1px solid #e2e8f0' }}>
                          {meta.engineOnStatus || meta.engineOn || 'Voltage+Ignition'}
                        </td>

                        {/* 18. Sensor Number */}
                        <td style={{ padding: '6px 12px', fontSize: '12px', color: '#64748b', borderRight: '1px solid #e2e8f0' }}>
                          {meta.sensorNo || '-'}
                        </td>

                        {/* 19. Service Engineer Number */}
                        <td style={{ padding: '6px 12px', fontSize: '12px', color: '#475569', borderRight: '1px solid #e2e8f0' }}>
                          {meta.serviceEngineer || '-'}
                        </td>

                        {/* 20. Service Mobile Number */}
                        <td style={{ padding: '6px 12px', fontSize: '12px', color: '#475569', fontFamily: 'monospace', borderRight: '1px solid #e2e8f0' }}>
                          {meta.serviceEngineerPhone || '-'}
                        </td>

                        {/* 21. Salesman */}
                        <td style={{ padding: '6px 12px', fontSize: '12px', color: '#475569', borderRight: '1px solid #e2e8f0' }}>
                          {meta.salesman || '-'}
                        </td>

                        {/* 22. Salesman Mobile Number */}
                        <td style={{ padding: '6px 12px', fontSize: '12px', color: '#475569', fontFamily: 'monospace', borderRight: '1px solid #e2e8f0' }}>
                          {meta.salesmanPhone || '-'}
                        </td>

                        {/* 23. Installation Date */}
                        <td style={{ padding: '6px 12px', fontSize: '12px', color: '#64748b', borderRight: '1px solid #e2e8f0' }}>
                          {meta.installationDate || meta.installedDate || '-'}
                        </td>

                        {/* 24. Onboarding Date */}
                        <td style={{ padding: '6px 12px', fontSize: '12px', color: '#64748b', borderRight: '1px solid #e2e8f0' }}>
                          {meta.onboardingDate || meta.onboardDate || (v.created_at ? formatLocalDate(v.created_at) : '-')}
                        </td>

                        {/* 25. Owner Name */}
                        <td style={{ padding: '6px 12px', fontSize: '12px', color: '#0f172a', fontWeight: 600, borderRight: '1px solid #e2e8f0' }}>
                          {meta.ownerName || meta.customerName || v.driver_name || '-'}
                        </td>

                        {/* 26. Owner Mobile Number */}
                        <td style={{ padding: '6px 12px', fontSize: '12px', color: '#475569', fontFamily: 'monospace', borderRight: '1px solid #e2e8f0' }}>
                          {meta.ownerPhone || meta.customerPhone || v.driver_phone || '-'}
                        </td>

                        {/* 27. Owner Email ID */}
                        <td style={{ padding: '6px 12px', fontSize: '12px', color: '#475569', borderRight: '1px solid #e2e8f0' }}>
                          {meta.email || '-'}
                        </td>

                        {/* 28. Owner Location */}
                        <td style={{ padding: '6px 12px', fontSize: '12px', color: '#475569', borderRight: '1px solid #e2e8f0' }}>
                          {meta.rtoLocation || '-'}
                        </td>

                        {/* 29. Owner Aadhar ID */}
                        <td style={{ padding: '6px 12px', fontSize: '12px', color: '#64748b', fontFamily: 'monospace', borderRight: '1px solid #e2e8f0' }}>
                          {meta.aadharNo || '-'}
                        </td>

                        {/* 30. Owner Pancard Number */}
                        <td style={{ padding: '6px 12px', fontSize: '12px', color: '#64748b', fontFamily: 'monospace', borderRight: '1px solid #e2e8f0' }}>
                          {meta.panNo || '-'}
                        </td>

                        {/* 31. Username */}
                        <td style={{ padding: '6px 12px', fontSize: '12px', color: '#475569', fontWeight: 600, borderRight: '1px solid #e2e8f0' }}>
                          {meta.username || '-'}
                        </td>

                        {/* 32. Password */}
                        <td style={{ padding: '6px 12px', fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace', borderRight: '1px solid #e2e8f0' }}>
                          {meta.password ? '••••••••' : '-'}
                        </td>

                        {/* 33. Group */}
                        <td style={{ padding: '6px 12px', borderRight: '1px solid #e2e8f0' }}>
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
                          <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${v.category === 'TG Mining' ? 'bg-amber-100 text-amber-900 border border-amber-200' :
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
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${viewingVehicle.category === 'TG Mining' ? 'bg-amber-100 text-amber-900' :
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
