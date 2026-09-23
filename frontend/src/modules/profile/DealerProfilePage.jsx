import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from './hooks/useProfile';
import * as profileApi from './api/profileApi';
import DealerDirectoryTab from './components/DealerDirectoryTab';
import WhiteLabelTab from './components/WhiteLabelTab';
import DealerContactTab from './components/DealerContactTab';
import DealerQuotaTab from './components/DealerQuotaTab';
import SecurityTab from './components/SecurityTab';
import AuditTab from './components/AuditTab';
import {
  Building2, Palette, Shield, Lock, History, Loader2,
  BarChart3, Sparkles, ChevronDown, Check, UserCheck, Globe, Users,
  CheckCircle2, ExternalLink, ArrowRight, Layers, Smartphone, ShieldCheck,
  Copy, Camera, Upload, Award, Activity
} from 'lucide-react';

const DealerProfilePage = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin';

  // Dealers list for Super Admin dropdown & directory
  const [dealers, setDealers] = useState([]);
  const [dealersLoading, setDealersLoading] = useState(isSuperAdmin);
  const [selectedDealerId, setSelectedDealerId] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState(isSuperAdmin ? 'directory' : 'whitelabel');
  const heroLogoInputRef = useRef(null);

  // Fetch dealers if Super Admin
  const fetchDealers = async () => {
    if (!isSuperAdmin) return;
    setDealersLoading(true);
    try {
      const res = await profileApi.getDealers();
      if (res.success && res.data?.length > 0) {
        setDealers(res.data);
        if (!selectedDealerId) {
          setSelectedDealerId(res.data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load dealers list:', err);
    } finally {
      setDealersLoading(false);
    }
  };

  useEffect(() => {
    fetchDealers();
  }, [isSuperAdmin]);

  // Target orgId: for Super Admin it's selectedDealerId, for Dealer it's their own orgId
  const activeOrgId = isSuperAdmin ? selectedDealerId : (user?.org_id || user?.orgId);

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

  const selectedDealer = dealers.find(d => d.id === selectedDealerId);
  const primaryColor = profile?.primary_color || selectedDealer?.primary_color || '#0284C7';
  const activeName = isSuperAdmin
    ? (selectedDealer?.brand_name || selectedDealer?.name || profile?.brand_name || profile?.org_name || 'Dealer Workspace')
    : (profile?.brand_name || profile?.org_name || user?.orgName || 'My Dealership');

  const activeSubdomain = profile?.subdomain || selectedDealer?.subdomain;

  const handleCopySubdomain = () => {
    if (!activeSubdomain) return;
    const url = `https://${activeSubdomain}.fueltracks.com/login`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleHeroLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadImage('logo', file);
    fetchDealers();
  };

  // Tab definitions with clean, minimalist theme
  const tabs = [
    ...(isSuperAdmin ? [{ id: 'directory', label: 'All Dealers', icon: Users, badge: `${dealers.length}` }] : []),
    { id: 'whitelabel', label: 'White-Label Branding', icon: Palette },
    { id: 'contact', label: 'Business & Contacts', icon: Building2 },
    { id: 'quota', label: 'Quotas & Fleet', icon: BarChart3 },
    { id: 'security', label: 'Security & Access', icon: Lock },
    { id: 'audit', label: 'Audit Trail', icon: History }
  ];

  const handleSelectDealerFromDirectory = (dealerId) => {
    setSelectedDealerId(dealerId);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'directory':
        return (
          <DealerDirectoryTab
            dealers={dealers}
            onSelectDealer={handleSelectDealerFromDirectory}
            onTabChange={(tab) => setActiveTab(tab)}
          />
        );
      case 'whitelabel':
        return (
          <WhiteLabelTab
            profile={profile}
            onSave={async (data) => {
              const res = await updateProfile(data);
              fetchDealers();
              return res;
            }}
            onUploadImage={async (type, file) => {
              const res = await uploadImage(type, file);
              fetchDealers();
              return res;
            }}
            onNextTab={() => setActiveTab('contact')}
          />
        );
      case 'contact':
        return (
          <DealerContactTab
            profile={profile}
            onSave={async (data) => {
              const res = await updateProfile(data);
              fetchDealers();
              return res;
            }}
            onNextTab={() => setActiveTab('quota')}
            onPrevTab={() => setActiveTab('whitelabel')}
          />
        );
      case 'quota':
        return <DealerQuotaTab license={license} dealerStats={dealerStats} profile={profile} />;
      case 'security':
        return <SecurityTab onChangePassword={changePassword} profile={profile} isSuperAdmin={isSuperAdmin} />;
      case 'audit':
        return <AuditTab orgId={activeOrgId} />;
      default:
        return (
          <WhiteLabelTab
            profile={profile}
            onSave={updateProfile}
            onUploadImage={uploadImage}
            onNextTab={() => setActiveTab('contact')}
          />
        );
    }
  };

  if (dealersLoading && !profile?.organization_id && !profile?.org_name) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[70vh]">
        <div className="relative">
          <div
            className="w-14 h-14 rounded-2xl animate-pulse flex items-center justify-center text-white shadow-lg"
            style={{ backgroundColor: primaryColor }}
          >
            <Building2 className="w-7 h-7" />
          </div>
          <Loader2 className="w-6 h-6 animate-spin absolute -bottom-2 -right-2" style={{ color: primaryColor }} />
        </div>
        <span className="text-sm font-bold text-slate-700 mt-4 tracking-wide">Loading Dealership Profile Studio...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F6F9] pb-24">
      {/* Hidden file input for hero avatar */}
      <input
        type="file"
        ref={heroLogoInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleHeroLogoUpload}
      />

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
          {/* Dealership Profile Identity */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {activeTab === 'directory' ? (
              <div className="w-24 h-24 rounded-3xl bg-slate-800/90 backdrop-blur-xl border-2 border-white/15 p-2.5 flex items-center justify-center shadow-2xl overflow-hidden">
                <div className="w-full h-full rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-inner">
                  <Sparkles className="w-10 h-10 text-white" />
                </div>
              </div>
            ) : (
              /* Avatar / Logo with direct hover upload */
              <div className="relative group cursor-pointer" onClick={() => heroLogoInputRef.current?.click()} title="Click to upload/change logo">
                <div className="w-24 h-24 rounded-3xl bg-slate-800/90 backdrop-blur-xl border-2 border-white/15 p-2.5 flex items-center justify-center shadow-2xl overflow-hidden transition-all duration-300 group-hover:scale-105">
                  {profile?.logo_url ? (
                    <img src={profile.logo_url} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <div
                      className="w-full h-full rounded-2xl flex items-center justify-center text-white font-black text-3xl shadow-inner"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {activeName.slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  {/* Hover overlay with Camera */}
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs rounded-3xl opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all duration-200">
                    <Camera className="w-6 h-6 text-white mb-1" />
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">Change</span>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-3 border-[#0F172A] shadow-md flex items-center justify-center text-white" title="Dealership Active">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              </div>
            )}

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white m-0 flex items-center gap-3">
                  {activeTab === 'directory' ? 'Dealership White-Label Suite' : activeName}
                </h1>

                <span
                  className="px-3 py-1 text-[11px] font-extrabold rounded-full border border-slate-700 bg-slate-800/80 text-white flex items-center gap-1.5 shadow-sm"
                >
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  {activeTab === 'directory' ? 'Enterprise Network' : (isSuperAdmin ? 'Partner Dealership' : 'Authorized Dealership')}
                </span>

                <span className="px-2.5 py-1 text-[11px] font-semibold rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  {activeTab === 'directory' ? 'Ecosystem Active' : 'Online'}
                </span>
              </div>

              <p className="text-xs sm:text-sm text-slate-300 mt-2 m-0 font-normal max-w-2xl leading-relaxed">
                {activeTab === 'directory'
                  ? 'Manage authorized dealership partner portals, custom domain routes, white-label color palettes, and vehicle quotas.'
                  : (profile?.brand_tagline || 'Advanced Fleet Telematics, Fuel Tracking & Sensor Intelligence Hub')}
              </p>

              {/* Quick Subdomain / Info Pills */}
              <div className="flex flex-wrap items-center gap-3 mt-3.5">
                {activeTab === 'directory' ? (
                  <>
                    <span className="text-xs font-bold text-slate-300 bg-slate-800/70 px-3 py-1 rounded-xl border border-slate-700/60">
                      {dealers.length} Authorized Dealerships
                    </span>
                    <span className="text-xs font-bold text-slate-300 bg-slate-800/70 px-3 py-1 rounded-xl border border-slate-700/60">
                      Global White-Label Management
                    </span>
                  </>
                ) : (
                  <>
                    {activeSubdomain ? (
                      <div className="flex items-center gap-2 bg-slate-800/80 backdrop-blur-md px-3 py-1 rounded-xl border border-slate-700/80 text-xs">
                        <Globe className="w-3.5 h-3.5 text-sky-400" />
                        <a
                          href={`https://${activeSubdomain}.fueltracks.com/login`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-300 hover:text-sky-200 font-semibold flex items-center gap-1 transition-colors"
                        >
                          {activeSubdomain}.fueltracks.com
                          <ExternalLink className="w-3 h-3 opacity-80" />
                        </a>
                        <button
                          type="button"
                          onClick={handleCopySubdomain}
                          className="text-slate-400 hover:text-white ml-1 p-0.5 rounded transition-colors"
                          title="Copy Portal Link"
                        >
                          {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 flex items-center gap-1.5 bg-slate-800/50 px-3 py-1 rounded-xl border border-slate-700/50">
                        <Globe className="w-3.5 h-3.5 text-slate-500" />
                        Subdomain pending setup
                      </span>
                    )}

                    {profile?.email && (
                      <span className="text-xs text-slate-400 bg-slate-800/50 px-3 py-1 rounded-xl border border-slate-700/50">
                        {profile.email}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Metrics & Super Admin Switcher */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {isSuperAdmin && (
              <div className="bg-slate-800/90 backdrop-blur-xl p-3 px-4 rounded-2xl border border-slate-700/80 shadow-lg flex items-center gap-3">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Switch Dealer:</span>
                {dealers.length > 0 ? (
                  <div className="relative">
                    <select
                      value={selectedDealerId || ''}
                      onChange={(e) => {
                        setSelectedDealerId(e.target.value);
                        if (activeTab === 'directory') setActiveTab('whitelabel');
                      }}
                      className="appearance-none bg-slate-900 text-white font-bold text-xs py-2 pl-3.5 pr-8 rounded-xl border border-slate-600 focus:outline-none cursor-pointer hover:border-slate-500 transition-colors"
                    >
                      {dealers.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.brand_name || d.name} ({d.total_vehicles_count || 0} Vehs)
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">No dealers</span>
                )}
              </div>
            )}

            {/* High-End Glassmorphism Metric Cards */}
            <div className="flex items-center gap-3 bg-slate-900/80 backdrop-blur-xl p-2.5 rounded-2xl border border-slate-700/70 shadow-xl">
              {activeTab === 'directory' ? (
                <>
                  <div className="px-4 py-1.5 text-center">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Dealers</div>
                    <div className="font-black text-lg text-white mt-0.5">{dealers.length}</div>
                  </div>
                  <div className="h-8 w-px bg-slate-700/80" />
                  <div className="px-4 py-1.5 text-center">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Issued</div>
                    <div className="font-black text-lg text-white mt-0.5">
                      {dealers.reduce((acc, d) => {
                        if (typeof d.device_limits === 'object' && d.device_limits !== null) {
                          return acc + Object.values(d.device_limits).reduce((sum, v) => sum + (parseInt(v, 10) || 0), 0);
                        }
                        return acc + (typeof d.device_limits === 'number' ? d.device_limits : 0);
                      }, 0)}
                    </div>
                  </div>
                  <div className="h-8 w-px bg-slate-700/80" />
                  <div className="px-4 py-1.5 text-center">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">In Use</div>
                    <div className="font-black text-lg text-emerald-400 mt-0.5">
                      {dealers.reduce((acc, d) => acc + (parseInt(d.total_vehicles_count, 10) || 0), 0)}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="px-4 py-1.5 text-center">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Licenses Issued</div>
                    <div className="font-black text-lg text-white mt-0.5">
                      {(() => {
                        if (license?.total !== undefined && license?.total !== null) return license.total;
                        const target = selectedDealer || profile;
                        if (target?.device_limits && typeof target.device_limits === 'object') {
                          return Object.values(target.device_limits).reduce((sum, v) => sum + (parseInt(v, 10) || 0), 0);
                        }
                        return typeof target?.device_limits === 'number' ? target.device_limits : 0;
                      })()}
                    </div>
                  </div>
                  <div className="h-8 w-px bg-slate-700/80" />
                  <div className="px-4 py-1.5 text-center">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">In Use</div>
                    <div className="font-black text-lg text-white mt-0.5">
                      {license?.used !== undefined ? license.used : (dealerStats?.total_vehicles_count || selectedDealer?.total_vehicles_count || 0)}
                    </div>
                  </div>
                  <div className="h-8 w-px bg-slate-700/80" />
                  <div className="px-4 py-1.5 text-center">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Available</div>
                    <div className="font-black text-lg text-emerald-400 mt-0.5">
                      {license?.available !== undefined ? license.available : (() => {
                        const target = selectedDealer || profile;
                        const issued = target?.device_limits && typeof target.device_limits === 'object'
                          ? Object.values(target.device_limits).reduce((sum, v) => sum + (parseInt(v, 10) || 0), 0)
                          : (typeof target?.device_limits === 'number' ? target.device_limits : 0);
                        const used = dealerStats?.total_vehicles_count || selectedDealer?.total_vehicles_count || 0;
                        return Math.max(0, issued - used);
                      })()}
                    </div>
                  </div>
                </>
              )}
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
              const activeBg = tab.id === 'directory' ? '#0F172A' : (primaryColor || '#0284C7');
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={isActive ? { backgroundColor: activeBg, color: '#ffffff' } : {}}
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

export default DealerProfilePage;


