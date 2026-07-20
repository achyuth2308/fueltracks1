import React, { useState, useEffect } from 'react';
import { 
  Settings, Save, AlertCircle, CheckCircle2, 
  Gauge, TrendingUp, TrendingDown, Timer, 
  ParkingCircle, WifiOff, MapPin, Shield, ShieldAlert, PowerOff, Navigation, BellOff
} from 'lucide-react';
import api from '../../api/axios';

const SettingsAdminPage = () => {
  const [settings, setSettings] = useState({
    overspeedThreshold: '60',
    upperSpeed: '30',
    lowerSpeed: '22',
    idleThreshold: '5',
    parkedThreshold: '30',
    unreachableTime: '5',
    notifyOverspeed: false,
    notifyStop: false,
    notifyGeofence: false,
    notifySafezoneEntry: false,
    notifySafezoneExit: false,
    notifyPowerDown: false,
    notifyDestination: false,
    notifyPrivacy: false
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/settings');
      if (res.data.success && res.data.data) {
        setSettings(prev => ({ ...prev, ...res.data.data }));
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);
      const res = await api.put('/admin/settings', settings);
      if (res.data.success) {
        setMessage({ type: 'success', text: 'Settings saved successfully.' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      setMessage({ type: 'error', text: 'Failed to save settings.' });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const handleToggle = (name) => {
    setSettings(prev => {
      const updated = { ...prev, [name]: !prev[name] };
      return updated;
    });
  };

  if (loading) {
    return (
      <div style={{ padding: '32px', background: '#F1F5F9', minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#64748B' }}>Loading settings...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', background: '#F1F5F9', minHeight: '100vh', boxSizing: 'border-box', color: '#1E293B', fontFamily: 'Inter, sans-serif' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: '#0F172A' }}>Alert Settings</h1>
        {message && (
          <span style={{ 
            fontSize: '14px', fontWeight: 500, 
            color: message.type === 'success' ? '#059669' : '#DC2626',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {message.text}
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gap: '24px', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', width: '100%' }}>
        
        {/* Thresholds Card */}
        <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Gauge size={24} color="#0284C7" />
                <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#0F172A', margin: 0 }}>Alert Thresholds</h2>
              </div>
              <p style={{ margin: 0, fontSize: '14px', color: '#64748B', maxWidth: '250px', lineHeight: 1.5 }}>
                Configure numeric thresholds for generating alerts
              </p>
            </div>
            <button 
              onClick={handleSave}
              disabled={saving}
              style={{
                background: '#0284C7', color: '#fff', border: 'none', borderRadius: '8px',
                padding: '10px 16px', fontSize: '14px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s',
                opacity: saving ? 0.7 : 1
              }}
            >
              <Save size={16} />
              Save Changes
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <ThresholdInput 
              icon={<Gauge size={20} color="#EF4444" />}
              iconBg="#FEE2E2"
              title="Overspeed Limit"
              desc="Maximum allowed speed before alert triggers"
              name="overspeedThreshold"
              value={settings.overspeedThreshold}
              onChange={handleChange}
              unit="km/h"
            />
            
            <div style={{ height: '1px', background: '#E2E8F0' }}></div>
            
            <ThresholdInput 
              icon={<TrendingUp size={20} color="#F97316" />}
              iconBg="#FFEDD5"
              title="Upper Speed Indication"
              desc="Speed threshold for high speed warning"
              name="upperSpeed"
              value={settings.upperSpeed}
              onChange={handleChange}
              unit="km/h"
            />
            
            <div style={{ height: '1px', background: '#E2E8F0' }}></div>
            
            <ThresholdInput 
              icon={<TrendingDown size={20} color="#3B82F6" />}
              iconBg="#DBEAFE"
              title="Lower Speed Indication"
              desc="Speed threshold for low speed warning"
              name="lowerSpeed"
              value={settings.lowerSpeed}
              onChange={handleChange}
              unit="km/h"
            />

            <div style={{ height: '1px', background: '#E2E8F0' }}></div>
            
            <ThresholdInput 
              icon={<Timer size={20} color="#EAB308" />}
              iconBg="#FEF9C3"
              title="Stoppage Time"
              desc="Duration before stoppage alert triggers"
              name="idleThreshold"
              value={settings.idleThreshold}
              onChange={handleChange}
              unit="mins"
            />

            <div style={{ height: '1px', background: '#E2E8F0' }}></div>
            
            <ThresholdInput 
              icon={<ParkingCircle size={20} color="#10B981" />}
              iconBg="#D1FAE5"
              title="Parked Time"
              desc="Duration before parked alert triggers"
              name="parkedThreshold"
              value={settings.parkedThreshold}
              onChange={handleChange}
              unit="mins"
            />

            <div style={{ height: '1px', background: '#E2E8F0' }}></div>
            
            <ThresholdInput 
              icon={<WifiOff size={20} color="#64748B" />}
              iconBg="#F1F5F9"
              title="Unreachable Time"
              desc="Duration before unreachable alert triggers"
              name="unreachableTime"
              value={settings.unreachableTime}
              onChange={handleChange}
              unit="mins"
            />

          </div>
        </div>

        {/* Notifications Card */}
        <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <AlertCircle size={24} color="#0284C7" />
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#0F172A', margin: 0 }}>Notification Settings</h2>
          </div>
          <p style={{ margin: 0, marginBottom: '24px', fontSize: '14px', color: '#64748B' }}>
            Toggle notifications on/off - changes are saved automatically
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <ToggleRow 
              icon={<Gauge size={20} color="#EF4444" />}
              iconBg="#FEE2E2"
              title="Overspeed Notification"
              desc="Notify when vehicle exceeds speed limit"
              checked={settings.notifyOverspeed}
              onChange={() => { handleToggle('notifyOverspeed'); handleSave(); }}
            />
            
            <div style={{ height: '1px', background: '#E2E8F0' }}></div>

            <ToggleRow 
              icon={<Timer size={20} color="#EAB308" />}
              iconBg="#FEF9C3"
              title="Stop Notification"
              desc="Notify when vehicle stops for extended period"
              checked={settings.notifyStop}
              onChange={() => { handleToggle('notifyStop'); handleSave(); }}
            />

            <div style={{ height: '1px', background: '#E2E8F0' }}></div>

            <ToggleRow 
              icon={<MapPin size={20} color="#10B981" />}
              iconBg="#D1FAE5"
              title="Geofence Notification"
              desc="Notify on geofence entry or exit"
              checked={settings.notifyGeofence}
              onChange={() => { handleToggle('notifyGeofence'); handleSave(); }}
            />

            <div style={{ height: '1px', background: '#E2E8F0' }}></div>

            <ToggleRow 
              icon={<Shield size={20} color="#3B82F6" />}
              iconBg="#DBEAFE"
              title="Safezone Entry Notification"
              desc="Notify when vehicle enters a safezone"
              checked={settings.notifySafezoneEntry}
              onChange={() => { handleToggle('notifySafezoneEntry'); handleSave(); }}
            />

            <div style={{ height: '1px', background: '#E2E8F0' }}></div>

            <ToggleRow 
              icon={<ShieldAlert size={20} color="#F97316" />}
              iconBg="#FFEDD5"
              title="Safezone Exit Notification"
              desc="Notify when vehicle exits a safezone"
              checked={settings.notifySafezoneExit}
              onChange={() => { handleToggle('notifySafezoneExit'); handleSave(); }}
            />

            <div style={{ height: '1px', background: '#E2E8F0' }}></div>

            <ToggleRow 
              icon={<PowerOff size={20} color="#EF4444" />}
              iconBg="#FEE2E2"
              title="Power Down Notification"
              desc="Notify when device loses power"
              checked={settings.notifyPowerDown}
              onChange={() => { handleToggle('notifyPowerDown'); handleSave(); }}
            />

            <div style={{ height: '1px', background: '#E2E8F0' }}></div>

            <ToggleRow 
              icon={<Navigation size={20} color="#A855F7" />}
              iconBg="#F3E8FF"
              title="Destination Notification"
              desc="Notify when vehicle reaches destination"
              checked={settings.notifyDestination}
              onChange={() => { handleToggle('notifyDestination'); handleSave(); }}
            />

            <div style={{ height: '1px', background: '#E2E8F0' }}></div>

            <ToggleRow 
              icon={<BellOff size={20} color="#64748B" />}
              iconBg="#F1F5F9"
              title="Privacy Mode"
              desc="Disable all tracking notifications"
              checked={settings.notifyPrivacy}
              onChange={() => { handleToggle('notifyPrivacy'); handleSave(); }}
            />

          </div>
        </div>

      </div>
    </div>
  );
};

const ThresholdInput = ({ icon, iconBg, title, desc, name, value, onChange, unit }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flex: 1 }}>
      <div style={{ 
        width: '40px', height: '40px', borderRadius: '10px', background: iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', shrink: 0
      }}>
        {icon}
      </div>
      <div>
        <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A', margin: '0 0 4px 0' }}>{title}</h3>
        <p style={{ fontSize: '13px', color: '#64748B', margin: 0, lineHeight: 1.4 }}>{desc}</p>
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <input
        type="number"
        name={name}
        value={value}
        onChange={onChange}
        style={{
          width: '70px', padding: '8px 12px', borderRadius: '8px', 
          background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#0F172A',
          fontSize: '15px', textAlign: 'center', outline: 'none'
        }}
      />
      <span style={{ fontSize: '14px', color: '#475569', width: '36px' }}>{unit}</span>
    </div>
  </div>
);

const ToggleRow = ({ icon, iconBg, title, desc, checked, onChange }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flex: 1 }}>
      <div style={{ 
        width: '40px', height: '40px', borderRadius: '10px', background: iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', shrink: 0
      }}>
        {icon}
      </div>
      <div>
        <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A', margin: '0 0 4px 0' }}>{title}</h3>
        <p style={{ fontSize: '13px', color: '#64748B', margin: 0, lineHeight: 1.4 }}>{desc}</p>
      </div>
    </div>
    <div 
      onClick={onChange}
      style={{
        width: '44px', height: '24px', borderRadius: '12px',
        background: checked ? '#0284C7' : '#E2E8F0',
        position: 'relative', cursor: 'pointer', transition: 'background 0.3s'
      }}
    >
      <div style={{
        width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
        position: 'absolute', top: '3px', left: checked ? '23px' : '3px',
        transition: 'left 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }} />
    </div>
  </div>
);

export default SettingsAdminPage;
