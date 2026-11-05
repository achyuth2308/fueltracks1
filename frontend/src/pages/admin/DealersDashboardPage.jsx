import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, 
  Search, 
  Users, 
  Cpu, 
  Truck, 
  ArrowRight, 
  Mail, 
  Phone, 
  Globe, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  RefreshCw,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { adminApi } from '../../api/axios';

const DealersDashboardPage = () => {
  const navigate = useNavigate();
  const [dealers, setDealers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');

  const fetchDealers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getDealers();
      if (res.success) {
        setDealers(res.data || []);
      } else {
        setError(res.error || 'Failed to fetch dealers.');
      }
    } catch (err) {
      console.error('[DEALERS-FETCH-ERROR]', err);
      setError(err.response?.data?.error || err.message || 'Error communicating with server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDealers();
  }, []);

  // Filtered dealers
  const filteredDealers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return dealers.filter(d => {
      const name = (d.name || '').toLowerCase();
      const brand = (d.brand_name || '').toLowerCase();
      const company = (d.company_name || '').toLowerCase();
      const contact = (d.contact_person || '').toLowerCase();
      const email = (d.email || '').toLowerCase();
      const phone = (d.phone || '').toLowerCase();
      const subdomain = (d.subdomain || '').toLowerCase();

      const matchesSearch = !q || 
        name.includes(q) || 
        brand.includes(q) || 
        company.includes(q) || 
        contact.includes(q) || 
        email.includes(q) || 
        phone.includes(q) || 
        subdomain.includes(q);

      if (!matchesSearch) return false;

      if (filterType === 'active') return d.is_active !== false;
      if (filterType === 'with_devices') return (d.total_devices || 0) > 0;
      if (filterType === 'starter') return (d.licenses?.used?.Starter || 0) > 0;
      if (filterType === 'basic') return (d.licenses?.used?.Basic || 0) > 0;

      return true;
    });
  }, [dealers, searchQuery, filterType]);

  // Aggregate metrics
  const aggregateMetrics = useMemo(() => {
    let totalDevices = 0;
    let totalUsers = 0;
    let totalVehicles = 0;
    let totalAllocated = 0;
    let totalUsed = 0;

    dealers.forEach(d => {
      totalDevices += d.total_devices || 0;
      totalUsers += d.total_users || 0;
      totalVehicles += d.total_vehicles || 0;
      totalAllocated += d.licenses?.totalAllocated || 0;
      totalUsed += d.licenses?.totalUsed || 0;
    });

    return {
      dealersCount: dealers.length,
      totalDevices,
      totalUsers,
      totalVehicles,
      totalAllocated,
      totalUsed
    };
  }, [dealers]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen bg-slate-50 text-slate-900">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold tracking-wide uppercase mb-2">
            <Building2 size={13} />
            Authorized Dealer Network
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            Dealer Management Dashboard
            <span className="text-sm font-semibold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700">
              {dealers.length} Active
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Monitor partner dealerships, allocated license quotas, live telematics adoption, and customer portfolios.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchDealers}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm transition active:scale-95 disabled:opacity-60"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh Data
          </button>
        </div>
      </div>

      {/* Metric KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Dealers</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Building2 size={16} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{aggregateMetrics.dealersCount}</div>
          <div className="text-xs text-slate-500 mt-1 font-medium">Enterprise Authorized Partners</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dealer Devices</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <Cpu size={16} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{aggregateMetrics.totalDevices}</div>
          <div className="text-xs text-slate-500 mt-1 font-medium">
            {aggregateMetrics.totalAllocated > 0 
              ? `${Math.round((aggregateMetrics.totalUsed / aggregateMetrics.totalAllocated) * 100)}% of ${aggregateMetrics.totalAllocated} Allocated`
              : 'Across all dealer fleets'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dealer Vehicles</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Truck size={16} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{aggregateMetrics.totalVehicles}</div>
          <div className="text-xs text-emerald-600 mt-1 font-semibold flex items-center gap-1">
            <CheckCircle2 size={12} /> Active Telematics Units
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dealer Users</span>
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center text-violet-600">
              <Users size={16} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{aggregateMetrics.totalUsers}</div>
          <div className="text-xs text-slate-500 mt-1 font-medium">Sub-accounts & Customers</div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search input */}
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search dealers by brand name, contact person, email, phone, or subdomain..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'All Dealers' },
            { id: 'active', label: 'Active Only' },
            { id: 'with_devices', label: 'With Devices' },
            { id: 'starter', label: 'Starter Tier' },
            { id: 'basic', label: 'Basic Tier' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                filterType === f.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 mb-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-rose-600" />
            <span>{error}</span>
          </div>
          <button onClick={fetchDealers} className="text-xs font-bold text-rose-700 underline">Try Again</button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-white border border-slate-200 rounded-3xl p-6 animate-pulse">
              <div className="flex items-center justify-between mb-4">
                <div className="w-16 h-4 bg-slate-200 rounded"></div>
                <div className="w-12 h-4 bg-slate-200 rounded"></div>
              </div>
              <div className="flex flex-col items-center my-4">
                <div className="w-20 h-20 rounded-2xl bg-slate-200 mb-3"></div>
                <div className="w-32 h-5 bg-slate-200 rounded mb-2"></div>
                <div className="w-24 h-3 bg-slate-200 rounded"></div>
              </div>
              <div className="space-y-2 mt-6">
                <div className="w-full h-8 bg-slate-100 rounded-xl"></div>
                <div className="w-full h-12 bg-slate-100 rounded-xl"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredDealers.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center max-w-md mx-auto my-12 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-4">
            <Building2 size={32} />
          </div>
          <h3 className="text-base font-bold text-slate-800">No Dealers Found</h3>
          <p className="text-xs text-slate-500 mt-1 mb-6">
            {searchQuery ? `No dealers matching "${searchQuery}"` : 'There are currently no dealers registered in the system.'}
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition"
            >
              Clear Search
            </button>
          )}
        </div>
      )}

      {/* Dealer Cards Grid */}
      {!loading && filteredDealers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDealers.map((d) => {
            const displayName = d.brand_name || d.name || 'Unnamed Dealer';
            const companyName = d.company_name || d.name;
            const primaryColor = d.primary_color || '#4f46e5';
            const logo = d.logo_url;
            const licenses = d.licenses || {};
            const limits = licenses.limits || {};
            const used = licenses.used || {};
            const leftover = licenses.leftover || {};

            const totalAllocated = licenses.totalAllocated || 0;
            const totalUsed = licenses.totalUsed || 0;
            const usagePercent = totalAllocated > 0 ? Math.min(100, Math.round((totalUsed / totalAllocated) * 100)) : 0;

            return (
              <div
                key={d.id}
                onClick={() => navigate(`/admin/dealers/${d.id}`)}
                className="group bg-white border border-slate-200 hover:border-indigo-400 rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden"
              >
                {/* Top Subtle Color Accent Bar */}
                <div 
                  className="absolute top-0 left-0 right-0 h-1.5 transition-all group-hover:h-2"
                  style={{ background: primaryColor }}
                />

                {/* Card Top Row: Status & Domain */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4 pt-1">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active Dealer
                    </span>

                    {d.subdomain && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        <Globe size={11} />
                        {d.subdomain}
                      </span>
                    )}
                  </div>

                  {/* Center: Dealer Logo & Name */}
                  <div className="flex flex-col items-center text-center my-3">
                    <div className="w-20 h-20 rounded-2xl p-1.5 bg-slate-50 border-2 border-slate-100 group-hover:border-indigo-200 flex items-center justify-center shadow-inner transition-transform duration-200 group-hover:scale-105 mb-3 overflow-hidden">
                      {logo ? (
                        <img
                          src={logo}
                          alt={displayName}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement.innerText = displayName.slice(0, 2).toUpperCase();
                          }}
                        />
                      ) : (
                        <div 
                          className="w-full h-full rounded-xl flex items-center justify-center font-black text-xl text-white shadow-sm"
                          style={{ background: `linear-gradient(135deg, ${primaryColor}, #1e1b4b)` }}
                        >
                          {displayName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <h3 className="text-lg font-black text-slate-900 tracking-tight group-hover:text-indigo-600 transition">
                      {displayName}
                    </h3>

                    {companyName && companyName !== displayName && (
                      <p className="text-xs font-semibold text-slate-500 mt-0.5">{companyName}</p>
                    )}

                    {d.contact_person && (
                      <p className="text-xs text-slate-400 mt-1">Contact: {d.contact_person}</p>
                    )}

                    {/* Contact Badges */}
                    <div className="flex items-center justify-center gap-3 mt-2 text-xs text-slate-500">
                      {d.email && (
                        <span className="inline-flex items-center gap-1 hover:text-indigo-600 truncate max-w-[150px]">
                          <Mail size={12} className="text-slate-400" />
                          {d.email}
                        </span>
                      )}
                      {d.phone && (
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <Phone size={12} className="text-slate-400" />
                          {d.phone}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* License Segregation Matrix */}
                  <div className="mt-5 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                        <Layers size={13} className="text-indigo-600" />
                        License Segregation
                      </div>
                      <span className="text-[11px] font-bold text-slate-500">
                        {totalUsed} / {totalAllocated} Used
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-3.5">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${usagePercent}%`,
                          backgroundColor: usagePercent > 90 ? '#ef4444' : usagePercent > 70 ? '#f59e0b' : '#10b981'
                        }}
                      />
                    </div>

                    {/* 4 Tiers Badges */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {/* Starter */}
                      <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Starter</div>
                        <div className="flex items-baseline justify-between mt-0.5">
                          <span className="font-bold text-slate-800">{used.Starter || 0} / {limits.Starter || 0}</span>
                          <span className="text-[10px] font-semibold text-emerald-600">
                            {leftover.Starter || 0} left
                          </span>
                        </div>
                      </div>

                      {/* Basic */}
                      <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Basic</div>
                        <div className="flex items-baseline justify-between mt-0.5">
                          <span className="font-bold text-slate-800">{used.Basic || 0} / {limits.Basic || 0}</span>
                          <span className="text-[10px] font-semibold text-emerald-600">
                            {leftover.Basic || 0} left
                          </span>
                        </div>
                      </div>

                      {/* Advanced */}
                      <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Advanced</div>
                        <div className="flex items-baseline justify-between mt-0.5">
                          <span className="font-bold text-slate-800">{used.Advanced || 0} / {limits.Advanced || 0}</span>
                          <span className="text-[10px] font-semibold text-emerald-600">
                            {leftover.Advanced || 0} left
                          </span>
                        </div>
                      </div>

                      {/* Premium */}
                      <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Premium</div>
                        <div className="flex items-baseline justify-between mt-0.5">
                          <span className="font-bold text-slate-800">{used.Premium || 0} / {limits.Premium || 0}</span>
                          <span className="text-[10px] font-semibold text-emerald-600">
                            {leftover.Premium || 0} left
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Counters & Action CTA */}
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs font-semibold text-slate-600">
                    <span className="flex items-center gap-1" title="Total Devices">
                      <Cpu size={13} className="text-blue-500" />
                      {d.total_devices || 0} Dev
                    </span>
                    <span className="flex items-center gap-1" title="Total Vehicles">
                      <Truck size={13} className="text-emerald-500" />
                      {d.total_vehicles || 0} Veh
                    </span>
                    <span className="flex items-center gap-1" title="Total Users">
                      <Users size={13} className="text-violet-500" />
                      {d.total_users || 0} Users
                    </span>
                  </div>

                  <div className="text-xs font-bold text-indigo-600 group-hover:text-indigo-700 flex items-center gap-1 transition-transform group-hover:translate-x-1">
                    Details
                    <ArrowRight size={14} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DealersDashboardPage;
