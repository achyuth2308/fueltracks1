import React, { useState } from 'react';
import { useProfile } from './hooks/useProfile';
import GeneralTab from './components/GeneralTab';
import BrandingTab from './components/BrandingTab';
import MapsTab from './components/MapsTab';
import LicenseTab from './components/LicenseTab';
import SecurityTab from './components/SecurityTab';
import AuditTab from './components/AuditTab';
import { Building2, Image as ImageIcon, Map as MapIcon, Shield, Lock, History, Loader2 } from 'lucide-react';

const OrganizationProfilePage = () => {
  const { profile, license, loading, error, updateProfile, uploadImage, changePassword } = useProfile();
  const [activeTab, setActiveTab] = useState('general');

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-[#F6F8FB]">
        <Loader2 className="w-8 h-8 text-[#FF6A00] animate-spin" />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="p-6 text-center min-h-screen bg-[#F6F8FB]">
        <div className="bg-red-50 text-red-700 p-4 rounded-xl shadow-sm border border-red-100">Error loading profile: {error}</div>
      </div>
    );
  }

  const tabs = [
    { id: 'general', label: 'General', icon: Building2 },
    { id: 'branding', label: 'Branding', icon: ImageIcon },
    { id: 'maps', label: 'Maps', icon: MapIcon },
    { id: 'license', label: 'License Info', icon: Shield },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'audit', label: 'Audit', icon: History }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return <GeneralTab profile={profile} onSave={updateProfile} />;
      case 'branding':
        return <BrandingTab profile={profile} onUpload={uploadImage} onSave={updateProfile} />;
      case 'maps':
        return <MapsTab profile={profile} onSave={updateProfile} />;
      case 'license':
        return <LicenseTab license={license} />;
      case 'security':
        return <SecurityTab onChangePassword={changePassword} />;
      case 'audit':
        return <AuditTab />;
      default:
        return <GeneralTab profile={profile} onSave={updateProfile} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FB] p-[24px] !text-black">
      <div className="mb-8 mt-2">
        <h1 className="text-[32px] font-bold !text-black flex items-center gap-3 tracking-tight m-0">
          🏢 Organization Profile
        </h1>
        <p className="text-[15px] !text-black mt-2 max-w-3xl leading-relaxed m-0">
          Manage your organization's identity, branding, contact details, address, and administrative settings.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-[20px]">
        {/* Sidebar Navigation - 20% Width */}
        <div className="w-full lg:w-[20%] flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative w-full flex items-center px-4 py-3 mb-1 text-[14px] font-medium rounded-xl transition-all duration-200 overflow-hidden ${
                    isActive 
                      ? 'bg-[#FFF3EB] !text-black font-bold' 
                      : '!text-black hover:bg-[#F3F4F6] hover:!text-black'
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#FF6A00]" />
                  )}
                  <Icon className={`flex-shrink-0 mr-3 h-[20px] w-[20px] transition-colors ${isActive ? 'text-[#FF6A00]' : '!text-black'}`} />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Main Content Area - 80% Width (Splits into 55% and 25% relative to the page) */}
        <div className="w-full lg:w-[80%] flex-shrink-0">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default OrganizationProfilePage;
