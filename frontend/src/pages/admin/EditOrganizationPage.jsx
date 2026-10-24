import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Home, ChevronRight, Loader2, AlertTriangle, CheckCircle, Save, ArrowLeft,
  Building2, Bell, Fuel, MessageSquare, Radio, Shield, MapPin, Send, HelpCircle,
  Thermometer, Clock, FileText, Sliders, Info
} from 'lucide-react';
import * as adminApi from '../../api/adminApi';
import { useAuth } from '../../hooks/useAuth';

// FuelTracks Design System Theme Tokens
const inputBaseStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: '10px',
  border: '1px solid #cbd5e1',
  fontSize: '13px',
  fontWeight: 600,
  outline: 'none',
  color: '#0f172a',
  background: '#ffffff',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  fontFamily: 'inherit'
};

const labelStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '12.5px',
  fontWeight: 700,
  color: '#334155',
  marginBottom: '6px'
};

const InputField = ({ label, required, type = "text", value, onChange, disabled, placeholder, focused, onFocus, onBlur }) => (
  <div style={{ display: 'flex', flexDirection: 'column' }}>
    <label style={labelStyle}>
      <span>{label}</span>
      {required && <span style={{ color: '#ef4444' }}>*</span>}
    </label>
    <input
      type={type}
      value={value ?? ''}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      onFocus={onFocus}
      onBlur={onBlur}
      style={{
        ...inputBaseStyle,
        background: disabled ? '#f8fafc' : '#ffffff',
        borderColor: focused ? '#f97316' : '#cbd5e1',
        boxShadow: focused ? '0 0 0 3px rgba(249, 115, 22, 0.15)' : 'none',
        color: disabled ? '#64748b' : '#0f172a',
        cursor: disabled ? 'not-allowed' : 'text'
      }}
    />
  </div>
);

const SelectField = ({ label, value, onChange, options = [], placeholder = "-- Select --", includeEmpty = true }) => (
  <div style={{ display: 'flex', flexDirection: 'column' }}>
    <label style={labelStyle}>{label}</label>
    <select
      value={value ?? ''}
      onChange={onChange}
      style={{
        ...inputBaseStyle,
        cursor: 'pointer',
        background: '#ffffff'
      }}
    >
      {includeEmpty && <option value="">{placeholder}</option>}
      {options.map((opt, i) => {
        const val = typeof opt === 'object' ? opt.value : opt;
        const lbl = typeof opt === 'object' ? opt.label : opt;
        return (
          <option key={i} value={val}>{lbl}</option>
        );
      })}
    </select>
  </div>
);

// FuelTracks Branded Pill Toggle (Matching FuelTracks theme)
const PillToggle = ({ label, active, onChange, tooltip, infoTooltip }) => {
  const isYes = active === 'YES' || active === true;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', minHeight: '44px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>{label}</span>
        {tooltip && (
          <span
            title={tooltip}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: '#e0f2fe',
              color: '#0284c7',
              fontSize: '10.5px',
              fontWeight: 800,
              cursor: 'help'
            }}
          >
            ?
          </span>
        )}
        {infoTooltip && (
          <span
            title={infoTooltip}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: '#ffedd5',
              color: '#ea580c',
              fontSize: '11px',
              fontWeight: 800,
              fontStyle: 'italic',
              cursor: 'help'
            }}
          >
            i
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange(isYes ? 'NO' : 'YES')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexDirection: isYes ? 'row' : 'row-reverse',
          width: '74px',
          height: '30px',
          padding: '2px 4px',
          borderRadius: '9999px',
          border: isYes ? '1px solid #ea580c' : '1px solid #94a3b8',
          background: isYes ? '#f97316' : '#64748b',
          color: '#ffffff',
          cursor: 'pointer',
          transition: 'all 0.18s ease',
          fontSize: '11px',
          fontWeight: 800,
          boxShadow: isYes ? '0 2px 6px rgba(249, 115, 22, 0.3)' : '0 1px 3px rgba(0,0,0,0.1)',
          flexShrink: 0
        }}
      >
        <span style={{
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          background: '#ffffff',
          display: 'block',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)'
        }} />
        <span style={{ padding: '0 6px', letterSpacing: '0.04em' }}>
          {isYes ? 'YES' : 'NO'}
        </span>
      </button>
    </div>
  );
};

// Section Header matching FuelTracks Dark Navy + Orange Brand Theme
const SectionTitle = ({ id, title, icon: Icon }) => (
  <div id={id} style={{
    margin: '36px 0 20px 0',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  }}>
    <div style={{ width: '4px', height: '20px', background: '#f97316', borderRadius: '2px' }} />
    {Icon && <Icon size={18} color="#f97316" />}
    <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>
      {title}
    </h3>
  </div>
);

const EditOrganizationPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [focusedField, setFocusedField] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [fleetosEmail, setFleetosEmail] = useState('');
  const [showGeofencesInWeb, setShowGeofencesInWeb] = useState('NO');

  // Alert Configuration
  const [parkingAlert, setParkingAlert] = useState('NO');
  const [parkDurationMins, setParkDurationMins] = useState('60');
  const [idleAlert, setIdleAlert] = useState('NO');
  const [idleDurationMins, setIdleDurationMins] = useState('60');
  const [overspeedAlert, setOverspeedAlert] = useState('NO');
  const [overspeedAlertDurationMins, setOverspeedAlertDurationMins] = useState('');
  const [unauthorisedMovementAlert, setUnauthorisedMovementAlert] = useState('NO');
  const [noDataDuration, setNoDataDuration] = useState('6 hrs');
  const [sosAlert, setSosAlert] = useState('NO');
  const [powerCutOffAlarmDurationMins, setPowerCutOffAlarmDurationMins] = useState('');
  const [harshBreakingAlert, setHarshBreakingAlert] = useState('NO');
  const [routeDeviationMeters, setRouteDeviationMeters] = useState('');
  const [dailySummary, setDailySummary] = useState('NO');
  const [tripPlannedTime, setTripPlannedTime] = useState('NO');
  const [towingAlert, setTowingAlert] = useState('NO');
  const [towingMinutes, setTowingMinutes] = useState('00:00');
  const [tamperAlert, setTamperAlert] = useState('NO');
  const [nonMovingAlert, setNonMovingAlert] = useState('NO');
  const [distanceCoveredAlert, setDistanceCoveredAlert] = useState('NO');

  // Fuel Alerts Configuration
  const [dailyDieselSummary, setDailyDieselSummary] = useState('NO');
  const [fuelLevelBelow, setFuelLevelBelow] = useState('NO');
  const [fuelAlarm, setFuelAlarm] = useState('NO');
  const [fuelNotificationAlert, setFuelNotificationAlert] = useState('Always');
  const [excessConsumptionFilter, setExcessConsumptionFilter] = useState('NO');
  const [geofenceFuelAlert, setGeofenceFuelAlert] = useState('Both');
  const [instantFuelAlerts, setInstantFuelAlerts] = useState('NO');
  const [ongoingFuelAlerts, setOngoingFuelAlerts] = useState('NO');
  const [fuelFillTheftAlert, setFuelFillTheftAlert] = useState('NO');
  const [verifiedFuelFillTheftAlert, setVerifiedFuelFillTheftAlert] = useState('YES');

  // SMS Alerts Configuration
  const [smsSender, setSmsSender] = useState('FUELTK');
  const [smsProvider, setSmsProvider] = useState('TextLocal');
  const [textLocalSmsKey, setTextLocalSmsKey] = useState('');
  const [smsEntityName, setSmsEntityName] = useState('-FUELTRACKS');
  const [providerUserName, setProviderUserName] = useState('');
  const [providerPassword, setProviderPassword] = useState('');
  const [smsPattern, setSmsPattern] = useState('');
  const [smsEscalation, setSmsEscalation] = useState('NO');

  // Geofence Configuration
  const [schoolGeofence, setSchoolGeofence] = useState('NO');
  const [backToGeofence, setBackToGeofence] = useState('NO');
  const [notInGeofenceAreaAlert, setNotInGeofenceAreaAlert] = useState('NO');
  const [geofenceImmobilizer, setGeofenceImmobilizer] = useState('NO');
  const [sendGeofenceSms, setSendGeofenceSms] = useState('');
  const [selectedGeofence, setSelectedGeofence] = useState('');
  const [geofenceEnabled, setGeofenceEnabled] = useState('NO');
  const [geofenceNotification, setGeofenceNotification] = useState('Both');

  // WhatsApp, Telegram, RFID Configuration
  const [whatsappNotification, setWhatsappNotification] = useState('NO');
  const [telegramNotification, setTelegramNotification] = useState('NO');
  const [isRfid, setIsRfid] = useState('NO');

  // Other Details
  const [sendDataToGovernmentIp, setSendDataToGovernmentIp] = useState('NO');
  const [deleteHistoryEod, setDeleteHistoryEod] = useState('NO');
  const [salesEmail, setSalesEmail] = useState('no');

  // Temperature Sensor Configuration
  const [temperatureAlarm, setTemperatureAlarm] = useState('NO');
  const [temperatureNoDataDuration, setTemperatureNoDataDuration] = useState('');

  // Shift Timing Configuration
  const [shiftDetails, setShiftDetails] = useState('NO');

  // Reports Timing Configuration
  const [reportsDetails, setReportsDetails] = useState('NO');

  // Load Organization Data
  useEffect(() => {
    const loadOrg = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await adminApi.getOrgById(id);
        if (res.success && res.data) {
          const org = res.data;
          const s = org.settings || {};

          setName(org.name || '');
          setEmail(org.email || org.primary_user_email || '');
          setPhone(org.phone || org.primary_user_phone || '');
          setDescription(s.description || org.address || '');
          setFleetosEmail(s.fleetos_email || '');
          setShowGeofencesInWeb(s.show_geofences_in_web || 'NO');

          // Alert Config
          setParkingAlert(s.parking_alert || 'NO');
          setParkDurationMins(s.park_duration_mins || '');
          setIdleAlert(s.idle_alert || 'NO');
          setIdleDurationMins(s.idle_duration_mins || '');
          setOverspeedAlert(s.overspeed_alert || 'NO');
          setOverspeedAlertDurationMins(s.overspeed_alert_duration_mins || '');
          setUnauthorisedMovementAlert(s.unauthorised_movement_alert || 'NO');
          setNoDataDuration(s.no_data_duration || '6 hrs');
          setSosAlert(s.sos_alert || 'NO');
          setPowerCutOffAlarmDurationMins(s.power_cut_off_alarm_duration_mins || '');
          setHarshBreakingAlert(s.harsh_breaking_alert || 'NO');
          setRouteDeviationMeters(s.route_deviation_meters || '');
          setDailySummary(s.daily_summary || 'NO');
          setTripPlannedTime(s.trip_planned_time || 'NO');
          setTowingAlert(s.towing_alert || 'NO');
          setTowingMinutes(s.towing_minutes || '00:00');
          setTamperAlert(s.tamper_alert || 'NO');
          setNonMovingAlert(s.non_moving_alert || 'NO');
          setDistanceCoveredAlert(s.distance_covered_alert || 'NO');

          // Fuel Alerts
          setDailyDieselSummary(s.daily_diesel_summary || 'NO');
          setFuelLevelBelow(s.fuel_level_below || 'NO');
          setFuelAlarm(s.fuel_alarm || 'NO');
          setFuelNotificationAlert(s.fuel_notification_alert || 'Always');
          setExcessConsumptionFilter(s.excess_consumption_filter || 'NO');
          setGeofenceFuelAlert(s.geofence_fuel_alert || 'Both');
          setInstantFuelAlerts(s.instant_fuel_alerts || 'NO');
          setOngoingFuelAlerts(s.ongoing_fuel_alerts || 'NO');
          setFuelFillTheftAlert(s.fuel_fill_theft_alert || 'NO');
          setVerifiedFuelFillTheftAlert(s.verified_fuel_fill_theft_alert || 'YES');

          // SMS Alerts
          setSmsSender(s.sms_sender || 'FUELTK');
          setSmsProvider(s.sms_provider || 'TextLocal');
          setTextLocalSmsKey(s.text_local_sms_key || '');
          setSmsEntityName(s.sms_entity_name || '-FUELTRACKS');
          setProviderUserName(s.provider_user_name || '');
          setProviderPassword(s.provider_password || '');
          setSmsPattern(s.sms_pattern || '');
          setSmsEscalation(s.sms_escalation || 'NO');

          // Geofence Configuration
          setSchoolGeofence(s.school_geofence || 'NO');
          setBackToGeofence(s.back_to_geofence || 'NO');
          setNotInGeofenceAreaAlert(s.not_in_geofence_area_alert || 'NO');
          setGeofenceImmobilizer(s.geofence_immobilizer || 'NO');
          setSendGeofenceSms(s.send_geofence_sms || '');
          setSelectedGeofence(s.selected_geofence || '');
          setGeofenceEnabled(s.geofence_enabled || 'NO');
          setGeofenceNotification(s.geofence_notification || 'Both');

          // WhatsApp, Telegram, RFID
          setWhatsappNotification(s.whatsapp_notification || 'NO');
          setTelegramNotification(s.telegram_notification || 'NO');
          setIsRfid(s.is_rfid || 'NO');

          // Other Details
          setSendDataToGovernmentIp(s.send_data_to_government_ip || 'NO');
          setDeleteHistoryEod(s.delete_history_eod || 'NO');
          setSalesEmail(s.sales_email || 'no');

          // Temperature Sensor Configuration
          setTemperatureAlarm(s.temperature_alarm || 'NO');
          setTemperatureNoDataDuration(s.temperature_no_data_duration || '');

          // Shift Timing Configuration
          setShiftDetails(s.shift_details || 'NO');

          // Reports Timing Configuration
          setReportsDetails(s.reports_details || 'NO');
        } else {
          setError('Organization details not found.');
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to fetch organization details.');
      } finally {
        setLoading(false);
      }
    };

    loadOrg();
  }, [id]);

  // Handle hash scroll (e.g. #alerts, #sms, #fuel)
  useEffect(() => {
    if (!loading && location.hash) {
      const elem = document.querySelector(location.hash);
      if (elem) {
        elem.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [loading, location.hash]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Organization name is required.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address: description.trim(),
      settings: {
        description: description.trim(),
        fleetos_email: fleetosEmail.trim(),
        show_geofences_in_web: showGeofencesInWeb,

        // Alert Configuration
        parking_alert: parkingAlert,
        park_duration_mins: parkDurationMins,
        idle_alert: idleAlert,
        idle_duration_mins: idleDurationMins,
        overspeed_alert: overspeedAlert,
        overspeed_alert_duration_mins: overspeedAlertDurationMins,
        unauthorised_movement_alert: unauthorisedMovementAlert,
        no_data_duration: noDataDuration,
        sos_alert: sosAlert,
        power_cut_off_alarm_duration_mins: powerCutOffAlarmDurationMins,
        harsh_breaking_alert: harshBreakingAlert,
        route_deviation_meters: routeDeviationMeters,
        daily_summary: dailySummary,
        trip_planned_time: tripPlannedTime,
        towing_alert: towingAlert,
        towing_minutes: towingMinutes,
        tamper_alert: tamperAlert,
        non_moving_alert: nonMovingAlert,
        distance_covered_alert: distanceCoveredAlert,

        // Fuel Alerts Configuration
        daily_diesel_summary: dailyDieselSummary,
        fuel_level_below: fuelLevelBelow,
        fuel_alarm: fuelAlarm,
        fuel_notification_alert: fuelNotificationAlert,
        excess_consumption_filter: excessConsumptionFilter,
        geofence_fuel_alert: geofenceFuelAlert,
        instant_fuel_alerts: instantFuelAlerts,
        ongoing_fuel_alerts: ongoingFuelAlerts,
        fuel_fill_theft_alert: fuelFillTheftAlert,
        verified_fuel_fill_theft_alert: verifiedFuelFillTheftAlert,

        // SMS Alerts Configuration
        sms_sender: smsSender,
        sms_provider: smsProvider,
        text_local_sms_key: textLocalSmsKey,
        sms_entity_name: smsEntityName,
        provider_user_name: providerUserName,
        provider_password: providerPassword,
        sms_pattern: smsPattern,
        sms_escalation: smsEscalation,

        // WhatsApp, Telegram, RFID
        whatsapp_notification: whatsappNotification,
        telegram_notification: telegramNotification,
        is_rfid: isRfid,

        // Geofence Configuration
        school_geofence: schoolGeofence,
        back_to_geofence: backToGeofence,
        not_in_geofence_area_alert: notInGeofenceAreaAlert,
        geofence_immobilizer: geofenceImmobilizer,
        send_geofence_sms: sendGeofenceSms,
        selected_geofence: selectedGeofence,
        geofence_enabled: geofenceEnabled,
        geofence_notification: geofenceNotification,

        // Other Details
        send_data_to_government_ip: sendDataToGovernmentIp,
        delete_history_eod: deleteHistoryEod,
        sales_email: salesEmail.trim(),

        // Temperature Sensor Configuration
        temperature_alarm: temperatureAlarm,
        temperature_no_data_duration: temperatureNoDataDuration,

        // Shift Timing Configuration
        shift_details: shiftDetails,

        // Reports Timing Configuration
        reports_details: reportsDetails
      }
    };

    try {
      const res = await adminApi.updateOrg(id, payload);
      if (res.success) {
        setSuccess('Organization details saved successfully!');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save organization records.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="pastel-page-bg" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <Loader2 size={36} color="#f97316" className="animate-spin" />
        <span style={{ fontSize: '14px', color: '#64748B', marginTop: '14px', fontWeight: 600 }}>Loading organization configuration...</span>
      </div>
    );
  }

  return (
    <div className="pastel-page-bg" style={{ padding: '24px 32px', minHeight: '100%', boxSizing: 'border-box' }}>
      
      {/* Top Header & Breadcrumbs matching FuelTracks UI */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => navigate('/admin/organizations')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              color: '#334155',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#f97316'; e.currentTarget.style.color = '#f97316'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#334155'; }}
          >
            <ArrowLeft size={16} />
            <span>Organizations</span>
          </button>

          <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
            Edit Organization
          </h1>

          {/* Breadcrumbs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '13px', fontWeight: 600 }}>
            <Home size={15} style={{ color: '#64748b' }} />
            <ChevronRight size={13} style={{ color: '#94a3b8' }} />
            <span
              onClick={() => navigate('/admin/organizations')}
              style={{ cursor: 'pointer', transition: 'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color = '#ea580c'}
              onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
            >
              Edit Organization
            </span>
            <ChevronRight size={13} style={{ color: '#94a3b8' }} />
            <span style={{ color: '#ea580c', fontWeight: 800 }}>{name || id}</span>
          </div>
        </div>

        {/* Top Save Button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 22px',
            background: '#f97316',
            color: '#ffffff',
            borderRadius: '10px',
            fontSize: '13.5px',
            fontWeight: 700,
            border: 'none',
            cursor: saving ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 12px rgba(249, 115, 22, 0.25)',
            transition: 'all 0.15s ease',
            opacity: saving ? 0.7 : 1
          }}
          onMouseEnter={e => { if (!saving) { e.currentTarget.style.background = '#ea580c'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
          onMouseLeave={e => { if (!saving) { e.currentTarget.style.background = '#f97316'; e.currentTarget.style.transform = 'none'; } }}
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          <span>{saving ? 'Saving...' : 'Save Organization'}</span>
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div style={{ padding: '14px 18px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', color: '#dc2626', marginBottom: '20px', fontSize: '13px', fontWeight: 700, boxShadow: '0 2px 4px rgba(220,38,38,0.06)' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div style={{ padding: '14px 18px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', color: '#059669', marginBottom: '20px', fontSize: '13px', fontWeight: 700, boxShadow: '0 2px 4px rgba(5,150,105,0.06)' }}>
          <CheckCircle size={18} />
          <span>{success}</span>
        </div>
      )}

      {/* Main Form White Card Container */}
      <form onSubmit={handleSubmit} style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '32px 36px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
        marginBottom: '40px'
      }}>

        {/* ============================================================ */}
        {/* SECTION 1: General                                           */}
        {/* ============================================================ */}
        <SectionTitle id="general" title="General" icon={Building2} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', columnGap: '32px', rowGap: '16px' }}>
          <InputField
            label="Organization Name"
            required={true}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. 0911220012"
            focused={focusedField === 'name'}
            onFocus={() => setFocusedField('name')}
            onBlur={() => setFocusedField(null)}
          />
          <InputField
            label="Email"
            required={true}
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="e.g. admin@example.com"
            focused={focusedField === 'email'}
            onFocus={() => setFocusedField('email')}
            onBlur={() => setFocusedField(null)}
          />
          <InputField
            label="Mobile Number"
            required={true}
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="e.g. 9440084781"
            focused={focusedField === 'phone'}
            onFocus={() => setFocusedField('phone')}
            onBlur={() => setFocusedField(null)}
          />
          <InputField
            label="Description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Description"
            focused={focusedField === 'description'}
            onFocus={() => setFocusedField('description')}
            onBlur={() => setFocusedField(null)}
          />
          <InputField
            label="FleetOS Email"
            type="email"
            value={fleetosEmail}
            onChange={e => setFleetosEmail(e.target.value)}
            placeholder="FleetOS Email"
            focused={focusedField === 'fleetosEmail'}
            onFocus={() => setFocusedField('fleetosEmail')}
            onBlur={() => setFocusedField(null)}
          />
          <PillToggle
            label="Show Geofences (In Web)"
            active={showGeofencesInWeb}
            onChange={setShowGeofencesInWeb}
          />
        </div>

        {/* ============================================================ */}
        {/* SECTION 2: Alert Configuration                               */}
        {/* ============================================================ */}
        <SectionTitle id="alerts" title="Alert Configuration" icon={Bell} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', columnGap: '32px', rowGap: '16px' }}>
          <PillToggle
            label="Parking Alert"
            active={parkingAlert}
            onChange={setParkingAlert}
          />
          <InputField
            label="Park Duration (Mins)"
            value={parkDurationMins}
            onChange={e => setParkDurationMins(e.target.value)}
            placeholder="60 (1 hr default)"
            focused={focusedField === 'parkDuration'}
            onFocus={() => setFocusedField('parkDuration')}
            onBlur={() => setFocusedField(null)}
          />

          <PillToggle
            label="Idle Alert"
            active={idleAlert}
            onChange={setIdleAlert}
          />
          <InputField
            label="Idle Duration (Mins)"
            value={idleDurationMins}
            onChange={e => setIdleDurationMins(e.target.value)}
            placeholder="60 (1 hr default)"
            focused={focusedField === 'idleDuration'}
            onFocus={() => setFocusedField('idleDuration')}
            onBlur={() => setFocusedField(null)}
          />

          <PillToggle
            label="OverSpeed Alert"
            active={overspeedAlert}
            onChange={setOverspeedAlert}
          />
          <InputField
            label="OverSpeed Alert Duration (Mins)"
            value={overspeedAlertDurationMins}
            onChange={e => setOverspeedAlertDurationMins(e.target.value)}
            placeholder="OverSpeed Alert Duration (Mins)"
            focused={focusedField === 'overspeedDuration'}
            onFocus={() => setFocusedField('overspeedDuration')}
            onBlur={() => setFocusedField(null)}
          />

          <PillToggle
            label="Unauthorised Movement Alert"
            active={unauthorisedMovementAlert}
            onChange={setUnauthorisedMovementAlert}
          />
          <SelectField
            label="No Data Duration"
            value={noDataDuration}
            onChange={e => setNoDataDuration(e.target.value)}
            options={['30 mins', '1 hr', '2 hrs', '6 hrs', '12 hrs', '24 hrs', '48 hrs']}
            placeholder="Select duration"
          />

          <PillToggle
            label="SOS Alert"
            active={sosAlert}
            onChange={setSosAlert}
          />
          <InputField
            label="Power Cut Off Alarm Duration (Mins)"
            value={powerCutOffAlarmDurationMins}
            onChange={e => setPowerCutOffAlarmDurationMins(e.target.value)}
            placeholder="Power Cut Off Alarm Duration (Mins)"
            focused={focusedField === 'powerCutOffDuration'}
            onFocus={() => setFocusedField('powerCutOffDuration')}
            onBlur={() => setFocusedField(null)}
          />

          <PillToggle
            label="Harsh Breaking Alert"
            active={harshBreakingAlert}
            onChange={setHarshBreakingAlert}
          />
          <SelectField
            label="Route Deviation (Meters)"
            value={routeDeviationMeters}
            onChange={e => setRouteDeviationMeters(e.target.value)}
            options={['50', '100', '200', '500', '1000', '2000']}
            placeholder="-- Select --"
          />

          <PillToggle
            label="Daily Summary"
            active={dailySummary}
            onChange={setDailySummary}
          />
          <PillToggle
            label="Trip Planned Time"
            active={tripPlannedTime}
            onChange={setTripPlannedTime}
          />

          <PillToggle
            label="Towing Alert"
            active={towingAlert}
            onChange={setTowingAlert}
          />
          <InputField
            label="Towing Minutes"
            value={towingMinutes}
            onChange={e => setTowingMinutes(e.target.value)}
            placeholder="00:00"
            focused={focusedField === 'towingMinutes'}
            onFocus={() => setFocusedField('towingMinutes')}
            onBlur={() => setFocusedField(null)}
          />

          <PillToggle
            label="Tamper Alert"
            active={tamperAlert}
            onChange={setTamperAlert}
          />
          <PillToggle
            label="Non Moving Alert"
            active={nonMovingAlert}
            onChange={setNonMovingAlert}
          />
          <PillToggle
            label="Distance Covered Alert"
            active={distanceCoveredAlert}
            onChange={setDistanceCoveredAlert}
          />
        </div>

        {/* ============================================================ */}
        {/* SECTION 3: Fuel Alerts Configuration                         */}
        {/* ============================================================ */}
        <SectionTitle id="fuel" title="Fuel Alerts Configuration" icon={Fuel} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', columnGap: '32px', rowGap: '16px' }}>
          <PillToggle
            label="Daily Diesel Summary"
            active={dailyDieselSummary}
            onChange={setDailyDieselSummary}
          />
          <PillToggle
            label="Fuel Level Below"
            active={fuelLevelBelow}
            onChange={setFuelLevelBelow}
          />

          <PillToggle
            label="Fuel Alarm"
            active={fuelAlarm}
            onChange={setFuelAlarm}
          />
          <SelectField
            label="Fuel Notification Alert"
            value={fuelNotificationAlert}
            onChange={e => setFuelNotificationAlert(e.target.value)}
            options={['Always', 'Idle/Parked']}
            includeEmpty={false}
          />

          <PillToggle
            label="Excess Consumption Filter"
            active={excessConsumptionFilter}
            onChange={setExcessConsumptionFilter}
          />
          <SelectField
            label="GeoFence Fuel Alert"
            value={geofenceFuelAlert}
            onChange={e => setGeofenceFuelAlert(e.target.value)}
            options={['Both', 'Site Inside', 'Site OutSide']}
            includeEmpty={false}
          />

          <PillToggle
            label="Instant Fuel Alerts"
            tooltip="Receive immediate telemetry triggers on abrupt fuel displacement"
            active={instantFuelAlerts}
            onChange={setInstantFuelAlerts}
          />
          <PillToggle
            label="Ongoing Fuel Alerts"
            tooltip="Continuous polling of erratic sensor fluctuations"
            active={ongoingFuelAlerts}
            onChange={setOngoingFuelAlerts}
          />

          <PillToggle
            label="Fuel Fill/Theft Alert"
            tooltip="Triggers when drastic fuel level surge or drop occurs"
            active={fuelFillTheftAlert}
            onChange={setFuelFillTheftAlert}
          />
          <PillToggle
            label="Verified Fuel Fill/Theft Alert"
            tooltip="Applies mathematical smoothing and anti-slosh filtering before alerting"
            active={verifiedFuelFillTheftAlert}
            onChange={setVerifiedFuelFillTheftAlert}
          />
        </div>

        {/* ============================================================ */}
        {/* SECTION 4: SMS Alerts Configuration                          */}
        {/* ============================================================ */}
        <SectionTitle id="sms" title="SMS Alerts Configuration" icon={MessageSquare} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', columnGap: '32px', rowGap: '16px' }}>
          <InputField
            label="SMS Sender"
            value={smsSender}
            onChange={e => setSmsSender(e.target.value)}
            placeholder="e.g. FUELTK"
            focused={focusedField === 'smsSender'}
            onFocus={() => setFocusedField('smsSender')}
            onBlur={() => setFocusedField(null)}
          />
          <SelectField
            label="SMS Provider"
            value={smsProvider}
            onChange={e => setSmsProvider(e.target.value)}
            options={['TextLocal', 'Fast2SMS', 'Twilio', 'Msg91', 'Other']}
            placeholder="Select Provider"
          />

          <InputField
            label="Text Local Sms Key"
            required={true}
            type="password"
            value={textLocalSmsKey}
            onChange={e => setTextLocalSmsKey(e.target.value)}
            placeholder="API / Auth Token"
            focused={focusedField === 'smsKey'}
            onFocus={() => setFocusedField('smsKey')}
            onBlur={() => setFocusedField(null)}
          />
          <InputField
            label="SMS Entity Name"
            required={true}
            value={smsEntityName}
            onChange={e => setSmsEntityName(e.target.value)}
            placeholder="e.g. -FUELTRACKS"
            focused={focusedField === 'smsEntity'}
            onFocus={() => setFocusedField('smsEntity')}
            onBlur={() => setFocusedField(null)}
          />

          <InputField
            label="Provider User Name"
            value={providerUserName}
            onChange={e => setProviderUserName(e.target.value)}
            placeholder="e.g. username / account email"
            focused={focusedField === 'providerUser'}
            onFocus={() => setFocusedField('providerUser')}
            onBlur={() => setFocusedField(null)}
          />
          <InputField
            label="Provider Password"
            type="password"
            value={providerPassword}
            onChange={e => setProviderPassword(e.target.value)}
            placeholder="••••••••"
            focused={focusedField === 'providerPass'}
            onFocus={() => setFocusedField('providerPass')}
            onBlur={() => setFocusedField(null)}
          />

          <SelectField
            label="SMS Pattern"
            value={smsPattern}
            onChange={e => setSmsPattern(e.target.value)}
            options={['Type 1', 'Type 2', 'Type 3']}
            placeholder="Select SMS Pattern"
          />
          <PillToggle
            label="SMS Escalation"
            active={smsEscalation}
            onChange={setSmsEscalation}
          />
        </div>

        {/* ============================================================ */}
        {/* SECTION 5: Whats App Configuration                           */}
        {/* ============================================================ */}
        <SectionTitle id="whatsapp" title="Whats App Configuration" icon={Send} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', columnGap: '32px', rowGap: '16px' }}>
          <PillToggle
            label="Whats App Notification"
            active={whatsappNotification}
            onChange={setWhatsappNotification}
          />
        </div>

        {/* ============================================================ */}
        {/* SECTION 6: Telegram Configuration                           */}
        {/* ============================================================ */}
        <SectionTitle id="telegram" title="Telegram Configuration" icon={Send} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', columnGap: '32px', rowGap: '16px' }}>
          <PillToggle
            label="Telegram Notification"
            active={telegramNotification}
            onChange={setTelegramNotification}
          />
        </div>

        {/* ============================================================ */}
        {/* SECTION 7: RFID Configuration                               */}
        {/* ============================================================ */}
        <SectionTitle id="rfid" title="RFID Configuration" icon={Radio} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', columnGap: '32px', rowGap: '16px' }}>
          <PillToggle
            label="IS RFID"
            active={isRfid}
            onChange={setIsRfid}
          />
        </div>

        {/* ============================================================ */}
        {/* SECTION 8: Geofence Configuration                           */}
        {/* ============================================================ */}
        <SectionTitle id="geofence" title="Geofence Configuration" icon={MapPin} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', columnGap: '32px', rowGap: '16px' }}>
          <PillToggle
            label="School Geofence"
            active={schoolGeofence}
            onChange={setSchoolGeofence}
          />
          <PillToggle
            label="Back To Geofence"
            active={backToGeofence}
            onChange={setBackToGeofence}
          />
          <PillToggle
            label="Not In Geofence Area Alert"
            active={notInGeofenceAreaAlert}
            onChange={setNotInGeofenceAreaAlert}
          />
          <PillToggle
            label="Geofence Immobilizer"
            infoTooltip="Automatically immobilize ignition when vehicle enters or leaves designated geofence"
            active={geofenceImmobilizer}
            onChange={setGeofenceImmobilizer}
          />
          <SelectField
            label="Send Geofence SMS"
            value={sendGeofenceSms}
            onChange={e => setSendGeofenceSms(e.target.value)}
            options={['Both', 'Entry', 'Exit']}
            placeholder="-- Select --"
          />
          <SelectField
            label="Geofence"
            value={selectedGeofence}
            onChange={e => setSelectedGeofence(e.target.value)}
            options={['Site Entry', 'Site Exit']}
            placeholder="-- Select --"
          />
          <PillToggle
            label="Geofence Enabled"
            active={geofenceEnabled}
            onChange={setGeofenceEnabled}
          />
          <SelectField
            label="Geofence Notification"
            value={geofenceNotification}
            onChange={e => setGeofenceNotification(e.target.value)}
            options={['Both', 'Entry Only', 'Exit Only']}
            placeholder="Select Notification Type"
          />
        </div>

        {/* ============================================================ */}
        {/* SECTION 9: Other Details                                    */}
        {/* ============================================================ */}
        <SectionTitle id="other-details" title="Other Details" icon={Sliders} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', columnGap: '32px', rowGap: '16px', alignItems: 'end' }}>
          <PillToggle
            label="Send Data To Government IP"
            active={sendDataToGovernmentIp}
            onChange={setSendDataToGovernmentIp}
          />
          <PillToggle
            label="Delete History EOD"
            active={deleteHistoryEod}
            onChange={setDeleteHistoryEod}
          />
          <div style={{ gridColumn: 'span 1' }}>
            <InputField
              label="Sales Email"
              type="text"
              value={salesEmail}
              onChange={e => setSalesEmail(e.target.value)}
              placeholder="e.g. sales@fueltracks.com or no"
              focused={focusedField === 'salesEmail'}
              onFocus={() => setFocusedField('salesEmail')}
              onBlur={() => setFocusedField(null)}
            />
          </div>
        </div>

        {/* ============================================================ */}
        {/* SECTION 10: Temperature Sensor Configuration                */}
        {/* ============================================================ */}
        <SectionTitle id="temperature" title="Temperature Sensor Configuration" icon={Thermometer} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', columnGap: '32px', rowGap: '16px' }}>
          <PillToggle
            label="Temperature Alarm"
            active={temperatureAlarm}
            onChange={setTemperatureAlarm}
          />
          <SelectField
            label="Temperature No Data Duration"
            value={temperatureNoDataDuration}
            onChange={e => setTemperatureNoDataDuration(e.target.value)}
            options={['15 mins', '30 mins', '1 hr', '2 hrs', '4 hrs', '6 hrs', '12 hrs', '24 hrs']}
            placeholder="-- Select --"
          />
        </div>

        {/* ============================================================ */}
        {/* SECTION 11: Shift Timing Configuration                       */}
        {/* ============================================================ */}
        <SectionTitle id="shift-timing" title="Shift Timing Configuration" icon={Clock} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', columnGap: '32px', rowGap: '16px' }}>
          <PillToggle
            label="Shift Details"
            active={shiftDetails}
            onChange={setShiftDetails}
          />
        </div>

        {/* ============================================================ */}
        {/* SECTION 12: Reports Timing Configuration                     */}
        {/* ============================================================ */}
        <SectionTitle id="reports-timing" title="Reports Timing Configuration" icon={FileText} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', columnGap: '32px', rowGap: '16px' }}>
          <PillToggle
            label="Reports Details"
            tooltip="Configure automated daily and weekly dispatch report generation timing"
            infoTooltip="Reports are scheduled and emailed according to organization operating hours"
            active={reportsDetails}
            onChange={setReportsDetails}
          />
        </div>

        {/* Bottom Save Action Bar */}
        <div style={{
          marginTop: '40px',
          paddingTop: '20px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '12px'
        }}>
          <button
            type="button"
            onClick={() => navigate('/admin/organizations')}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 700,
              color: '#64748B',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#64748B'; }}
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '11px 28px',
              borderRadius: '10px',
              fontSize: '13.5px',
              fontWeight: 700,
              color: '#FFFFFF',
              background: '#f97316',
              border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(249, 115, 22, 0.25)',
              transition: 'all 0.15s ease',
              opacity: saving ? 0.7 : 1
            }}
            onMouseEnter={e => { if (!saving) { e.currentTarget.style.background = '#ea580c'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
            onMouseLeave={e => { if (!saving) { e.currentTarget.style.background = '#f97316'; e.currentTarget.style.transform = 'none'; } }}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            <span>{saving ? 'Updating...' : 'Update Organization'}</span>
          </button>
        </div>

      </form>
    </div>
  );
};

export default EditOrganizationPage;
