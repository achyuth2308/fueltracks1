import React, { useState, useEffect } from 'react';
import {
  Save, Loader2, Bell, Smartphone, Mail, MessageSquare,
  RefreshCw, CheckCircle2, ShieldAlert, Activity, ArrowRight
} from 'lucide-react';

const SectionHeader = ({ icon: Icon, title, description }) => (
  <div className="flex items-center gap-3.5 pb-4 mb-6 border-b border-slate-100">
    <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-xs">
      <Icon className="w-5 h-5 stroke-[2.2]" />
    </div>
    <div>
      <h3 className="text-base font-black uppercase tracking-wide m-0" style={{ color: '#0F172A' }}>{title}</h3>
      <p className="text-xs text-slate-600 font-semibold m-0 mt-0.5">{description}</p>
    </div>
  </div>
);

const ToggleSwitch = ({ name, label, description, icon: Icon, checked, onChange, primaryColor }) => (
  <div className="flex items-start p-5 border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-md hover:border-slate-300 transition-all">
    <div className="flex-shrink-0 mt-0.5 mr-4">
      <div className="p-2.5 rounded-xl bg-slate-100 text-slate-800 border border-slate-200/70">
        <Icon className="w-5 h-5" />
      </div>
    </div>
    <div className="flex-grow">
      <h4 className="text-sm font-black text-slate-900 m-0 mb-1" style={{ color: '#0F172A' }}>{label}</h4>
      <p className="text-xs text-slate-600 m-0 leading-relaxed font-semibold">{description}</p>
    </div>
    <div className="flex-shrink-0 ml-4 mt-1">
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          name={name}
          checked={checked}
          onChange={onChange}
          className="sr-only peer"
        />
        <div
          className={`w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${checked ? '' : 'bg-slate-200'}`}
          style={checked ? { backgroundColor: primaryColor || '#0284C7' } : {}}
        />
      </label>
    </div>
  </div>
);

const NotificationsTab = ({ profile, onSave }) => {
  const primaryColor = profile?.primary_color || '#0284C7';

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
    setFormData({
      sms_enabled: profile?.sms_enabled || false,
      email_enabled: profile?.email_enabled || false,
      whatsapp_enabled: profile?.whatsapp_enabled || false,
      push_enabled: profile?.push_enabled || false,
    });
  }, [profile]);

  useEffect(() => {
    const dirty = JSON.stringify(formData) !== JSON.stringify(initialData);
    setIsDirty(dirty);
  }, [formData]);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.checked }));
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const res = await onSave(formData);

    if (res.success) {
      setSuccess('Notification preferences updated successfully!');
      setIsDirty(false);
      setTimeout(() => setSuccess(''), 3500);
    } else {
      setError(res.error || 'Failed to update notification settings');
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col xl:flex-row gap-8 items-start w-full relative pb-28">
      {/* Main Form Content */}
      <div className="w-full xl:w-[65%] flex flex-col gap-6">
        {/* Alerts */}
        {error && (
          <div className="p-4 bg-red-50/90 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold shadow-sm flex items-center gap-3 animate-in fade-in">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0 animate-pulse" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="p-4 bg-emerald-50/90 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold shadow-sm flex items-center gap-3 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="bg-white p-7 rounded-3xl border border-slate-200/90 shadow-sm">
            <SectionHeader
              icon={Bell}
              title="Alert Channels & Notification Routing"
              description="Configure dispatch channels for real-time telemetry violations, fuel drops, and maintenance alerts."
            />

            <div className="space-y-4">
              <ToggleSwitch
                name="email_enabled"
                label="Email Notifications"
                description="Receive telemetry alerts, automated fleet reports, and compliance summaries directly to official email addresses."
                icon={Mail}
                checked={formData.email_enabled}
                onChange={handleChange}
                primaryColor={primaryColor}
              />
              <ToggleSwitch
                name="sms_enabled"
                label="SMS Priority Broadcasts"
                description="Instant text messages for SOS triggers, sudden fuel drains, tampering alerts, and critical geofence breaches."
                icon={Smartphone}
                checked={formData.sms_enabled}
                onChange={handleChange}
                primaryColor={primaryColor}
              />
              <ToggleSwitch
                name="whatsapp_enabled"
                label="WhatsApp Alerts & Live Tracking Links"
                description="Automated trip commencement notifications and live GPS tracking links delivered to registered WhatsApp contacts."
                icon={MessageSquare}
                checked={formData.whatsapp_enabled}
                onChange={handleChange}
                primaryColor={primaryColor}
              />
              <ToggleSwitch
                name="push_enabled"
                label="Mobile Device Push Notifications"
                description="Real-time push notifications on the FuelTracks mobile application for fleet managers and drivers."
                icon={Bell}
                checked={formData.push_enabled}
                onChange={handleChange}
                primaryColor={primaryColor}
              />
            </div>

            <div className="flex justify-end mt-7 pt-5 border-t border-slate-100">
              <button
                type="submit"
                disabled={loading}
                style={{ backgroundColor: primaryColor }}
                className="px-8 h-12 flex items-center justify-center text-xs font-extrabold text-white rounded-2xl shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Notification Preferences
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Right Information Panel */}
      <div className="w-full xl:w-[35%] flex flex-col gap-6 sticky top-8">
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-lg">
          <div className="flex items-center gap-3 pb-4 mb-5 border-b border-slate-100">
            <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-xs">
              <Activity className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 m-0" style={{ color: '#0F172A' }}>Dispatch Volume</h4>
              <span className="text-[11px] text-slate-500 font-semibold">Rolling 30-day activity</span>
            </div>
          </div>

          <div className="space-y-3.5">
            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-500 block mb-1">Emails Dispatched</span>
              <div className="text-2xl font-black text-slate-900">2,405</div>
              <span className="text-[11px] text-emerald-700 font-bold mt-0.5 block">99.8% Delivery Rate</span>
            </div>

            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-500 block mb-1">SMS Priority Alerts</span>
              <div className="text-2xl font-black" style={{ color: primaryColor }}>842</div>
              <span className="text-[11px] text-slate-600 font-semibold mt-0.5 block">Delivered via SMS Gateway</span>
            </div>

            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-500 block mb-1">WhatsApp Telematics Messages</span>
              <div className="text-2xl font-black text-slate-900">1,150</div>
              <span className="text-[11px] text-emerald-700 font-bold mt-0.5 block">Active WhatsApp Session</span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed pt-2 m-0 font-medium">
              Alert delivery metrics are computed across connected vehicles. Ensure at least one high-priority channel (SMS or WhatsApp) is enabled for urgent safety events.
            </p>
          </div>
        </div>
      </div>

      {/* Floating Save Toolbar */}
      {isDirty && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 p-3.5 px-6 rounded-2xl shadow-2xl z-50 flex items-center gap-6 animate-in slide-in-from-bottom-6 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full animate-ping" style={{ backgroundColor: primaryColor }} />
            <span className="text-xs font-extrabold text-white">Unsaved notification changes</span>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            style={{ backgroundColor: primaryColor }}
            className="px-5 h-9 flex items-center justify-center text-xs font-black text-white rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationsTab;