import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Building2,
  ArrowLeft,
  Search,
  Mail,
  Phone,
  Globe,
  MapPin,
  Calendar,
  Users,
  Truck,
  Cpu,
  Layers,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  Briefcase,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  FolderTree,
  SlidersHorizontal,
  ChevronLeft
} from 'lucide-react';
import { adminApi } from '../../api/axios';

const DealerProfileDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active section tab: 'users' | 'vehicles' | 'devices' | 'groups' | 'organizations'
  const [activeTab, setActiveTab] = useState('users');
  const [tabSearch, setTabSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const fetchDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getDealerDetails(id);
      if (res.success) {
        setData(res.data);
      } else {
        setError(res.error || 'Failed to fetch dealer dossier.');
      }
    } catch (err) {
      console.error('[DEALER-DETAILS-ERROR]', err);
      setError(err.response?.data?.error || err.message || 'Error communicating with server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchDetails();
    }
  }, [id]);

  // Reset page when tab changes or search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, tabSearch]);

  const dealer = data?.dealer || {};
  const licenses = data?.licenses || {};
  const limits = licenses.limits || {};
  const used = licenses.used || {};
  const leftover = licenses.leftover || {};
  const telemetry = data?.telemetryStats || { total: 0, live: 0, noData: 0, unreachable: 0 };

  const displayName = dealer.brand_name || dealer.name || 'Dealer Dossier';
  const companyName = dealer.company_name || dealer.name;
  const primaryColor = dealer.primary_color || '#4f46e5';

  // Format date helper
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'Never';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  // Filter items in active tab based on search
  const filteredItems = useMemo(() => {
    if (!data) return [];
    const q = tabSearch.toLowerCase().trim();

    if (activeTab === 'users') {
      const list = data.users || [];
      if (!q) return list;
      return list.filter(u => 
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q) ||
        (u.phone || '').toLowerCase().includes(q) ||
        (u.role || '').toLowerCase().includes(q)
      );
    }

    if (activeTab === 'vehicles') {
      const list = data.vehicles || [];
      if (!q) return list;
      return list.filter(v => 
        (v.name || '').toLowerCase().includes(q) ||
        (v.plate || '').toLowerCase().includes(q) ||
        (v.imei || '').toLowerCase().includes(q) ||
        (v.status || '').toLowerCase().includes(q) ||
        (v.model || '').toLowerCase().includes(q)
      );
    }

    if (activeTab === 'devices') {
      const list = data.devices || [];
      if (!q) return list;
      return list.filter(d => 
        (d.imei || '').toLowerCase().includes(q) ||
        (d.device_type || '').toLowerCase().includes(q) ||
        (d.licence_id || '').toLowerCase().includes(q) ||
        (d.vehicle_plate || '').toLowerCase().includes(q) ||
        (d.status || '').toLowerCase().includes(q)
      );
    }

    if (activeTab === 'groups') {
      const list = data.groups || [];
      if (!q) return list;
      return list.filter(g => 
        (g.name || '').toLowerCase().includes(q) ||
        (g.description || '').toLowerCase().includes(q)
      );
    }

    if (activeTab === 'organizations') {
      const list = data.organizations || [];
      if (!q) return list;
      return list.filter(o => 
        (o.name || '').toLowerCase().includes(q) ||
        (o.contact_person || '').toLowerCase().includes(q) ||
        (o.email || '').toLowerCase().includes(q) ||
        (o.phone || '').toLowerCase().includes(q)
      );
    }

    return [];
  }, [data, activeTab, tabSearch]);

  // Paginated items
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage]);

  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;

  if (loading) {
    return (
      <div className="p-6 max-w-[1600px] mx-auto min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <RefreshCw size={36} className="animate-spin text-indigo-600 mb-4" />
        <p className="text-sm font-bold text-slate-600">Loading Dealer Dossier & Fleet Status...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 max-w-2xl mx-auto min-h-screen flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-900 mb-2">Dealer Not Found</h2>
        <p className="text-sm text-slate-500 mb-6">{error || 'Could not find details for this dealer.'}</p>
        <button
          onClick={() => navigate('/admin/dealers')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition"
        >
          <ArrowLeft size={14} /> Back to Dealers
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen bg-slate-50 text-slate-900">
      {/* Top Nav: Back button */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/admin/dealers')}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 text-xs font-bold shadow-sm transition active:scale-95"
        >
          <ArrowLeft size={14} />
          Back to Dealers
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchDetails}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 text-xs font-bold shadow-sm transition active:scale-95"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── 1. RESUME / EXECUTIVE DOSSIER HEADER ── */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm mb-8 relative overflow-hidden">
        {/* Subtle Brand Accent Bar */}
        <div 
          className="absolute top-0 left-0 right-0 h-2"
          style={{ background: `linear-gradient(90deg, ${primaryColor}, #3b82f6)` }}
        />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pt-2">
          {/* Left: Logo & Parallel Info */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* Logo */}
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl p-2 bg-slate-50 border-2 border-slate-200 flex items-center justify-center shadow-inner flex-shrink-0 overflow-hidden">
              {dealer.logo_url ? (
                <img
                  src={dealer.logo_url}
                  alt={displayName}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement.innerText = displayName.slice(0, 2).toUpperCase();
                  }}
                />
              ) : (
                <div 
                  className="w-full h-full rounded-xl flex items-center justify-center font-black text-2xl text-white shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${primaryColor}, #0f172a)` }}
                >
                  {displayName.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            {/* Parallel Information */}
            <div className="text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active Dealer Partner
                </span>

                {dealer.subdomain && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                    <Globe size={11} />
                    {dealer.subdomain}.fueltracks.in
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {displayName}
              </h1>

              {companyName && companyName !== displayName && (
                <p className="text-xs font-semibold text-slate-500 mt-0.5">{companyName}</p>
              )}

              {/* Contact Information Row */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-3 text-xs text-slate-600">
                {dealer.contact_person && (
                  <span className="font-semibold text-slate-700">
                    👤 {dealer.contact_person}
                  </span>
                )}
                {dealer.email && (
                  <a href={`mailto:${dealer.email}`} className="inline-flex items-center gap-1 text-slate-600 hover:text-indigo-600 transition">
                    <Mail size={13} className="text-slate-400" />
                    {dealer.email}
                  </a>
                )}
                {dealer.phone && (
                  <a href={`tel:${dealer.phone}`} className="inline-flex items-center gap-1 text-slate-600 hover:text-indigo-600 transition">
                    <Phone size={13} className="text-slate-400" />
                    {dealer.phone}
                  </a>
                )}
                {dealer.created_at && (
                  <span className="inline-flex items-center gap-1 text-slate-400">
                    <Calendar size={13} />
                    Partner since {formatDate(dealer.created_at)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Total Allocated vs Leftover Highlight */}
          <div className="w-full lg:w-auto bg-slate-50 border border-slate-200 rounded-2xl p-4 flex sm:flex-row lg:flex-col justify-around gap-4 text-center sm:text-left lg:text-right">
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Quota Allocated</div>
              <div className="text-2xl font-black text-slate-900 mt-0.5">{licenses.totalAllocated || 0} Devices</div>
            </div>
            <div className="border-t sm:border-t-0 lg:border-t border-slate-200 pt-2 sm:pt-0 lg:pt-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Leftover (Remaining)</div>
              <div className="text-2xl font-black text-emerald-600 mt-0.5">{licenses.totalLeftover || 0} Available</div>
            </div>
          </div>
        </div>

        {/* ── 2. LICENSES ALLOCATION VS LEFTOVER MATRIX ── */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <Layers size={16} className="text-indigo-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              License Allocation & Remaining Leftovers
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Starter */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Starter</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">ST%</span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <div>
                  <div className="text-xl font-black text-slate-900">{used.Starter || 0} / {limits.Starter || 0}</div>
                  <div className="text-[11px] text-slate-400 font-medium">Used / Allocated</div>
                </div>
                <div className="text-right">
                  <div className="text-base font-black text-emerald-600">{leftover.Starter || 0}</div>
                  <div className="text-[10px] font-semibold text-emerald-700">Leftover</div>
                </div>
              </div>
            </div>

            {/* Basic */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Basic</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">BC%</span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <div>
                  <div className="text-xl font-black text-slate-900">{used.Basic || 0} / {limits.Basic || 0}</div>
                  <div className="text-[11px] text-slate-400 font-medium">Used / Allocated</div>
                </div>
                <div className="text-right">
                  <div className="text-base font-black text-emerald-600">{leftover.Basic || 0}</div>
                  <div className="text-[10px] font-semibold text-emerald-700">Leftover</div>
                </div>
              </div>
            </div>

            {/* Advanced */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Advanced</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">AD%</span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <div>
                  <div className="text-xl font-black text-slate-900">{used.Advanced || 0} / {limits.Advanced || 0}</div>
                  <div className="text-[11px] text-slate-400 font-medium">Used / Allocated</div>
                </div>
                <div className="text-right">
                  <div className="text-base font-black text-emerald-600">{leftover.Advanced || 0}</div>
                  <div className="text-[10px] font-semibold text-emerald-700">Leftover</div>
                </div>
              </div>
            </div>

            {/* Premium */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Premium</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">EN% / PR%</span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <div>
                  <div className="text-xl font-black text-slate-900">{used.Premium || 0} / {limits.Premium || 0}</div>
                  <div className="text-[11px] text-slate-400 font-medium">Used / Allocated</div>
                </div>
                <div className="text-right">
                  <div className="text-base font-black text-emerald-600">{leftover.Premium || 0}</div>
                  <div className="text-[10px] font-semibold text-emerald-700">Leftover</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. LIVE VEHICLE TELEMETRY STATS BAR ── */}
        <div className="mt-6 pt-6 border-t border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <Truck size={16} className="text-emerald-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Fleet Telemetry Status (Scoped to Dealer)
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Total */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-xs">
              <div className="text-xs font-bold text-slate-500 uppercase">Total Vehicles</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{telemetry.total}</div>
            </div>

            {/* Live / Online */}
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 text-center">
              <div className="text-xs font-bold text-emerald-700 uppercase flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                Live / Online
              </div>
              <div className="text-2xl font-black text-emerald-700 mt-1">{telemetry.live}</div>
            </div>

            {/* No Data */}
            <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-3 text-center">
              <div className="text-xs font-bold text-rose-700 uppercase flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                No Data (&gt;30m)
              </div>
              <div className="text-2xl font-black text-rose-700 mt-1">{telemetry.noData}</div>
            </div>

            {/* Never Communicated / Unreachable */}
            <div className="bg-slate-100/70 border border-slate-200 rounded-xl p-3 text-center">
              <div className="text-xs font-bold text-slate-600 uppercase flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                Unreachable / Never
              </div>
              <div className="text-2xl font-black text-slate-700 mt-1">{telemetry.unreachable}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. SEGMENT SWITCHER & SEARCH BAR ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Switcher Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'users', label: 'Users', icon: Users, count: data?.users?.length || 0 },
            { id: 'vehicles', label: 'Vehicles', icon: Truck, count: data?.vehicles?.length || 0 },
            { id: 'devices', label: 'Devices', icon: Cpu, count: data?.devices?.length || 0 },
            { id: 'groups', label: 'Groups', icon: FolderTree, count: data?.groups?.length || 0 },
            { id: 'organizations', label: 'Organizations', icon: Briefcase, count: data?.organizations?.length || 0 }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setTabSearch('');
                }}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  active
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600'
                }`}
              >
                <Icon size={14} className={active ? 'text-indigo-400' : 'text-slate-400'} />
                {tab.label}
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Tab Search Bar */}
        <div className="relative md:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={tabSearch}
            onChange={(e) => setTabSearch(e.target.value)}
            placeholder={`Search ${activeTab}...`}
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
          />
          {tabSearch && (
            <button
              onClick={() => setTabSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── 5. TABULAR DATA VIEWS ── */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden mb-6">
        {/* Table Content */}
        <div className="overflow-x-auto">
          {/* 1. USERS TABLE */}
          {activeTab === 'users' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white uppercase tracking-wider text-[11px] font-bold">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">User Name</th>
                  <th className="py-3 px-4">Username / Email</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Organization</th>
                  <th className="py-3 px-4">Last Login</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-400 font-semibold">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((u, idx) => (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono text-slate-400">{(currentPage - 1) * pageSize + idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{u.name || '—'}</td>
                      <td className="py-3 px-4 text-slate-600">
                        <div>{u.email}</div>
                        {u.username && <div className="text-[10px] text-slate-400 font-mono">@{u.username}</div>}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{u.phone || '—'}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">{u.org_name || dealer.name}</td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{formatDateTime(u.last_login)}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.is_active !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {u.is_active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* 2. VEHICLES TABLE */}
          {activeTab === 'vehicles' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white uppercase tracking-wider text-[11px] font-bold">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Vehicle Plate / Name</th>
                  <th className="py-3 px-4">Device IMEI</th>
                  <th className="py-3 px-4">Model / Category</th>
                  <th className="py-3 px-4">Telemetry Status</th>
                  <th className="py-3 px-4">Last Communication</th>
                  <th className="py-3 px-4">Organization</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400 font-semibold">
                      No vehicles found.
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((v, idx) => (
                    <tr key={v.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono text-slate-400">{(currentPage - 1) * pageSize + idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {v.plate || v.name}
                        {v.name && v.plate && v.name !== v.plate && (
                          <span className="block text-[11px] text-slate-400 font-normal">{v.name}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700 font-bold">{v.imei}</td>
                      <td className="py-3 px-4 text-slate-600">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                          {v.model || v.category || 'General'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          v.status === 'Online'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : v.status === 'No Data'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            v.status === 'Online' ? 'bg-emerald-500' : v.status === 'No Data' ? 'bg-rose-500' : 'bg-slate-400'
                          }`} />
                          {v.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{formatDateTime(v.last_seen)}</td>
                      <td className="py-3 px-4 text-slate-700 font-medium">{v.org_name || dealer.name}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* 3. DEVICES TABLE */}
          {activeTab === 'devices' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white uppercase tracking-wider text-[11px] font-bold">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Device IMEI</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">License ID</th>
                  <th className="py-3 px-4">Assigned Vehicle</th>
                  <th className="py-3 px-4">State</th>
                  <th className="py-3 px-4">Last Communication</th>
                  <th className="py-3 px-4">Registered Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-400 font-semibold">
                      No devices found.
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((d, idx) => (
                    <tr key={d.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono text-slate-400">{(currentPage - 1) * pageSize + idx + 1}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{d.imei}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                          {d.device_type || 'VOLTY'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-indigo-600 font-semibold">
                        {d.licence_id || '—'}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {d.vehicle_plate || d.vehicle_name || 'Unassigned'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          d.status === 'Online'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : d.status === 'No Data'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            d.status === 'Online' ? 'bg-emerald-500' : d.status === 'No Data' ? 'bg-rose-500' : 'bg-slate-400'
                          }`} />
                          {d.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{formatDateTime(d.last_seen)}</td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">{formatDate(d.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* 4. GROUPS TABLE */}
          {activeTab === 'groups' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white uppercase tracking-wider text-[11px] font-bold">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Group Name</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Vehicles Count</th>
                  <th className="py-3 px-4">Organization</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400 font-semibold">
                      No groups found.
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((g, idx) => (
                    <tr key={g.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono text-slate-400">{(currentPage - 1) * pageSize + idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <FolderTree size={14} className="text-indigo-600" />
                        {g.name}
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{g.description || '—'}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800">
                          {g.vehicle_count || 0} Vehicles
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{g.org_name || dealer.name}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          g.is_active !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {g.is_active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">{formatDate(g.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* 5. ORGANIZATIONS TABLE */}
          {activeTab === 'organizations' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white uppercase tracking-wider text-[11px] font-bold">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Customer Organization</th>
                  <th className="py-3 px-4">Contact Person</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Devices</th>
                  <th className="py-3 px-4">Users</th>
                  <th className="py-3 px-4">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-400 font-semibold">
                      No customer organizations created yet by this dealer.
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((o, idx) => (
                    <tr key={o.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono text-slate-400">{(currentPage - 1) * pageSize + idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <Briefcase size={14} className="text-indigo-600" />
                        {o.name}
                      </td>
                      <td className="py-3 px-4 text-slate-700">{o.contact_person || '—'}</td>
                      <td className="py-3 px-4 text-slate-600">{o.email || '—'}</td>
                      <td className="py-3 px-4 text-slate-600">{o.phone || '—'}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">{o.device_count || 0}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">{o.user_count || 0}</td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">{formatDate(o.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Toolbar */}
        {filteredItems.length > pageSize && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-600">
            <div>
              Showing <span className="font-bold">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-bold">{Math.min(currentPage * pageSize, filteredItems.length)}</span> of{' '}
              <span className="font-bold">{filteredItems.length}</span> entries
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-semibold flex items-center gap-1"
              >
                <ChevronLeft size={13} /> Prev
              </button>
              <span className="font-bold text-slate-700 px-2">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-semibold flex items-center gap-1"
              >
                Next <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DealerProfileDetailsPage;
