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
    <div className="flex items-start p-4 border border-black rounded-lg bg-white mb-4">
      <div className="flex-shrink-0 mt-1 mr-4 !text-black">
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-grow">
        <h4 className="text-sm font-medium !text-black">{label}</h4>
        <p className="text-xs !text-black mt-1">{description}</p>
      </div>
      <div className="flex-shrink-0 ml-4 mt-1">
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" name={name} checked={checked} onChange={handleChange} className="sr-only peer" />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#f97316] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-black !text-black placeholder-black after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#f97316]"></div>
        </label>
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-sm">
      <div className="flex items-center mb-6">
        <Bell className="w-5 h-5 !text-black mr-2" />
        <h3 className="text-lg font-semibold !text-black">Notification Settings</h3>
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
          className="flex items-center px-4 py-2 bg-[#f97316] text-white rounded-md hover:bg-[#7ea0b6] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#f97316] disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Changes
        </button>
      </div>
    </form>
  );
};

export default NotificationsTab;
