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
      meta.iccid?.toLowerCase().includes(q)
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
    <div style={{ padding: '24px 32px', background: '#EEF5F8', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>

      {/* Header with Title and Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 shrink-0">
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em' }}>Fleet Vehicles</h1>
          <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '2px' }}>
            Manage vehicle assets, categorize operations (TG Mining, VLTD), and batch assign multiple groups.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={() => navigate('/admin/vehicles/new')}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-md shadow-orange-500/20 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>Add Vehicle</span>
          </button>
        </div>
      </div>

      {/* Filters Bar & Category Pills */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm mb-4 shrink-0 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        
        {/* Category Tabs */}
        <div className="flex items-center flex-wrap gap-1.5">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
            <Tag size={13} /> Category:
          </span>
          {CATEGORIES.map(cat => {
            const count = cat === 'All' ? vehicles.length : (categoryCounts[cat] || 0);
            const isSelected = selectedCategory === cat;

            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-orange-600 text-white shadow-sm shadow-orange-500/20'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                }`}
              >
                <span>{cat}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                  isSelected ? 'bg-orange-700 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Dropdown Filters */}
        <div className="flex items-center flex-wrap gap-2.5 w-full lg:w-auto">
          
          {/* Org Filter (Superadmin) */}
          {isSuperAdmin && (
            <div className="relative min-w-[160px]">
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white"
              >
                <option value="all">🏢 All Organizations</option>
                {orgs.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Group Filter */}
          <div className="relative min-w-[140px]">
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white"
            >
              <option value="all">👥 All Groups</option>
              {groups.map(group => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </div>

          {/* Global Search Input */}
          <div className="relative flex-1 sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search plate, IMEI, owner, Aadhar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Floating Bulk Actions Bar */}
      {selectedVehicleIds.length > 0 && (
        <div className="bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center justify-between gap-4 mb-4 animate-slide-up shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-orange-600 flex items-center justify-center font-bold text-xs text-white">
              {selectedVehicleIds.length}
            </div>
            <span className="text-xs font-semibold">
              vehicle{selectedVehicleIds.length !== 1 ? 's' : ''} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsBulkGroupModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-sm"
            >
              <Layers size={14} /> Assign Groups
            </button>
            <button
              onClick={() => setSelectedVehicleIds([])}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area: Table + Right Details Panel */}
      <div style={{ display: 'flex', gap: '24px', flex: 1, minHeight: 0 }}>
        
        {/* Vehicles Table Card */}
        <div style={{
          flex: 1, background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0',
          boxShadow: '0 4px 6px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column',
          overflow: 'hidden'
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
                    <th style={{ padding: '14px 16px', width: '40px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedVehicleIds.length === filtered.length && filtered.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                      />
                    </th>
                    <th style={{ padding: '14px 18px' }}>Category</th>
                    <th style={{ padding: '14px 18px' }}>Vehicle Name</th>
                    <th style={{ padding: '14px 18px' }}>Plate Number</th>
                    <th style={{ padding: '14px 18px' }}>Assigned Groups</th>
                    <th style={{ padding: '14px 18px' }}>Device ID (IMEI)</th>
                    <th style={{ padding: '14px 18px' }}>VLTTD SLNO</th>
                    <th style={{ padding: '14px 18px' }}>Owner Name & Mobile</th>
                    <th style={{ padding: '14px 18px' }}>Organization</th>
                    <th style={{ padding: '14px 18px' }}>Status</th>
                    <th style={{ padding: '14px 18px' }}>Speed</th>
                    <th style={{ padding: '14px 18px' }}>Device Type</th>
                    <th style={{ padding: '14px 18px' }}>SIM 1</th>
                    <th style={{ padding: '14px 18px' }}>SIM 2</th>
                    <th style={{ padding: '14px 18px' }}>Salesman</th>
                    <th style={{ padding: '14px 18px' }}>Service Engineer</th>
                    <th style={{ padding: '14px 18px' }}>RTO / Location</th>
                    <th style={{ padding: '14px 18px', textAlign: 'center' }}>View</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v) => {
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
                        <td style={{ padding: '14px 16px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => toggleSelectVehicle(v.id, e)}
                            className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                          />
                        </td>

                        {/* Category Badge */}
                        <td style={{ padding: '14px 18px' }}>
                          <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                            v.category === 'TG Mining' ? 'bg-amber-100 text-amber-900 border border-amber-200' :
                            v.category === 'VLTD' ? 'bg-blue-100 text-blue-900 border border-blue-200' :
                            v.category === 'VLTD + Mining' ? 'bg-purple-100 text-purple-900 border border-purple-200' :
                            'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {v.category || 'General'}
                          </span>
                        </td>

                        <td style={{ padding: '14px 18px', fontSize: '13px', color: '#111827', fontWeight: 700 }}>{v.name || '-'}</td>
                        <td style={{ padding: '14px 18px', fontSize: '13px', color: '#111827', fontWeight: 700 }}>{v.plate || '-'}</td>

                        {/* Multi-Groups Badge */}
                        <td style={{ padding: '14px 18px' }}>
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

                        <td style={{ padding: '14px 18px', fontSize: '13px', color: '#111827', fontWeight: 600, fontFamily: 'monospace' }}>{v.imei || '-'}</td>
                        <td style={{ padding: '14px 18px', fontSize: '13px', color: '#64748B', fontFamily: 'monospace' }}>{meta.vlttdSlno || '-'}</td>
                        
                        {/* Owner Details */}
                        <td style={{ padding: '14px 18px', fontSize: '13px', color: '#111827' }}>
                          <div className="font-semibold">{meta.ownerName || v.driver_name || '-'}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{meta.ownerPhone || v.driver_phone || ''}</div>
                        </td>

                        <td style={{ padding: '14px 18px', fontSize: '13px', color: '#475569', fontWeight: 500 }}>{v.org_name || '-'}</td>
                        <td style={{ padding: '14px 18px' }}><StatusDot online={v.is_online} /></td>
                        <td style={{ padding: '14px 18px', fontSize: '13px', color: '#111827', fontWeight: 600 }}>{v.current_speed ? `${v.current_speed} km/h` : '0 km/h'}</td>
                        <td style={{ padding: '14px 18px', fontSize: '13px', color: '#475569' }}>{v.model || meta.deviceModel || 'AIS140'}</td>
                        <td style={{ padding: '14px 18px', fontSize: '13px', color: '#475569', fontFamily: 'monospace' }}>{v.gps_sim_no || meta.sim1 || '-'}</td>
                        <td style={{ padding: '14px 18px', fontSize: '13px', color: '#475569', fontFamily: 'monospace' }}>{meta.sim2 || '-'}</td>
                        <td style={{ padding: '14px 18px', fontSize: '13px', color: '#475569' }}>{meta.salesman || '-'}</td>
                        <td style={{ padding: '14px 18px', fontSize: '13px', color: '#475569' }}>{meta.serviceEngineer || '-'}</td>
                        <td style={{ padding: '14px 18px', fontSize: '13px', color: '#475569' }}>{meta.rtoLocation || '-'}</td>
                        <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', background: '#F8FAFC', color: '#f97316' }}>
                            <Eye size={16} />
                          </div>
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
            width: '360px', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0',
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
                <h3 style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Assigned Groups</h3>
                <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '10px', border: '1px solid #F1F5F9' }}>
                  {viewingVehicle.group_name ? (
                    <div className="flex flex-wrap gap-1.5">
                      {viewingVehicle.group_name.split(',').map((g, i) => (
                        <span key={i} className="px-2.5 py-1 bg-white border border-slate-200 text-slate-800 rounded-lg text-xs font-semibold shadow-2xs">
                          {g.trim()}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic">No groups assigned yet.</div>
                  )}
                  {viewingVehicle.metadata?.oldGroups && (
                    <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-600">Old Groups:</span> {viewingVehicle.metadata.oldGroups}
                    </div>
                  )}
                </div>
              </div>

              {/* Device & Hardware Specifications */}
              <div>
                <h3 style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Device & Hardware</h3>
                <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '12px', border: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-medium">Device ID (IMEI):</span>
                    <span className="font-mono font-bold text-slate-800">{viewingVehicle.imei}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-medium">VLTTD SLNO:</span>
                    <span className="font-mono text-slate-800">{viewingVehicle.metadata?.vlttdSlno || '—'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-medium">Device Type / Model:</span>
                    <span className="text-slate-800 font-semibold">{viewingVehicle.model || viewingVehicle.metadata?.deviceModel || 'AIS140'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-medium">Primary SIM 1:</span>
                    <span className="font-mono text-slate-800">{viewingVehicle.gps_sim_no || viewingVehicle.metadata?.sim1 || '—'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-medium">Secondary SIM 2:</span>
                    <span className="font-mono text-slate-800">{viewingVehicle.metadata?.sim2 || '—'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-medium">SIM ICCID:</span>
                    <span className="font-mono text-slate-800">{viewingVehicle.metadata?.iccid || '—'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-medium">Engine ON Status:</span>
                    <span className="text-slate-800">{viewingVehicle.metadata?.engineOnStatus || viewingVehicle.metadata?.engineOn || 'Voltage+Ignition'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-medium">Vehicle Voltage:</span>
                    <span className="text-slate-800">{viewingVehicle.metadata?.batteryVoltage || viewingVehicle.metadata?.vehicleVoltage || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Owner & KYC Information */}
              <div>
                <h3 style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Owner & KYC Details</h3>
                <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '12px', border: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-medium">Owner Name:</span>
                    <span className="text-slate-800 font-semibold">{viewingVehicle.metadata?.ownerName || viewingVehicle.driver_name || '—'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-medium">Owner Mobile:</span>
                    <span className="font-mono text-slate-800">{viewingVehicle.metadata?.ownerPhone || viewingVehicle.driver_phone || '—'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-medium">Owner Aadhar:</span>
                    <span className="font-mono text-slate-800">{viewingVehicle.metadata?.aadharNo || '—'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-medium">Owner PAN:</span>
                    <span className="font-mono text-slate-800 uppercase">{viewingVehicle.metadata?.panNo || '—'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-medium">RTO / Location:</span>
                    <span className="text-slate-800">{viewingVehicle.metadata?.rtoLocation || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Operations & Personnel */}
              <div>
                <h3 style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Personnel & Compliance</h3>
                <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '12px', border: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-medium">Service Engineer:</span>
                    <span className="text-slate-800">{viewingVehicle.metadata?.serviceEngineer || '—'} {viewingVehicle.metadata?.serviceEngineerPhone ? `(${viewingVehicle.metadata.serviceEngineerPhone})` : ''}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-medium">Salesman:</span>
                    <span className="text-slate-800">{viewingVehicle.metadata?.salesman || '—'} {viewingVehicle.metadata?.salesmanPhone ? `(${viewingVehicle.metadata.salesmanPhone})` : ''}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-medium">Chassis No:</span>
                    <span className="font-mono text-slate-800">{viewingVehicle.metadata?.chassisNo || '—'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-medium">Engine No:</span>
                    <span className="font-mono text-slate-800">{viewingVehicle.metadata?.engineNo || '—'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-medium">Sensor No:</span>
                    <span className="font-mono text-slate-800">{viewingVehicle.metadata?.sensorNo || '—'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-medium">Installed Date:</span>
                    <span className="text-slate-800">{viewingVehicle.metadata?.installedDate || viewingVehicle.metadata?.installationDate || '—'}</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Bulk Assign Groups Modal */}
      <BulkAssignGroupsModal
        isOpen={isBulkGroupModalOpen}
        onClose={() => setIsBulkGroupModalOpen(false)}
        onSuccess={() => {
          setSelectedVehicleIds([]);
          fetchVehicles();
        }}
        selectedVehicles={selectedVehiclesList}
        availableGroups={groups}
      />

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

export default VehiclesAdminPage;
