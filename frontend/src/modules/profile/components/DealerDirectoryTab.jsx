import React, { useState } from 'react';
import { 
  Building2, Users, Truck, Cpu, Search, Sparkles, 
  ExternalLink, ArrowRight, ShieldCheck, Mail, Phone, 
  Globe, KeyRound, CheckCircle2, ChevronRight, Download,
  Layers, Key
} from 'lucide-react';

const DealerDirectoryTab = ({ dealers = [], onSelectDealer, onTabChange }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDealers = dealers.filter(d => {
    const term = searchQuery.toLowerCase();
    return (
      (d.brand_name && d.brand_name.toLowerCase().includes(term)) ||
      (d.name && d.name.toLowerCase().includes(term)) ||
      (d.contact_person && d.contact_person.toLowerCase().includes(term)) ||
      (d.profile_email && d.profile_email.toLowerCase().includes(term)) ||
      (d.email && d.email.toLowerCase().includes(term))
    );
  });

  // Helper to extract total licenses issued to a dealer from device_limits
  const getDealerIssuedLicenses = (dealer) => {
    if (!dealer) return 0;
    if (typeof dealer.device_limits === 'object' && dealer.device_limits !== null) {
      return Object.values(dealer.device_limits).reduce((sum, val) => sum + (parseInt(val, 10) || 0), 0);
    }
    if (typeof dealer.device_limits === 'number') {
      return dealer.device_limits;
    }
    return 0;
  };

  const totalLicensesIssued = dealers.reduce((acc, d) => acc + getDealerIssuedLicenses(d), 0);
  const totalLicensesUsed = dealers.reduce((acc, d) => acc + (parseInt(d.total_vehicles_count, 10) || 0), 0);
  const totalLicensesAvailable = Math.max(0, totalLicensesIssued - totalLicensesUsed);
  const utilizationPercent = totalLicensesIssued > 0 ? Math.round((totalLicensesUsed / totalLicensesIssued) * 100) : 0;

  const handleExportCSV = () => {
    if (!filteredDealers || filteredDealers.length === 0) return;
    const headers = ['Dealership Name', 'Subdomain', 'Contact Person', 'Email', 'Phone', 'Licenses Issued', 'Licenses In Use', 'Available Balance'];
    const rows = filteredDealers.map(d => {
      const issued = getDealerIssuedLicenses(d);
      const used = parseInt(d.total_vehicles_count, 10) || 0;
      const available = Math.max(0, issued - used);
      return [
        `"${(d.brand_name || d.name || '').replace(/"/g, '""')}"`,
        `"${(d.subdomain || '').replace(/"/g, '""')}"`,
        `"${(d.contact_person || '').replace(/"/g, '""')}"`,
        `"${(d.profile_email || d.email || '').replace(/"/g, '""')}"`,
        `"${(d.profile_mobile || d.mobile || '').replace(/"/g, '""')}"`,
        `"${issued}"`,
        `"${used}"`,
        `"${available}"`
      ];
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `dealers_licenses_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleManageDealer = (dealerId, targetTab = 'whitelabel') => {
    onSelectDealer(dealerId);
    if (onTabChange) onTabChange(targetTab);
  };

  return (
    <div className="flex flex-col gap-6 w-full pb-20">
      {/* Top Overview Cards - Streamlined for Super Admin Governance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
          <div>
            <span className="text-xs font-black uppercase tracking-wider block" style={{ color: '#0F172A' }}>Total Dealerships</span>
            <div className="text-3xl font-black mt-1" style={{ color: '#0F172A' }}>{dealers.length}</div>
            <span className="text-xs text-emerald-700 font-extrabold mt-0.5 inline-block">Active Partner Accounts</span>
          </div>
          <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-xs">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
          <div>
            <span className="text-xs font-black uppercase tracking-wider block" style={{ color: '#0F172A' }}>Licenses Issued</span>
            <div className="text-3xl font-black mt-1" style={{ color: '#0F172A' }}>{totalLicensesIssued}</div>
            <span className="text-xs font-bold mt-0.5 inline-block" style={{ color: '#334155' }}>Total Fleet Quota Allocated</span>
          </div>
          <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-xs">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
          <div>
            <span className="text-xs font-black uppercase tracking-wider block" style={{ color: '#0F172A' }}>Licenses In Use</span>
            <div className="text-3xl font-black mt-1" style={{ color: '#0F172A' }}>{totalLicensesUsed}</div>
            <span className="text-xs text-emerald-700 font-extrabold mt-0.5 inline-block">Active Tracked Vehicles</span>
          </div>
          <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-xs">
            <Truck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
          <div>
            <span className="text-xs font-black uppercase tracking-wider block" style={{ color: '#0F172A' }}>Available Balance</span>
            <div className="text-3xl font-black mt-1 text-emerald-700">{totalLicensesAvailable}</div>
            <span className="text-xs font-bold mt-0.5 inline-block" style={{ color: '#334155' }}>{utilizationPercent}% Quota Utilization</span>
          </div>
          <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-xs">
            <Layers className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Dealers Directory & Search Bar */}
      <div className="bg-white p-7 rounded-3xl border border-slate-200/90 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-6 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black uppercase tracking-wide m-0" style={{ color: '#0F172A' }}>Authorized Dealership Directory</h3>
            <p className="text-xs font-bold m-0 mt-0.5" style={{ color: '#1E293B' }}>Select a dealership to manage their white-label branding, color themes, contact channels, and device quotas.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={filteredDealers.length === 0}
              className="flex items-center text-xs font-extrabold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 px-4 h-11 rounded-2xl transition-all shadow-2xs cursor-pointer disabled:opacity-40"
            >
              <Download className="w-4 h-4 mr-1.5 text-slate-500" />
              Export CSV
            </button>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by name, contact, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 pl-10 pr-4 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border-2 border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-800 focus:ring-4 focus:ring-slate-500/10 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Dealers Grid */}
        {filteredDealers.length === 0 ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center">
            <Building2 className="w-14 h-14 text-slate-400 mb-3" />
            <span className="text-sm font-bold text-slate-800">No dealers matching "{searchQuery}"</span>
            <span className="text-xs text-slate-500 mt-1">Try searching by another dealership name or contact person.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredDealers.map(dealer => {
              const displayName = dealer.brand_name || dealer.name;
              const primaryColor = dealer.primary_color || '#0284C7';
              const logo = dealer.logo_url;
              const dIssued = getDealerIssuedLicenses(dealer);
              const dUsed = parseInt(dealer.total_vehicles_count, 10) || 0;
              const dAvailable = Math.max(0, dIssued - dUsed);

              return (
                <div
                  key={dealer.id}
                  className="p-6 rounded-3xl border border-slate-200/90 hover:border-slate-400 bg-white hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3.5 mb-4">
                      <div className="flex items-center gap-3.5 min-w-0">
                        {logo ? (
                          <img 
                            src={logo} 
                            alt={displayName} 
                            className="w-12 h-12 rounded-2xl object-contain bg-slate-50 border border-slate-200 p-1.5 flex-shrink-0 shadow-2xs" 
                          />
                        ) : (
                          <div 
                            className="w-12 h-12 rounded-2xl text-white flex items-center justify-center font-black text-base shadow-sm flex-shrink-0"
                            style={{ backgroundColor: primaryColor }}
                          >
                            {displayName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className="text-sm font-black truncate m-0 group-hover:text-slate-700 transition-colors" style={{ color: '#0F172A' }}>
                            {displayName}
                          </h4>
                          <span className="text-[11px] font-bold truncate block mt-0.5" style={{ color: '#475569' }}>
                            {dealer.name !== displayName ? dealer.name : 'Authorized Partner'}
                          </span>
                        </div>
                      </div>

                      <span className="px-2.5 py-1 text-[10px] font-extrabold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex-shrink-0">
                        Active
                      </span>
                    </div>

                    {/* Subdomain & Contact */}
                    <div className="space-y-2.5 py-3.5 border-y border-slate-100 text-xs font-medium mb-4">
                      {dealer.subdomain ? (
                        <div className="flex items-center gap-2 text-sky-700 font-bold">
                          <Globe className="w-3.5 h-3.5 flex-shrink-0 text-sky-600" />
                          <span className="truncate">{dealer.subdomain}.fueltracks.com</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 font-semibold" style={{ color: '#475569' }}>
                          <Globe className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                          <span>Standard Portal Domain</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 truncate font-bold" style={{ color: '#1E293B' }}>
                        <Mail className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        <span className="truncate">{dealer.profile_email || dealer.email || 'dealer@portal.com'}</span>
                      </div>

                      <div className="flex items-center gap-2 truncate font-bold" style={{ color: '#1E293B' }}>
                        <Phone className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        <span>{dealer.profile_mobile || dealer.contact_person || 'Dealership Representative'}</span>
                      </div>
                    </div>

                    {/* License Stats Chips */}
                    <div className="grid grid-cols-3 gap-2.5 text-center mb-4">
                      <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                        <span className="text-[10px] font-extrabold block uppercase tracking-wider" style={{ color: '#475569' }}>Issued</span>
                        <span className="text-xs font-black mt-0.5 block" style={{ color: '#0F172A' }}>{dIssued}</span>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                        <span className="text-[10px] font-extrabold block uppercase tracking-wider" style={{ color: '#475569' }}>In Use</span>
                        <span className="text-xs font-black mt-0.5 block" style={{ color: '#0F172A' }}>{dUsed}</span>
                      </div>
                      <div className={`p-2.5 rounded-2xl border ${dAvailable > 0 ? 'bg-emerald-50/70 border-emerald-200' : 'bg-red-50/70 border-red-200'}`}>
                        <span className={`text-[10px] font-extrabold block uppercase tracking-wider ${dAvailable > 0 ? 'text-emerald-700' : 'text-red-700'}`}>Available</span>
                        <span className={`text-xs font-black mt-0.5 block ${dAvailable > 0 ? 'text-emerald-700' : 'text-red-700'}`}>{dAvailable}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => handleManageDealer(dealer.id, 'whitelabel')}
                      style={{ backgroundColor: primaryColor }}
                      className="flex-1 h-11 px-4 text-white rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-md hover:opacity-90 hover:-translate-y-0.5 transition-all cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Manage Branding</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Set / Reset Dealer Password"
                      onClick={() => handleManageDealer(dealer.id, 'security')}
                      className="w-11 h-11 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 rounded-2xl flex items-center justify-center transition-colors flex-shrink-0 shadow-2xs cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DealerDirectoryTab;
