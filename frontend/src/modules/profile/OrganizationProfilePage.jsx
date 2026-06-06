import React, { useState } from 'react';
import { useProfile } from './hooks/useProfile';
import GeneralTab from './components/GeneralTab';
import BrandingTab from './components/BrandingTab';
import MapsTab from './components/MapsTab';
import NotificationsTab from './components/NotificationsTab';
import LicenseTab from './components/LicenseTab';
import SecurityTab from './components/SecurityTab';
import AuditTab from './components/AuditTab';
import { Building2, Image as ImageIcon, Map as MapIcon, Bell, Shield, Lock, History, Loader2 } from 'lucide-react';

const OrganizationProfilePage = () => {
  const { profile, license, loading, error, updateProfile, uploadImage, changePassword } = useProfile();
  const [activeTab, setActiveTab] = useState('general');

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full min-h-[400px]">
        <Loader2 className="w-8 h-8 text-[#FF6B00] animate-spin" />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="p-6 text-center">
        <div className="bg-red-50 text-red-700 p-4 rounded-md">Error loading profile: {error}</div>
      </div>
    );
  }

  const tabs = [
    { id: 'general', label: 'General', icon: Building2 },
    { id: 'branding', label: 'Branding', icon: ImageIcon },
    { id: 'notifications', label: 'Notifications', icon: Bell },
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
        return <BrandingTab profile={profile} onUpload={uploadImage} />;
      case 'notifications':
        return <NotificationsTab profile={profile} onSave={updateProfile} />;
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
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold !text-black">Organization Profile</h1>
        <p className="text-sm !text-black mt-1">Manage your organization's identity, branding, and system preferences.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${
                    isActive 
                      ? 'bg-[#FF6B00] text-white' 
                      : '!text-black hover:bg-gray-100'
                  }`}
                >
                  <Icon className={`flex-shrink-0 -ml-1 mr-3 h-5 w-5 ${isActive ? 'text-white' : '!text-black'}`} />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default OrganizationProfilePage;
