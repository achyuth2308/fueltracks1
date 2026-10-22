import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, Loader2, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronRight, Search, Mail, MessageSquare,
  Send, MessageCircle, Wind, Activity, Truck, Clock, Power,
  Compass, Thermometer, MapPin, Disc, Gauge, Cpu, Shield,
  AlertOctagon, Fuel, Eye, Video, Check
} from 'lucide-react';
import * as adminApi from '../../api/adminApi';

// Exact 20 Categories matching requirements
const ALERT_DEFINITIONS = [
  // Flat Telemetry Alerts (1 to 9)
  { id: 'air_conditioner', sno: 1, name: 'Air Conditioner', isGroup: false, icon: Wind },
  { id: 'distance_covered', sno: 2, name: 'Distance Covered', isGroup: false, icon: Activity },
  { id: 'fms', sno: 3, name: 'FMS', isGroup: false, icon: Truck },
  { id: 'idle', sno: 4, name: 'Idle', isGroup: false, icon: Clock },
  { id: 'ignition', sno: 5, name: 'Ignition', isGroup: false, icon: Power },
  { id: 'route_deviation', sno: 6, name: 'Route Deviation', isGroup: false, icon: Compass },
  { id: 'temperature', sno: 7, name: 'Temperature', isGroup: false, icon: Thermometer },
  { id: 'track_alert', sno: 8, name: 'Track Alert', isGroup: false, icon: MapPin },
  { id: 'tyre_pressure', sno: 9, name: 'Tyre Pressure', isGroup: false, icon: Disc },

  // Expandable Groups (10 to 20)
  {
    id: 'parking', sno: 10, name: 'Parking', isGroup: true, icon: Clock,
    subAlerts: [
      { id: 'parking', name: 'Parking' },
      { id: 'safety_parking', name: 'Safety Parking' }
    ]
  },
  {
    id: 'overspeed', sno: 11, name: 'Overspeed', isGroup: true, icon: Gauge,
    subAlerts: [
      { id: 'overspeed', name: 'Overspeed' },
      { id: 'max_overspeed', name: 'Max Overspeed' }
    ]
  },
  {
    id: 'moving', sno: 12, name: 'Moving', isGroup: true, icon: Activity,
    subAlerts: [
      { id: 'start_moving', name: 'Start Moving' },
      { id: 'unauthorised_movement', name: 'Unauthorised Movement' },
      { id: 'non_moving', name: 'Non Moving' }
    ]
  },
  {
    id: 'device_alerts', sno: 13, name: 'Device Alerts', isGroup: true, icon: Cpu,
    subAlerts: [
      { id: 'back_to_online', name: 'Back To Online' },
      { id: 'vehicle_status', name: 'Vehicle Status' },
      { id: 'vehicle_offline', name: 'Vehicle Offline' }
    ]
  },
  {
    id: 'location_alerts', sno: 14, name: 'Location Alerts', isGroup: true, icon: MapPin,
    subAlerts: [
      { id: 'area_entry_exit_state_level', name: 'Area Entry/Exit State Level' },
      { id: 'area_entry_exit_district_level', name: 'Area Entry/Exit District Level' },
      { id: 'area_entry_exit_city_level', name: 'Area Entry/Exit City Level' }
    ]
  },
  {
    id: 'adas', sno: 15, name: 'ADAS', isGroup: true, icon: Shield,
    subAlerts: [
      { id: 'adas_forward_collision_warning', name: 'Forward Collision Warning' },
      { id: 'adas_lane_departure_warning', name: 'Lane Departure Warning' },
      { id: 'adas_headway_monitoring_warning', name: 'Headway Monitoring Warning' }
    ]
  },
  {
    id: 'geofence', sno: 16, name: 'Geofence', isGroup: true, icon: Compass,
    subAlerts: [
      { id: 'site_entry_or_site_alert', name: 'Site Entry or Site Alert' },
      { id: 'site_exit', name: 'Site Exit' },
      { id: 'site_stoppage', name: 'Site Stoppage' },
      { id: 'back_to_site', name: 'Back To Site' },
      { id: 'not_reached_geofence', name: 'Not Reached Geofence' }
    ]
  },
  {
    id: 'alarm', sno: 17, name: 'Alarm', isGroup: true, icon: AlertOctagon,
    subAlerts: [
      { id: 'sos', name: 'SOS' },
      { id: 'low_battery', name: 'Low Battery' },
      { id: 'harsh_braking', name: 'Harsh Braking' },
      { id: 'shock', name: 'Shock' },
      { id: 'power_cut_off', name: 'Power Cut Off' }
    ]
  },
  {
    id: 'fuel', sno: 18, name: 'Fuel', isGroup: true, icon: Fuel,
    subAlerts: [
      { id: 'below_fuel', name: 'Below Fuel' },
      { id: 'fuel_fill', name: 'Fuel Fill' },
      { id: 'fuel_drop', name: 'Fuel Drop' },
      { id: 'daily_diesal_summary', name: 'Daily Diesal Summary' },
      { id: 'daily_summary', name: 'Daily Summary' },
      { id: 'fuel_alarm', name: 'Fuel Alarm' },
      { id: 'excess_fuel_consumption', name: 'Excess Fuel Consumption' },
      { id: 'tamper_alert', name: 'Tamper Alert' }
    ]
  },
  {
    id: 'dms', sno: 19, name: 'DMS', isGroup: true, icon: Eye,
    subAlerts: [
      { id: 'eye_closed', name: 'DMS Eye Closed' },
      { id: 'distraction', name: 'DMS Distraction' },
      { id: 'yawn', name: 'DMS Yawn' },
      { id: 'smoking', name: 'DMS Smoking' },
      { id: 'phone_calling', name: 'DMS Phone Calling' },
      { id: 'missing_face', name: 'DMS Missing Face' },
      { id: 'monitoring_shelter', name: 'DMS Monitoring Shelter' },
      { id: 'calibration_fail', name: 'DMS Calibration Fail' },
      { id: 'look_down', name: 'DMS Look Down' }
    ]
  },
  {
    id: 'dashcam', sno: 20, name: 'Dashcam', isGroup: true, icon: Video,
    subAlerts: [
      { id: 'vibration', name: 'Vibration' },
      { id: 'sdcard_cant_recognized', name: 'SDCard Cant Recognized' },
      { id: 'harsh_acceleration', name: 'Harsh Acceleration' },
      { id: 'harsh_turning', name: 'Harsh Turning' },
      { id: 'collision', name: 'Collision' },
      { id: 'oil_electronics_connected', name: 'Oil Electronics Connected' },
      { id: 'oil_electronics_disconnected', name: 'Oil Electronics Disconnected' },
      { id: 'fatigue_driving', name: 'Fatigue Driving' },
      { id: 'sdcard_mount', name: 'SDCard Mount' },
      { id: 'fuel_stolen', name: 'Fuel Stolen' },
      { id: 'fuel_data_timeout', name: 'Fuel Data Timeout' },
      { id: 'temperature_data_timeout', name: 'Temperature Data Timeout' },
      { id: 'rfid_reading', name: 'RFID Reading' },
      { id: 'sdcard_capacity_not_enough', name: 'SDCard Capacity Not Enough' },
      { id: 'seat_belt_plugged', name: 'Seat Belt Plugged' },
      { id: 'seat_belt_unplugged', name: 'Seat Belt Unplugged' },
      { id: 'door_closed', name: 'Door Closed' },
      { id: 'door_opened', name: 'Door Opened' }
    ]
  }
];

const CHANNELS = [
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'sms', label: 'SMS', icon: MessageSquare },
  { key: 'telegram', label: 'Telegram', icon: Send },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle }
];

// Minimal iOS-style Toggle Switch
const ToggleSwitch = ({ checked, onChange, title }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    title={title}
    onClick={(e) => {
      e.stopPropagation();
      onChange(!checked);
    }}
    style={{
      width: '36px',
      height: '20px',
      borderRadius: '10px',
      background: checked ? '#f97316' : '#e2e8f0',
      border: 'none',
      cursor: 'pointer',
      padding: '2px',
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      transition: 'background 0.2s ease',
      outline: 'none'
    }}
  >
    <span
      style={{
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        background: '#ffffff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        transform: checked ? 'translateX(16px)' : 'translateX(0)',
        transition: 'transform 0.2s ease',
        display: 'block'
      }}
    />
  </button>
);

export default function EditOrgAlertsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [org, setOrg] = useState(null);
  const [alertMatrix, setAlertMatrix] = useState({});
  const [expandedGroups, setExpandedGroups] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch Organization & Hydrate Matrix
  useEffect(() => {
    const fetchOrg = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await adminApi.getOrgById(id);
        if (res.success && res.data) {
          setOrg(res.data);
          const savedMatrix = res.data.settings?.alert_matrix || {};
          setAlertMatrix(savedMatrix);
        } else {
          setError('Organization record not found.');
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load organization alert preferences.');
      } finally {
        setLoading(false);
      }
    };

    fetchOrg();
  }, [id]);

  // Toggle single cell
  const handleToggle = (alertKey, channelKey) => {
    setAlertMatrix(prev => {
      const current = prev[alertKey] || {};
      const nextVal = !current[channelKey];
      return {
        ...prev,
        [alertKey]: {
          ...current,
          [channelKey]: nextVal
        }
      };
    });
  };

  // Toggle all sub-alerts in a category for a specific channel
  const handleToggleCategoryChannel = (categoryDef, channelKey) => {
    setAlertMatrix(prev => {
      const keys = categoryDef.isGroup
        ? categoryDef.subAlerts.map(sub => `${categoryDef.id}_${sub.id}`)
        : [categoryDef.id];

      const allActive = keys.every(k => !!(prev[k] && prev[k][channelKey]));
      const targetState = !allActive;

      const nextMatrix = { ...prev };
      keys.forEach(k => {
        nextMatrix[k] = {
          ...(nextMatrix[k] || {}),
          [channelKey]: targetState
        };
      });
      return nextMatrix;
    });
  };

  // Expand / Collapse all
  const handleToggleAllExpand = (expand) => {
    const nextState = {};
    ALERT_DEFINITIONS.forEach(def => {
      if (def.isGroup) nextState[def.id] = expand;
    });
    setExpandedGroups(nextState);
  };

  // Toggle column globally across all alerts
  const handleToggleGlobalChannel = (channelKey) => {
    setAlertMatrix(prev => {
      let anyDisabled = false;
      ALERT_DEFINITIONS.forEach(def => {
        const keys = def.isGroup
          ? def.subAlerts.map(s => `${def.id}_${s.id}`)
          : [def.id];

        keys.forEach(k => {
          if (!prev[k] || !prev[k][channelKey]) anyDisabled = true;
        });
      });

      const target = anyDisabled;
      const nextMatrix = { ...prev };
      ALERT_DEFINITIONS.forEach(def => {
        const keys = def.isGroup
          ? def.subAlerts.map(s => `${def.id}_${s.id}`)
          : [def.id];

        keys.forEach(k => {
          nextMatrix[k] = {
            ...(nextMatrix[k] || {}),
            [channelKey]: target
          };
        });
      });
      return nextMatrix;
    });
  };

  // Save changes
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const currentSettings = org?.settings || {};
      const res = await adminApi.updateOrg(id, {
        settings: {
          ...currentSettings,
          alert_matrix: alertMatrix
        }
      });

      if (res.success) {
        setSuccess('Alert preferences saved successfully.');
        if (res.data) setOrg(res.data);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(res.error || 'Failed to update alert preferences.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Server error while saving preferences.');
    } finally {
      setSaving(false);
    }
  };

  // Filter definitions
  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return ALERT_DEFINITIONS;
    const q = searchQuery.toLowerCase().trim();
    return ALERT_DEFINITIONS.filter(def => {
      const matchName = def.name.toLowerCase().includes(q);
      const matchSub = def.subAlerts?.some(s => s.name.toLowerCase().includes(q));
      return matchName || matchSub;
    });
  }, [searchQuery]);

  // Count active triggers
  const activeCount = useMemo(() => {
    let count = 0;
    Object.values(alertMatrix).forEach(channels => {
      if (channels && typeof channels === 'object') {
        CHANNELS.forEach(ch => {
          if (channels[ch.key]) count++;
        });
      }
    });
    return count;
  }, [alertMatrix]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '12px' }}>
        <Loader2 size={24} color="#f97316" className="animate-spin" />
        <span style={{ fontSize: '13px', color: '#64748b' }}>Loading alert settings...</span>
      </div>
    );
  }

  const orgName = org?.name || 'Organization';

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* Clean Minimal Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '20px',
        marginBottom: '20px',
        borderBottom: '1px solid #e2e8f0',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <button
            type="button"
            onClick={() => navigate('/admin/organizations')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'none',
              border: 'none',
              color: '#64748b',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              padding: 0,
              marginBottom: '6px'
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#f97316'}
            onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
          >
            <ArrowLeft size={14} />
            <span>Back to Organizations</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Alert Notifications
            </h1>
            <span style={{
              fontSize: '12px',
              fontWeight: 600,
              padding: '2px 10px',
              borderRadius: '12px',
              background: '#fff7ed',
              color: '#ea580c',
              border: '1px solid #fed7aa'
            }}>
              {orgName}
            </span>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              ({activeCount} active triggers)
            </span>
          </div>
        </div>

        {/* Top Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => navigate('/admin/organizations')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#475569',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 20px',
              borderRadius: '8px',
              background: '#f97316',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s ease',
              opacity: saving ? 0.7 : 1
            }}
            onMouseEnter={e => { if (!saving) e.currentTarget.style.background = '#ea580c'; }}
            onMouseLeave={e => { if (!saving) e.currentTarget.style.background = '#f97316'; }}
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {/* Status Feedback Alerts */}
      {error && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#dc2626',
          fontSize: '13px',
          fontWeight: 500,
          marginBottom: '16px'
        }}>
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '8px',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#16a34a',
          fontSize: '13px',
          fontWeight: 500,
          marginBottom: '16px'
        }}>
          <CheckCircle2 size={16} />
          <span>{success}</span>
        </div>
      )}

      {/* Minimal Filter & Search Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        {/* Compact Search */}
        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search alert..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 10px 7px 32px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              color: '#0f172a',
              outline: 'none',
              background: '#ffffff'
            }}
            onFocus={e => e.target.style.borderColor = '#f97316'}
            onBlur={e => e.target.style.borderColor = '#cbd5e1'}
          />
        </div>

        {/* Expand / Collapse Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => handleToggleAllExpand(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '4px 8px'
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#f97316'}
            onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
          >
            Expand All
          </button>
          <span style={{ color: '#cbd5e1' }}>•</span>
          <button
            type="button"
            onClick={() => handleToggleAllExpand(false)}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '4px 8px'
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#f97316'}
            onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Clean Minimal Matrix Card */}
      <div style={{
        background: '#ffffff',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{
                padding: '12px 18px',
                fontSize: '12px',
                fontWeight: 700,
                color: '#475569',
                width: '44%',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                Alert Event
              </th>

              {CHANNELS.map(ch => {
                const ChIcon = ch.icon;
                return (
                  <th
                    key={ch.key}
                    style={{
                      padding: '12px 14px',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#475569',
                      textAlign: 'center',
                      width: '14%',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                    onClick={() => handleToggleGlobalChannel(ch.key)}
                    title={`Click to toggle all ${ch.label} alerts`}
                  >
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      color: '#334155',
                      transition: 'color 0.15s ease'
                    }}
                      onMouseEnter={e => e.currentTarget.style.color = '#f97316'}
                      onMouseLeave={e => e.currentTarget.style.color = '#334155'}
                    >
                      <ChIcon size={13} color="#64748b" />
                      <span>{ch.label}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {filteredList.map((def, idx) => {
              const Icon = def.icon;
              const isGroup = def.isGroup;
              const isExpanded = !!expandedGroups[def.id];

              if (!isGroup) {
                // Flat alert (1 to 9)
                const cell = alertMatrix[def.id] || {};
                return (
                  <tr
                    key={def.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: idx % 2 === 1 ? '#fafafa' : '#ffffff',
                      transition: 'background 0.1s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fff7ed'}
                    onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 1 ? '#fafafa' : '#ffffff'}
                  >
                    <td style={{ padding: '11px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, width: '20px' }}>
                          {def.sno}
                        </span>
                        <div style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '6px',
                          background: '#f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#475569'
                        }}>
                          <Icon size={14} />
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                          {def.name}
                        </span>
                      </div>
                    </td>

                    {CHANNELS.map(ch => (
                      <td key={ch.key} style={{ padding: '11px 14px', textAlign: 'center' }}>
                        <ToggleSwitch
                          checked={!!cell[ch.key]}
                          onChange={() => handleToggle(def.id, ch.key)}
                          title={`${def.name} via ${ch.label}`}
                        />
                      </td>
                    ))}
                  </tr>
                );
              }

              // Group Header (10 to 20)
              return (
                <React.Fragment key={def.id}>
                  <tr
                    style={{
                      background: '#f8fafc',
                      borderBottom: '1px solid #e2e8f0',
                      borderTop: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      transition: 'background 0.1s'
                    }}
                    onClick={() => setExpandedGroups(prev => ({ ...prev, [def.id]: !prev[def.id] }))}
                    onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                    onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                  >
                    <td style={{ padding: '11px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, width: '20px' }}>
                          {def.sno}
                        </span>
                        <div style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '6px',
                          background: '#fed7aa',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ea580c'
                        }}>
                          <Icon size={14} />
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                          {def.name}
                        </span>
                        <span style={{
                          fontSize: '11px',
                          color: '#64748b',
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          padding: '1px 6px',
                          borderRadius: '10px',
                          fontWeight: 500
                        }}>
                          {def.subAlerts.length}
                        </span>
                        <span style={{ color: '#94a3b8', marginLeft: 'auto', marginRight: '8px' }}>
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                      </div>
                    </td>

                    {/* Category-Level Quick Toggles */}
                    {CHANNELS.map(ch => {
                      const allChecked = def.subAlerts.every(sub => {
                        const k = `${def.id}_${sub.id}`;
                        return !!(alertMatrix[k] && alertMatrix[k][ch.key]);
                      });

                      return (
                        <td
                          key={ch.key}
                          style={{ padding: '11px 14px', textAlign: 'center' }}
                          onClick={e => e.stopPropagation()}
                        >
                          <ToggleSwitch
                            checked={allChecked}
                            onChange={() => handleToggleCategoryChannel(def, ch.key)}
                            title={`Toggle all ${ch.label} in ${def.name}`}
                          />
                        </td>
                      );
                    })}
                  </tr>

                  {/* Sub-Alert Rows */}
                  {isExpanded && def.subAlerts.map((sub, sIdx) => {
                    const subKey = `${def.id}_${sub.id}`;
                    const cell = alertMatrix[subKey] || {};

                    return (
                      <tr
                        key={subKey}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          background: '#ffffff',
                          transition: 'background 0.1s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#fff7ed'}
                        onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
                      >
                        <td style={{ padding: '10px 18px 10px 58px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              width: '4px',
                              height: '4px',
                              borderRadius: '50%',
                              background: '#94a3b8'
                            }} />
                            <span style={{ fontSize: '12.5px', fontWeight: 500, color: '#334155' }}>
                              {sub.name}
                            </span>
                          </div>
                        </td>

                        {CHANNELS.map(ch => (
                          <td key={ch.key} style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <ToggleSwitch
                              checked={!!cell[ch.key]}
                              onChange={() => handleToggle(subKey, ch.key)}
                              title={`${sub.name} via ${ch.label}`}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Clean Bottom Save Row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '10px',
        marginTop: '20px'
      }}>
        <button
          type="button"
          onClick={() => navigate('/admin/organizations')}
          style={{
            padding: '8px 18px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#475569',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 24px',
            borderRadius: '8px',
            background: '#f97316',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 600,
            border: 'none',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1
          }}
          onMouseEnter={e => { if (!saving) e.currentTarget.style.background = '#ea580c'; }}
          onMouseLeave={e => { if (!saving) e.currentTarget.style.background = '#f97316'; }}
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          <span>{saving ? 'Saving...' : 'Save Changes'}</span>
        </button>
      </div>
    </div>
  );
}
