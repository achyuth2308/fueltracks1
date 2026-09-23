import React, { useState } from 'react';
import {
  Building2, Users, Truck, Cpu, Search,
  ExternalLink, ArrowRight, ShieldCheck, Mail, Phone,
  Globe, KeyRound, CheckCircle2, ChevronRight, Download
} from 'lucide-react';

const OrgDirectoryTab = ({ orgs = [], onSelectOrg, onTabChange, primaryColor = '#0284C7' }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOrgs = orgs.filter(o => {
    const term = searchQuery.toLowerCase();
    return (
      (o.name && o.name.toLowerCase().includes(term)) ||
      (o.contact_person && o.contact_person.toLowerCase().includes(term)) ||
      (o.email && o.email.toLowerCase().includes(term)) ||
      (o.phone && o.phone.toLowerCase().includes(term)) ||
      (o.address && o.address.toLowerCase().includes(term)) ||
      (o.type && o.type.toLowerCase().includes(term))
    );
  });

  const totalVehicles = orgs.reduce((acc, o) => acc + (parseInt(o.vehicle_count || o.total_vehicles_count, 10) || 0), 0);
  const totalUsers = orgs.reduce((acc, o) => acc + (parseInt(o.user_count || o.total_users_count, 10) || 0), 0);
  const activeOrgsCount = orgs.filter(o => o.is_active !== false).length;

  const handleExportCSV = () => {
    if (!filteredOrgs || filteredOrgs.length === 0) return;
    const headers = ['Organization Name', 'Contact Person', 'Email', 'Phone', 'Type', 'Vehicles', 'Users', 'Status'];
    const rows = filteredOrgs.map(o => [
      `"${(o.name || '').replace(/"/g, '""')}"`,
      `"${(o.contact_person || '').replace(/"/g, '""')}"`,
      `"${(o.email || '').replace(/"/g, '""')}"`,
      `"${(o.phone || '').replace(/"/g, '""')}"`,
      `"${(o.type || '').replace(/"/g, '""')}"`,
      `"${o.vehicle_count || o.total_vehicles_count || 0}"`,
      `"${o.user_count || o.total_users_count || 0}"`,
      `"${o.is_active !== false ? 'Active' : 'Inactive'}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `organizations_directory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleManageOrg = (orgId, targetTab = 'general') => {
    onSelectOrg(orgId);
    if (onTabChange) onTabChange(targetTab);
  };

  return (
    <div className="flex flex-col gap-6 w-full pb-20">
      {/* Top Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
          <div>
            <span className="text-xs font-black uppercase tracking-wider block" style={{ color: '#0F172A' }}>Organizations</span>
            <div className="text-3xl font-black mt-1" style={{ color: '#0F172A' }}>{orgs.length}</div>
            <span className="text-xs text-emerald-700 font-extrabold mt-0.5 inline-block">{activeOrgsCount} Active Workspaces</span>
          </div>
          <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-xs">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
          <div>
            <span className="text-xs font-black uppercase tracking-wider block" style={{ color: '#0F172A' }}>Fleet Vehicles</span>
            <div className="text-3xl font-black mt-1" style={{ color: '#0F172A' }}>{totalVehicles}</div>
            <span className="text-xs font-bold mt-0.5 inline-block" style={{ color: '#334155' }}>Registered Fleet Units</span>
          </div>
          <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-xs">
            <Truck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
          <div>
            <span className="text-xs font-black uppercase tracking-wider block" style={{ color: '#0F172A' }}>Customer Users</span>
            <div className="text-3xl font-black mt-1" style={{ color: '#0F172A' }}>{totalUsers}</div>
            <span className="text-xs text-emerald-700 font-extrabold mt-0.5 inline-block">Managers & Operators</span>
          </div>
          <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-xs">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
          <div>
            <span className="text-xs font-black uppercase tracking-wider block" style={{ color: '#0F172A' }}>Account Security</span>
            <div className="text-3xl font-black text-emerald-700 mt-1">100%</div>
            <span className="text-xs font-bold mt-0.5 inline-block" style={{ color: '#334155' }}>Encrypted API Keys</span>
          </div>
          <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-xs">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Directory & Search Bar */}
      <div className="bg-white p-7 rounded-3xl border border-slate-200/90 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-6 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black uppercase tracking-wide m-0" style={{ color: '#0F172A' }}>Client Organizations Directory</h3>
            <p className="text-xs font-bold m-0 mt-0.5" style={{ color: '#1E293B' }}>Select an organization to manage their business profile, maps engine, license quotas, and security settings.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={filteredOrgs.length === 0}
              className="flex items-center text-xs font-extrabold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 px-4 h-11 rounded-2xl transition-all shadow-2xs cursor-pointer disabled:opacity-40"
            >
              <Download className="w-4 h-4 mr-1.5 text-slate-500" />
              Export CSV
            </button>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by org name, contact, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 pl-10 pr-4 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border-2 border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-800 focus:ring-4 focus:ring-slate-500/10 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Organizations Grid */}
        {filteredOrgs.length === 0 ? (
          <div className="text-center py-16 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <Building2 className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <span className="text-xs font-bold text-slate-800 block">No matching organizations found</span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Try searching with a different keyword</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredOrgs.map((org) => {
              const isActive = org.is_active !== false;

              return (
                <div
                  key={org.id}
                  className="bg-white rounded-3xl border border-slate-200/90 hover:border-slate-400 p-6 flex flex-col justify-between shadow-2xs hover:shadow-md transition-all group"
                >
                  <div>
                    {/* Header: Name + Badge */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-sm flex-shrink-0"
                          style={{ backgroundColor: primaryColor }}
                        >
                          {(org.name || 'O').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-sm font-black truncate m-0 leading-snug group-hover:text-slate-700 transition-colors max-w-[160px]" style={{ color: '#0F172A' }}>
                            {org.name}
                          </h4>
                          <span className="text-[11px] font-bold block mt-0.5" style={{ color: '#475569' }}>
                            {org.type ? `${org.type.charAt(0).toUpperCase() + org.type.slice(1)} Org` : 'Customer Fleet'}
                          </span>
                        </div>
                      </div>

                      <span className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-full flex-shrink-0 ${
                        isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {isActive ? 'Active' : 'Suspended'}
                      </span>
                    </div>

                    {/* Contacts & Metadata */}
                    <div className="space-y-2 text-xs my-4 pt-3 border-t border-slate-100 font-medium">
                      {org.contact_person && (
                        <div className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <span className="font-bold truncate" style={{ color: '#0F172A' }}>{org.contact_person}</span>
                        </div>
                      )}
                      {(org.email || org.primary_user_email) && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <span className="truncate font-bold" style={{ color: '#1E293B' }}>{org.email || org.primary_user_email}</span>
                        </div>
                      )}
                      {(org.phone || org.primary_user_phone) && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span>{org.phone || org.primary_user_phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Quick Metric Pills */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/60 mb-4 text-center">
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Vehicles</div>
                        <div className="text-sm font-black text-slate-900 mt-0.5">
                          {org.vehicle_count || org.total_vehicles_count || 0}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Users</div>
                        <div className="text-sm font-black text-slate-900 mt-0.5">
                          {org.user_count || org.total_users_count || 0}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleManageOrg(org.id, 'general')}
                      style={{ backgroundColor: primaryColor }}
                      className="flex-1 h-9 rounded-xl text-xs font-black text-white flex items-center justify-center gap-1.5 shadow-sm hover:opacity-90 transition-all"
                    >
                      <span>Manage Profile</span>
                      <ArrowRight className="w-3.5 h-3.5" />
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

export default OrgDirectoryTab;
