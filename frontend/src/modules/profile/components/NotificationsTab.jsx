import React, { useState, useEffect } from 'react';
import { Save, Loader2, Bell, Smartphone, Mail, MessageSquare, RefreshCw, Layout, Activity } from 'lucide-react';

const SectionHeader = ({ icon: Icon, title, description, tint = 'bg-[#EFF6FF]', iconColor = 'text-[#2563EB]' }) => (
  <div className={`mb-5 pb-4 border-b border-[#E5E7EB] ${tint} -mx-[24px] px-[24px] -mt-[24px] pt-[24px] rounded-t-[14px]`}>
    <div className="flex items-center gap-3 mb-1">
      <div className={`p-2.5 bg-white rounded-xl shadow-sm flex items-center justify-center`}>
        <Icon className={`w-[22px] h-[22px] ${iconColor}`} />
      </div>
      <h3 className="text-[20px] font-semibold !text-black m-0">{title}</h3>
    </div>
    <p className="text-[14px] !text-black m-0 pl-[52px]">{description}</p>
  </div>
);

const ToggleSwitch = ({ name, label, description, icon: Icon, checked, onChange, iconBgClass, iconColorClass }) => (
  <div className="flex items-start p-[20px] border border-[#E5E7EB] rounded-[10px] bg-white shadow-sm mb-[16px] hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:border-[#D1D5DB] transition-all transform hover:-translate-y-[1px]">
    <div className="flex-shrink-0 mt-1 mr-4">
      <div className={`p-2.5 rounded-[10px] ${iconBgClass}`}>
        <Icon className={`w-[22px] h-[22px] ${iconColorClass}`} />
      </div>
    </div>
    <div className="flex-grow">
      <h4 className="text-[15px] font-semibold !text-black m-0 mb-1">{label}</h4>
      <p className="text-[13px] !text-black m-0 leading-relaxed font-medium">{description}</p>
    </div>
    <div className="flex-shrink-0 ml-4 mt-2">
      <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" name={name} checked={checked} onChange={onChange} className="sr-only peer" />
        <div className="w-11 h-6 bg-[#E5E7EB] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#E5E7EB] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2563EB]"></div>
      </label>
    </div>
  </div>
);

const NotificationsTab = ({ profile, onSave }) => {
  const initialData = {
    sms_enabled: profile?.sms_enabled || false,
    email_enabled: profile?.email_enabled || false,
    whatsapp_enabled: profile?.whatsapp_enabled || false,
    push_enabled: profile?.push_enabled || false,
  };

  const [formData, setFormData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const dirty = JSON.stringify(formData) !== JSON.stringify(initialData);
    setIsDirty(dirty);
  }, [formData, profile]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.checked });
  };

  const handleReset = () => {
    setFormData(initialData);
    setError('');
    setSuccess('');
    setIsDirty(false);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const res = await onSave(formData);

    if (res.success) {
      setSuccess('Notification settings updated successfully!');
      setIsDirty(false);
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(res.error || 'Failed to update notification settings');
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-[20px] items-start w-full relative pb-[100px]">

      {/* Main Content Area (~68% of the remaining 80% page space) */}
      <div className="w-full lg:w-[68%]">

        {/* Alerts */}
        {error && <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-[14px] text-[14px] mb-[20px] shadow-sm">{error}</div>}
        {success && <div className="p-4 bg-[#ECFDF5] border border-green-200 text-[#16A34A] rounded-[14px] text-[14px] mb-[20px] shadow-sm">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="bg-[#FFFFFF] p-[24px] pt-0 rounded-[14px] border border-[#E5E7EB] shadow-[0_6px_18px_rgba(15,23,42,0.05)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-shadow">
            <SectionHeader icon={Bell} title="Notification Channels" description="Configure how and where you receive critical alerts and system updates." />

            <div className="mt-[24px]">
              <ToggleSwitch
                name="email_enabled"
                label="Email Notifications"
                description="Receive alerts, reports, and system announcements directly to your registered email address. Best for daily summaries and reports."
                icon={Mail}
                checked={formData.email_enabled}
                onChange={handleChange}
                iconBgClass="bg-blue-50"
                iconColorClass="text-[#2563EB]"
              />
              <ToggleSwitch
                name="sms_enabled"
                label="SMS Notifications"
                description="Get critical alerts (like ignition events, geofence breaches, or SOS) delivered instantly via text message to primary contacts."
                icon={Smartphone}
                checked={formData.sms_enabled}
                onChange={handleChange}
                iconBgClass="bg-green-50"
                iconColorClass="text-[#16A34A]"
              />
              <ToggleSwitch
                name="whatsapp_enabled"
                label="WhatsApp Notifications"
                description="Receive automated alerts, tracking links, and driver communication directly on WhatsApp for immediate visibility."
                icon={MessageSquare}
                checked={formData.whatsapp_enabled}
                onChange={handleChange}
                iconBgClass="bg-emerald-50"
                iconColorClass="text-[#059669]"
              />
              <ToggleSwitch
                name="push_enabled"
                label="Mobile Push Notifications"
                description="Enable real-time push notifications for the FuelTracks mobile application for drivers and administrators."
                icon={Bell}
                checked={formData.push_enabled}
                onChange={handleChange}
                iconBgClass="bg-orange-50"
                iconColorClass="text-[#FF6A00]"
              />
            </div>
          </div>

          {/* Natural Actions */}
          <div className="flex justify-end gap-3 mt-6">

            <button
              type="submit"
              disabled={loading}
              className="px-6 h-[48px] flex items-center justify-center text-[15px] font-semibold text-white bg-gradient-to-r from-[#FF6A00] to-[#FF8A33] rounded-[10px] shadow-[0_4px_12px_rgba(255,106,0,0.3)] hover:shadow-[0_6px_16px_rgba(255,106,0,0.4)] transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {loading ? <Loader2 className="w-[20px] h-[20px] mr-2 animate-spin" /> : <Save className="w-[20px] h-[20px] mr-2" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>

      {/* Right Information Panel (~32% of the remaining 80% page space) */}
      <div className="w-full lg:w-[32%] flex-shrink-0">
        <div className="bg-[#FFFFFF] p-[24px] rounded-[14px] border border-[#E5E7EB] shadow-[0_6px_18px_rgba(15,23,42,0.05)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-shadow sticky top-[24px]">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#EFF6FF] -mx-[24px] px-[24px] -mt-[24px] pt-[20px] bg-[#EFF6FF] rounded-t-[14px]">
            <div className="p-1.5 bg-white rounded-lg shadow-sm">
              <Activity className="w-[18px] h-[18px] text-[#2563EB]" />
            </div>
            <h3 className="text-[16px] font-semibold !text-black m-0">Delivery Stats</h3>
          </div>

          <div className="space-y-4 mt-[16px]">
            <div className="p-4 bg-[#F9FAFB] rounded-[10px] border border-[#E5E7EB]">
              <div className="text-[13px] !text-black font-medium mb-1">Emails Delivered (30d)</div>
              <div className="text-[24px] font-bold !text-black">2,405</div>
            </div>
            <div className="p-4 bg-[#F9FAFB] rounded-[10px] border border-[#E5E7EB]">
              <div className="text-[13px] !text-black font-medium mb-1">SMS Sent (30d)</div>
              <div className="text-[24px] font-bold !text-black">842</div>
            </div>
            <div className="p-4 bg-[#F9FAFB] rounded-[10px] border border-[#E5E7EB]">
              <div className="text-[13px] !text-black font-medium mb-1">WhatsApp Messages (30d)</div>
              <div className="text-[24px] font-bold !text-black">1,150</div>
            </div>

            <p className="text-[13px] !text-black leading-relaxed pt-2">
              Notification delivery rates are calculated over the last 30 rolling days. Adjust your channels to ensure optimal alert visibility.
            </p>
          </div>
        </div>
      </div>

      {/* Dynamic Sticky Save Bar */}
      {isDirty && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-50 flex justify-center animate-in slide-in-from-bottom-full duration-300">
          <div className="max-w-[1200px] w-full flex flex-col sm:flex-row sm:items-center justify-between px-6 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#EFF6FF] rounded-full">
                <RefreshCw className="w-5 h-5 text-[#2563EB]" />
              </div>
              <div>
                <h4 className="text-[15px] font-semibold !text-black m-0">You have unsaved changes</h4>
                <p className="text-[14px] !text-black m-0">Please save or reset your changes.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">

              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="px-6 h-[48px] flex items-center text-[15px] font-semibold text-white bg-gradient-to-r from-[#FF6A00] to-[#FF8A33] rounded-[10px] shadow-[0_4px_12px_rgba(255,106,0,0.3)] hover:shadow-[0_6px_16px_rgba(255,106,0,0.4)] transform hover:-translate-y-0.5 transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-[20px] h-[20px] mr-2 animate-spin" /> : <Save className="w-[20px] h-[20px] mr-2" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsTab;