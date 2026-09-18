import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from './hooks/useProfile';
import * as adminApi from '../../api/adminApi';
import OrgDirectoryTab from './components/OrgDirectoryTab';
import GeneralTab from './components/GeneralTab';
import MapsTab from './components/MapsTab';
import LicenseTab from './components/LicenseTab';
import SecurityTab from './components/SecurityTab';
import AuditTab from './components/AuditTab';
import {
  Building2, Map as MapIcon, Shield, Lock, History,
  Loader2, Check, Award, Globe, ExternalLink, Camera,
  Users, ChevronDown, ArrowRight
} from 'lucide-react';

const OrganizationProfilePage = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin' || user?.role === 'dealer';

  // Organizations list for Super Admin / Dealer
  const [orgs, setOrgs] = useState([]);
  const [orgsLoading, setOrgsLoading] = useState(isSuperAdmin);
  const [selectedOrgId, setSelectedOrgId] = useState(null);

  // Tab state
  const [activeTab, setActiveTab] = useState(isSuperAdmin ? 'directory' : 'general');

  const fetchOrgs = async () => {
    if (!isSuperAdmin) return;
    setOrgsLoading(true);
    try {
      const res = await adminApi.getOrgs();
      if (res.success && res.data?.length > 0) {
        setOrgs(res.data);
        if (!selectedOrgId) {
          setSelectedOrgId(res.data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load orgs list:', err);
    } finally {
      setOrgsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgs();
  }, [isSuperAdmin]);

  // Target orgId: for Super Admin/Dealer it's selectedOrgId, for Customer it's their own orgId
  const activeOrgId = isSuperAdmin ? selectedOrgId : (user?.org_id || user?.orgId);

  const {
    profile,
    license,
    dealerStats,
    loading,
    error,
    updateProfile,
    uploadImage,
    changePassword,
    refetch
  } = useProfile(activeOrgId);

  const selectedOrg = orgs.find(o => o.id === selectedOrgId);
  const primaryColor = profile?.primary_color || '#0284C7';
  const orgName = isSuperAdmin
    ? (selectedOrg?.name || profile?.org_name || profile?.company_name || 'Organization Workspace')
    : (profile?.org_name || profile?.company_name || profile?.name || 'My Organization');

  const tabs = [
    ...(isSuperAdmin ? [{ id: 'directory', label: 'All Organizations', icon: Users, badge: `${orgs.length}` }] : []),
    { id: 'general', label: 'Business Profile', icon: Building2 },
    { id: 'maps', label: 'Maps & Telematics', icon: MapIcon },
    { id: 'license', label: 'License & Quotas', icon: Shield },
    { id: 'security', label: 'Security & Access', icon: Lock },
    { id: 'audit', label: 'Audit Trail', icon: History }
  ];

  const handleSelectOrgFromDirectory = (orgId) => {
    setSelectedOrgId(orgId);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'directory':
        return (
          <OrgDirectoryTab
            orgs={orgs}
            onSelectOrg={handleSelectOrgFromDirectory}
            onTabChange={(tab) => setActiveTab(tab)}
            primaryColor={primaryColor}
          />
        );
      case 'general':
        return (
          <GeneralTab
            profile={profile}
            onSave={async (data) => {
              const res = await updateProfile(data);
              fetchOrgs();
              return res;
            }}
            onNextTab={() => setActiveTab('maps')}
          />
        );
      case 'maps':
        return (
          <MapsTab
            profile={profile}
            onSave={async (data) => {
              const res = await updateProfile(data);
              fetchOrgs();
              return res;
            }}
            onNextTab={() => setActiveTab('license')}
            onPrevTab={() => setActiveTab('general')}
          />
        );
      case 'license':
        return <LicenseTab license={license} profile={profile} dealerStats={dealerStats} />;
      case 'security':
        return <SecurityTab onChangePassword={changePassword} profile={profile} isSuperAdmin={isSuperAdmin} />;
      case 'audit':
        return <AuditTab orgId={activeOrgId} />;
      default:
        return (
          <GeneralTab
            profile={profile}
            onSave={updateProfile}
            onNextTab={() => setActiveTab('maps')}
          />
        );
    }
  };

  if (orgsLoading && !profile?.organization_id && !profile?.org_name) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[70vh] bg-[#F4F6F9]">
        <div className="relative">
          <div
            className="w-14 h-14 rounded-2xl animate-pulse flex items-center justify-center text-white shadow-lg"
            style={{ backgroundColor: primaryColor }}
          >
            <Building2 className="w-7 h-7" />
          </div>
          <Loader2 className="w-6 h-6 animate-spin absolute -bottom-2 -right-2" style={{ color: primaryColor }} />
        </div>
        <span className="text-sm font-bold text-slate-700 mt-4 tracking-wide">Loading Organization Profiles...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F6F9] pb-24">
      {/* Top Banner & Profile Header */}
      <div className="bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0A0F1D] text-white pt-8 pb-14 px-6 sm:px-8 lg:px-12 xl:px-16 border-b border-slate-800/80 relative overflow-hidden shadow-md w-full">
        {/* Ambient Decorative Background Glows */}
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-gradient-to-br from-white/5 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 left-10 w-96 h-96 bg-gradient-to-tr from-sky-500/10 to-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Micro Telematics Grid Overlay */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '24px 24px'
          }}
        />

        <div className="w-full relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-8">
          {/* Organization Identity */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {activeTab === 'directory' ? (
              <div className="w-24 h-24 rounded-3xl bg-slate-800/90 backdrop-blur-xl border-2 border-white/15 p-2.5 flex items-center justify-center shadow-2xl overflow-hidden">
                <div className="w-full h-full rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-inner">
                  <Building2 className="w-10 h-10 text-white" />
                </div>
              </div>
            ) : (
              <div className="relative group">
                <div className="w-24 h-24 rounded-3xl bg-slate-800/90 backdrop-blur-xl border-2 border-white/15 p-2.5 flex items-center justify-center shadow-2xl overflow-hidden transition-all duration-300">
                  {profile?.logo_url ? (
                    <img src={profile.logo_url} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <div
                      className="w-full h-full rounded-2xl flex items-center justify-center text-white font-black text-3xl shadow-inner"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {orgName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Status Badge */}
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-3 border-[#0F172A] shadow-md flex items-center justify-center text-white" title="Organization Active">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              </div>
            )}

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white m-0">
                  {activeTab === 'directory' ? 'Organization Workspace Suite' : orgName}
                </h1>

                <span
                  className="px-3 py-1 text-[11px] font-extrabold rounded-full border border-slate-700 bg-slate-800/80 text-white flex items-center gap-1.5 shadow-sm"
                >
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  {activeTab === 'directory' ? 'Client Directory' : (license?.type ? `${license.type} Fleet Tier` : 'Client Organization')}
                </span>

                <span className="px-2.5 py-1 text-[11px] font-semibold rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  {activeTab === 'directory' ? 'All Active' : 'Active Workspace'}
                </span>
              </div>

              <p className="text-xs sm:text-sm text-slate-300 mt-2 m-0 font-normal max-w-2xl leading-relaxed">
                {activeTab === 'directory'
                  ? 'Manage customer organizations, telematics map layers, vehicle quota allocations, and enterprise security credentials.'
                  : (profile?.address ? `${profile.address}, ${profile.city || ''}` : 'Manage organization telematics, map providers, vehicle quota limits, and security credentials.')}
              </p>

              <div className="flex flex-wrap items-center gap-3 mt-3.5">
                {activeTab === 'directory' ? (
                  <>
                    <span className="text-xs font-bold text-slate-300 bg-slate-800/70 px-3 py-1 rounded-xl border border-slate-700/60 font-medium">
                      {orgs.length} Client Organizations
                    </span>
                    <span className="text-xs font-bold text-slate-300 bg-slate-800/70 px-3 py-1 rounded-xl border border-slate-700/60 font-medium">
                      Multi-Tenant Fleet Control
                    </span>
                  </>
                ) : (
                  <>
                    {profile?.email && (
                      <span className="text-xs text-slate-300 bg-slate-800/70 px-3 py-1 rounded-xl border border-slate-700/60 font-medium">
                        {profile.email}
                      </span>
                    )}
                    {profile?.mobile && (
                      <span className="text-xs text-slate-300 bg-slate-800/70 px-3 py-1 rounded-xl border border-slate-700/60 font-medium">
                        {profile.mobile}
                      </span>
                    )}
                    {profile?.website && (
                      <a
                        href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-sky-400 hover:text-sky-300 bg-slate-800/70 px-3 py-1 rounded-xl border border-slate-700/60 font-medium flex items-center gap-1 transition-colors"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>{profile.website.replace(/^https?:\/\//, '')}</span>
                        <ExternalLink className="w-3 h-3 opacity-80" />
                      </a>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Super Admin Switcher & Live Stats */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {isSuperAdmin && (
              <div className="bg-slate-800/90 backdrop-blur-xl p-3 px-4 rounded-2xl border border-slate-700/80 shadow-lg flex items-center gap-3">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Switch Org:</span>
                {orgs.length > 0 ? (
                  <div className="relative">
                    <select
                      value={selectedOrgId || ''}
                      onChange={(e) => {
                        setSelectedOrgId(e.target.value);
                        if (activeTab === 'directory') setActiveTab('general');
                      }}
                      className="appearance-none bg-slate-900 text-white font-bold text-xs py-2 pl-3.5 pr-8 rounded-xl border border-slate-600 focus:outline-none cursor-pointer hover:border-slate-500 transition-colors"
                    >
                      {orgs.map(o => (
                        <option key={o.id} value={o.id}>
                          {o.name} ({o.vehicle_count || o.total_vehicles_count || 0} Vehs)
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">No organizations</span>
                )}
              </div>
            )}

            {/* Live Stats */}
            <div className="flex items-center gap-3 bg-slate-900/80 backdrop-blur-xl p-2.5 rounded-2xl border border-slate-700/70 shadow-xl">
              <div className="px-4 py-1.5 text-center">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Map Engine</div>
                <div className="font-black text-sm text-white mt-0.5">
                  {profile?.map_provider || 'OpenStreetMap'}
                </div>
              </div>
              <div className="h-8 w-px bg-slate-700/80" />
              <div className="px-4 py-1.5 text-center">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Time Zone</div>
                <div className="font-black text-sm mt-0.5" style={{ color: primaryColor }}>
                  {profile?.timezone || 'UTC'}
                </div>
              </div>
              <div className="h-8 w-px bg-slate-700/80" />
              <div className="px-4 py-1.5 text-center">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">License</div>
                <div className="font-black text-sm text-emerald-400 mt-0.5">
                  Active
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Clean Minimalist Horizontal Navigation Tabs Bar */}
      <div className="w-full px-6 sm:px-8 lg:px-12 xl:px-16 -mt-6 relative z-20">
        <div className="bg-white rounded-2xl p-1.5 shadow-sm border border-slate-200/90 flex items-center justify-between overflow-x-auto no-scrollbar gap-2 w-full">
          <div className="flex items-center gap-1.5 min-w-max">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={isActive ? { backgroundColor: primaryColor, color: '#ffffff' } : {}}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 ${
                    isActive
                      ? 'shadow-sm text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 stroke-[2.2] ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {isSuperAdmin && activeTab !== 'directory' && (
            <button
              type="button"
              onClick={() => setActiveTab('directory')}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3.5 py-2 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-1.5 flex-shrink-0"
            >
              <ArrowRight className="w-3.5 h-3.5 rotate-180 text-slate-400" />
              <span>Back to Directory</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area - Full Width Fluid Container */}
      <div className="w-full px-6 sm:px-8 lg:px-12 xl:px-16 mt-8">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default OrganizationProfilePage;
