import React, { useState } from 'react';
import { Save, Loader2, Bell, Smartphone, Mail, MessageSquare } from 'lucide-react';

const NotificationsTab = ({ profile, onSave }) => {
  const [formData, setFormData] = useState({
    sms_enabled: profile?.sms_enabled || false,
    email_enabled: profile?.email_enabled || false,
    whatsapp_enabled: profile?.whatsapp_enabled || false,
    push_enabled: profile?.push_enabled || false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.checked });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    const res = await onSave(formData);

    if (res.success) {
      setSuccess('Notification settings updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(res.error || 'Failed to update notification settings');
    }
    setLoading(false);
  };

  const ToggleSwitch = ({ name, label, description, icon: Icon, checked }) => (
    <div className="flex items-start p-4 border border-slate-200 rounded-xl bg-white shadow-sm mb-4">
      <div className="flex-shrink-0 mt-1 mr-4" style={{ color: "#000000" }}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-grow">
        <h4 className="text-sm font-medium" style={{ color: "#000000", margin: 0 }}>{label}</h4>
        <p className="text-xs mt-1" style={{ color: "#000000", margin: 0 }}>{description}</p>
      </div>
      <div className="flex-shrink-0 ml-4 mt-1">
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" name={name} checked={checked} onChange={handleChange} className="sr-only peer" />
          <div className="w-11 h-6 bg-orange-50 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#f97316] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#f97316]"></div>
        </label>
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-10 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200">
      <div className="flex items-center mb-6">
        <Bell className="w-5 h-5 mr-2" style={{ color: "#000000" }} />
        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#000000", margin: 0, letterSpacing: "-0.01em" }}>Notification Settings</h2>
      </div>
      
      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md text-sm">{success}</div>}

      <div className="max-w-2xl">
        <ToggleSwitch 
          name="email_enabled" 
          label="Email Notifications" 
          description="Receive alerts, reports, and system announcements directly to your registered email address." 
          icon={Mail} 
          checked={formData.email_enabled} 
        />
        <ToggleSwitch 
          name="sms_enabled" 
          label="SMS Notifications" 
          description="Get critical alerts (like ignition events or SOS) delivered via text message." 
          icon={Smartphone} 
          checked={formData.sms_enabled} 
        />
        <ToggleSwitch 
          name="whatsapp_enabled" 
          label="WhatsApp Notifications" 
          description="Receive automated alerts and tracking links directly on WhatsApp." 
          icon={MessageSquare} 
          checked={formData.whatsapp_enabled} 
        />
        <ToggleSwitch 
          name="push_enabled" 
          label="Mobile Push Notifications" 
          description="Enable push notifications for the FuelTracks mobile application." 
          icon={Bell} 
          checked={formData.push_enabled} 
        />
      </div>

      <div className="mt-8 flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center px-4 py-2 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 shadow-[0_4px_12px_rgba(249,115,22,0.3)] transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#f97316] disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Changes
        </button>
      </div>
    </form>
  );
};

export default NotificationsTab;
