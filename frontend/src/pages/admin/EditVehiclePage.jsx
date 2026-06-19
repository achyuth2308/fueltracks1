import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, AlertTriangle, CheckCircle, RefreshCcw, Truck, UserCircle, Settings, Fuel, ChevronRight } from 'lucide-react';
import * as vehicleApi from '../../api/vehicleApi';
import * as adminApi from '../../api/adminApi';

const inputBaseStyle = {
  width: '100%', padding: '12px 16px', borderRadius: '10px',
  border: '1px solid #E2E8F0', fontSize: '14px', outline: 'none',
  color: '#111827', background: '#f1f5f8ff', boxSizing: 'border-box',
  transition: 'all 0.2s ease', fontFamily: 'Inter, sans-serif'
};

const labelStyle = {
  display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px'
};

const InputField = ({ label, type = "text", value, onChange, disabled, placeholder, onFocus, onBlur, focused }) => (
  <div>
    <label style={labelStyle}>{label}</label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      onFocus={onFocus}
      onBlur={onBlur}
      style={{
        ...inputBaseStyle,
        background: disabled ? '#F1F5F9' : (focused ? '#FFFFFF' : '#F8FAFC'),
        border: focused ? '1px solid #8ba0b5' : '1px solid #E2E8F0',
        boxShadow: focused ? '0 0 0 3px rgba(139,160,181,0.1)' : 'none',
        opacity: disabled ? 0.7 : 1,
        cursor: disabled ? 'not-allowed' : 'text'
      }}
    />
  </div>
);

const SelectField = ({ label, value, onChange, options, focused, onFocus, onBlur }) => (
  <div>
    <label style={labelStyle}>{label}</label>
    <select
      value={value}
      onChange={onChange}
      onFocus={onFocus}
      onBlur={onBlur}
      style={{
        ...inputBaseStyle,
        background: focused ? '#FFFFFF' : '#F8FAFC',
        border: focused ? '1px solid #8ba0b5' : '1px solid #E2E8F0',
        boxShadow: focused ? '0 0 0 3px rgba(139,160,181,0.1)' : 'none',
        cursor: 'pointer'
      }}
    >
      <option value="">-- Select --</option>
      {options.map((opt, i) => (
        <option key={i} value={typeof opt === 'object' ? opt.value : opt}>
          {typeof opt === 'object' ? opt.label : opt}
        </option>
      ))}
    </select>
  </div>
);

const SectionCard = ({ title, icon: Icon, children }) => (
  <div style={{
    background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0',
    boxShadow: '0 4px 20px -2px rgba(0,0,0,0.03)', overflow: 'hidden', marginBottom: '32px',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease'
  }}>
    <div style={{
      padding: '20px 24px', borderBottom: '1px solid #F1F5F9',
      display: 'flex', alignItems: 'center', gap: '12px', background: '#FAFAFA'
    }}>
      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f5efe4', color: '#8ba0b5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={18} />
      </div>
      <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: 0, letterSpacing: '-0.01em' }}>{title}</h2>
    </div>
    <div style={{ padding: '32px' }}>
      {children}
    </div>
  </div>
);

const EditVehiclePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [orgs, setOrgs] = useState([]);
  const [focusedField, setFocusedField] = useState(null);

  // Form State
  const [form, setForm] = useState({
    imei: '', name: '', plate: '', model: '', make: '', driverName: '', driverPhone: '',
    serverName: '', gpsSimNo: '', deviceVersion: '', timezone: '', apn: '',
    licenceIssuedDate: '', licenceExpireDate: '', orgId: '',
    metadata: {
      vehicleId: '', licenceNo: '', iccid: '', telecomOperator: '', installationDate: '', onboardDate: '',
      madeIn: 'India', mfgDate: '', chassisNo: '', altVehicleName: '', remarks: '',
      serviceEngineer: '', salesman: '', ticketId: '', sensorNo: '',
      fuelMode: 'Manual Calibrate', sensorCount: '1', noOfTanks: '1', fuelType: 'None',
      vehicleMode: 'Moving Vehicle', tankSize: '0', speed: '',
      fuelBatteryVolt: 'NO', consumptionDuringFill: 'NO',
      deviceOdo: 'YES', assetTrack: 'NO', safetyPark: 'NO', rigMode: 'NO', acToggle: 'NO',
      secondaryEngine: 'Digital Input 2', engineOn: 'Ignition', batteryVoltage: '',
      odometerReading: '0', overSpeedLimit: '60', expectedMileage: '4', enableDebugs: 'Disable',
      countryTimezone: '', ipAddress: '', portNo: '', lowBattery: '20',
      externalDevice: 'NO'
    }
  });

  // Migration Modal State
  const [newImei, setNewImei] = useState('');
  const [migrating, setMigrating] = useState(false);

  useEffect(() => {
    adminApi.getOrgs?.().then(res => setOrgs(res.data || [])).catch(console.error);

    if (isEditing) {
      vehicleApi.getVehicleById(id)
        .then(res => {
          const v = res.data;
          setForm({
            imei: v.imei || '', name: v.name || '', plate: v.plate || '', model: v.model || '',
            make: v.make || '', driverName: v.driver_name || '', driverPhone: v.driver_phone || '',
            serverName: v.server_name || '', gpsSimNo: v.gps_sim_no || '', deviceVersion: v.device_version || '',
            timezone: v.timezone || '', apn: v.apn || '', orgId: v.org_id || '',
            licenceIssuedDate: v.licence_issued_date ? new Date(v.licence_issued_date).toISOString().split('T')[0] : '',
            licenceExpireDate: v.licence_expire_date ? new Date(v.licence_expire_date).toISOString().split('T')[0] : '',
            metadata: { ...form.metadata, ...(v.metadata || {}) }
          });
          setLoading(false);
        })
        .catch(err => {
          setError('Failed to load vehicle details.');
          setLoading(false);
        });
    } else {
      // User requested not to auto-generate the vehicle ID.
      // Leave metadata.vehicleId empty so they can type it manually.
    }
  }, [id, isEditing]);

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
  const updateMeta = (field, value) => setForm(prev => ({ ...prev, metadata: { ...prev.metadata, [field]: value } }));

  const handleSave = async () => {
    if (!form.name || form.name.trim() === '') {
      setError('Vehicle Name is mandatory.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setSubmitting(true);
    setError(''); setSuccess('');
    try {
      const payload = {
        imei: form.imei, name: form.name, plate: form.plate, model: form.model,
        driverName: form.driverName, driverPhone: form.driverPhone, orgId: form.orgId,
        serverName: form.serverName, gpsSimNo: form.gpsSimNo, deviceVersion: form.deviceVersion,
        timezone: form.timezone, apn: form.apn, licenceIssuedDate: form.licenceIssuedDate,
        licenceExpireDate: form.licenceExpireDate, metadata: form.metadata
      };

      if (isEditing) {
        await vehicleApi.updateVehicle(id, payload);
        setSuccess('Vehicle updated successfully!');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        await vehicleApi.createVehicle(payload);
        setSuccess('Vehicle registered successfully!');
        setTimeout(() => navigate('/admin/vehicles'), 1500);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save vehicle');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleMigrate = async () => {
    if (!newImei || !/^\d{15}$/.test(newImei)) {
      alert("Please enter a valid 15-digit IMEI.");
      return;
    }
    setMigrating(true);
    try {
      await vehicleApi.migrateVehicle(id, newImei);
      setForm(prev => ({ ...prev, imei: newImei }));
      setMigrateModalOpen(false);
      setSuccess('Vehicle device migrated successfully!');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to migrate vehicle');
    } finally {
      setMigrating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#F8FAFC' }}>
        <Loader2 size={48} className="animate-spin" color="#8ba0b5" style={{ marginBottom: '16px' }} />
        <h2 style={{ fontSize: '18px', color: '#475569', fontWeight: 600 }}>Loading Vehicle Data...</h2>
      </div>
    );
  }

  return (
    <div style={{ background: '#f5efe4', minHeight: '100%', paddingBottom: '64px', boxSizing: 'border-box' }}>

      {/* Sticky Header with Glassmorphism */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
        padding: '24px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button
            onClick={() => navigate('/admin/vehicles')}
            style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#111827'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.color = '#475569'; }}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748B', fontWeight: 600, marginBottom: '4px' }}>
              Vehicles <ChevronRight size={14} /> {isEditing ? 'Edit Vehicle' : 'Register Vehicle'}
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.02em' }}>
              {isEditing ? form.name || 'Edit Vehicle' : 'Register New Vehicle'}
            </h1>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          {isEditing && (
            <button
              onClick={() => navigate(`/admin/vehicles/migration/${id}`)}
              style={{ padding: '12px 24px', borderRadius: '12px', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#111827', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#94A3B8'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#CBD5E1'; }}
            >
              <RefreshCcw size={18} color="#8ba0b5" /> Migrate Device
            </button>
          )}
          <button
            onClick={handleSave} disabled={submitting}
            style={{ padding: '12px 32px', borderRadius: '12px', background: '#8ba0b5', border: 'none', color: '#FFFFFF', fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px', cursor: submitting ? 'not-allowed' : 'pointer', boxShadow: '0 10px 15px -3px rgba(139,160,181,0.3)', transition: 'all 0.2s', opacity: submitting ? 0.7 : 1 }}
            onMouseEnter={e => { if (!submitting) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 15px 20px -3px rgba(139,160,181,0.4)'; } }}
            onMouseLeave={e => { if (!submitting) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(139,160,181,0.3)'; } }}
          >
            {submitting ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            {isEditing ? 'Save Changes' : 'Register Vehicle'}
          </button>
        </div>
      </div>

      <div style={{ padding: '40px', maxWidth: '1400px', margin: '0 auto' }}>

        {/* Status Alerts */}
        {error && (
          <div style={{ padding: '16px 20px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', color: '#DC2626', marginBottom: '32px', boxShadow: '0 4px 6px -1px rgba(220,38,38,0.1)' }}>
            <AlertTriangle size={24} />
            <div style={{ fontSize: '15px', fontWeight: 600 }}>{error}</div>
          </div>
        )}
        {success && (
          <div style={{ padding: '16px 20px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', color: '#059669', marginBottom: '32px', boxShadow: '0 4px 6px -1px rgba(5,150,105,0.1)' }}>
            <CheckCircle size={24} />
            <div style={{ fontSize: '15px', fontWeight: 600 }}>{success}</div>
          </div>
        )}

        {/* Section 1: Vehicle Information */}
        <SectionCard title="Vehicle Information" icon={Truck}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
            <InputField label="Vehicle ID" value={form.metadata.vehicleId || ''} onChange={e => updateMeta('vehicleId', e.target.value)} disabled={isEditing} placeholder="e.g. TRK-001" focused={focusedField === 'vId'} onFocus={() => setFocusedField('vId')} onBlur={() => setFocusedField(null)} />
            <InputField label="Vehicle Name" value={form.name} onChange={e => updateField('name', e.target.value)} placeholder="e.g. Truck Alpha" focused={focusedField === 'name'} onFocus={() => setFocusedField('name')} onBlur={() => setFocusedField(null)} />
            <InputField label="Vehicle Registration Number" value={form.plate} onChange={e => updateField('plate', e.target.value)} placeholder="e.g. MH12AB1234" focused={focusedField === 'plate'} onFocus={() => setFocusedField('plate')} onBlur={() => setFocusedField(null)} />
            <SelectField label="Vehicle Type" value={form.model} onChange={e => updateField('model', e.target.value)} options={['Truck', 'Bus', 'Car', 'Van', 'Scooty', 'Motorcycle', 'Tractor', 'JCB', 'Crane', 'Ambulance', 'Pickup', 'Borewell', 'Tanker']} focused={focusedField === 'model'} onFocus={() => setFocusedField('model')} onBlur={() => setFocusedField(null)} />
            <InputField label="Vehicle Model" value={form.make} onChange={e => updateField('make', e.target.value)} placeholder="e.g. Tata Prima 3518" focused={focusedField === 'make'} onFocus={() => setFocusedField('make')} onBlur={() => setFocusedField(null)} />
            <SelectField label="Device Model" value={form.deviceVersion} onChange={e => updateField('deviceVersion', e.target.value)} options={['GT06N', 'FMB920', 'BSTPL-17']} focused={focusedField === 'dver'} onFocus={() => setFocusedField('dver')} onBlur={() => setFocusedField(null)} />

            <div style={{ position: 'relative' }}>
              <InputField label="Device ID / IMEI No" value={form.imei} onChange={e => updateField('imei', e.target.value)} disabled={isEditing} placeholder="15-digit IMEI" />
              {isEditing && <span style={{ position: 'absolute', top: '0', right: '0', fontSize: '11px', color: '#8ba0b5', fontWeight: 700, background: '#f5efe4', padding: '2px 8px', borderRadius: '4px' }}>Use Migrate</span>}
            </div>

            <InputField label="GPS Sim Number" value={form.gpsSimNo} onChange={e => updateField('gpsSimNo', e.target.value)} placeholder="0123456789" focused={focusedField === 'gps'} onFocus={() => setFocusedField('gps')} onBlur={() => setFocusedField(null)} />
            <InputField label="GPS Sim ICCID" value={form.metadata.iccid} onChange={e => updateMeta('iccid', e.target.value)} focused={focusedField === 'iccid'} onFocus={() => setFocusedField('iccid')} onBlur={() => setFocusedField(null)} />
            <SelectField label="Telecom Operator" value={form.metadata.telecomOperator} onChange={e => updateMeta('telecomOperator', e.target.value)} options={['AIRCEL', 'AIRTEL', 'VODAFONE', 'JIO']} focused={focusedField === 'telco'} onFocus={() => setFocusedField('telco')} onBlur={() => setFocusedField(null)} />
            <InputField label="Installation Date" type="date" value={form.metadata.installationDate} onChange={e => updateMeta('installationDate', e.target.value)} focused={focusedField === 'instDate'} onFocus={() => setFocusedField('instDate')} onBlur={() => setFocusedField(null)} />
            <SelectField label="Organization Name" value={form.orgId} onChange={e => updateField('orgId', e.target.value)} options={orgs.map(o => ({ value: o.id, label: o.name }))} focused={focusedField === 'org'} onFocus={() => setFocusedField('org')} onBlur={() => setFocusedField(null)} />
            <InputField label="Licence" value={form.metadata.licenceNo || ''} onChange={e => updateMeta('licenceNo', e.target.value)} placeholder="e.g. DL-12345" focused={focusedField === 'licNo'} onFocus={() => setFocusedField('licNo')} onBlur={() => setFocusedField(null)} />
            <InputField label="Onboard Date" type="date" value={form.metadata.onboardDate} onChange={e => updateMeta('onboardDate', e.target.value)} focused={focusedField === 'onbdDate'} onFocus={() => setFocusedField('onbdDate')} onBlur={() => setFocusedField(null)} />
            <InputField label="Licence Issued Date" type="date" value={form.licenceIssuedDate} onChange={e => updateField('licenceIssuedDate', e.target.value)} focused={focusedField === 'licIss'} onFocus={() => setFocusedField('licIss')} onBlur={() => setFocusedField(null)} />
            <InputField label="Licence Expiration Date" type="date" value={form.licenceExpireDate} onChange={e => updateField('licenceExpireDate', e.target.value)} focused={focusedField === 'licExp'} onFocus={() => setFocusedField('licExp')} onBlur={() => setFocusedField(null)} />
          </div>
        </SectionCard>

        {/* Section 2: Driver Details */}
        <SectionCard title="Driver Details" icon={UserCircle}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            <InputField label="Driver Name" value={form.driverName} onChange={e => updateField('driverName', e.target.value)} placeholder="Full Name" focused={focusedField === 'dName'} onFocus={() => setFocusedField('dName')} onBlur={() => setFocusedField(null)} />
            <InputField label="Driver Mobile No" value={form.driverPhone} onChange={e => updateField('driverPhone', e.target.value)} placeholder="+91 XXXXX XXXXX" focused={focusedField === 'dPhone'} onFocus={() => setFocusedField('dPhone')} onBlur={() => setFocusedField(null)} />
          </div>
        </SectionCard>


        {/* Section 4: Configuration Details */}
        <SectionCard title="Configuration Details" icon={Settings}>
          <div style={{ background: '#F8FAFC', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', flexWrap: 'wrap', gap: '32px', marginBottom: '32px' }}>
            {['deviceOdo', 'assetTrack', 'safetyPark', 'rigMode', 'acToggle', 'externalDevice'].map(flag => (
              <div key={flag} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ fontSize: '14px', fontWeight: 600, color: '#475569', textTransform: 'capitalize' }}>
                  {flag.replace(/([A-Z])/g, ' $1').trim()}
                </label>
                <div style={{ display: 'flex', background: '#E2E8F0', borderRadius: '8px', padding: '4px' }}>
                  {['NO', 'YES'].map(opt => (
                    <button key={opt} onClick={() => updateMeta(flag, opt)} style={{ padding: '4px 12px', borderRadius: '6px', border: 'none', background: form.metadata[flag] === opt ? (opt === 'YES' ? '#10B981' : '#FFFFFF') : 'transparent', color: form.metadata[flag] === opt ? (opt === 'YES' ? '#FFFFFF' : '#111827') : '#64748B', fontWeight: 600, fontSize: '12px', cursor: 'pointer', boxShadow: form.metadata[flag] === opt ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.2s' }}>{opt}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
            <SelectField label="Secondary Engine (AC)" value={form.metadata.secondaryEngine} onChange={e => updateMeta('secondaryEngine', e.target.value)} options={['Digital Input 2', 'Digital Input 1', 'None']} focused={focusedField === 'seng'} onFocus={() => setFocusedField('seng')} onBlur={() => setFocusedField(null)} />
            <SelectField label="Engine ON" value={form.metadata.engineOn} onChange={e => updateMeta('engineOn', e.target.value)} options={['Ignition', 'Movement']} focused={focusedField === 'engon'} onFocus={() => setFocusedField('engon')} onBlur={() => setFocusedField(null)} />
            <InputField label="Vehicle Battery Voltage" value={form.metadata.batteryVoltage} onChange={e => updateMeta('batteryVoltage', e.target.value)} focused={focusedField === 'bvolt'} onFocus={() => setFocusedField('bvolt')} onBlur={() => setFocusedField(null)} />
            <InputField label="Odometer Reading" type="number" value={form.metadata.odometerReading} onChange={e => updateMeta('odometerReading', e.target.value)} focused={focusedField === 'odoread'} onFocus={() => setFocusedField('odoread')} onBlur={() => setFocusedField(null)} />
            <InputField label="OverSpeed Limit" type="number" value={form.metadata.overSpeedLimit} onChange={e => updateMeta('overSpeedLimit', e.target.value)} focused={focusedField === 'osplim'} onFocus={() => setFocusedField('osplim')} onBlur={() => setFocusedField(null)} />
            <InputField label="Expected Mileage" type="number" value={form.metadata.expectedMileage} onChange={e => updateMeta('expectedMileage', e.target.value)} focused={focusedField === 'xmil'} onFocus={() => setFocusedField('xmil')} onBlur={() => setFocusedField(null)} />
            <SelectField label="Enable Debugs" value={form.metadata.enableDebugs} onChange={e => updateMeta('enableDebugs', e.target.value)} options={['Disable', 'Enable']} focused={focusedField === 'dbg'} onFocus={() => setFocusedField('dbg')} onBlur={() => setFocusedField(null)} />
            <SelectField label="Timezone" value={form.timezone} onChange={e => updateField('timezone', e.target.value)} options={['UTC', 'IST', 'EST', 'PST']} focused={focusedField === 'tz'} onFocus={() => setFocusedField('tz')} onBlur={() => setFocusedField(null)} />
            <InputField label="IP Address" value={form.metadata.ipAddress} onChange={e => updateMeta('ipAddress', e.target.value)} focused={focusedField === 'ip'} onFocus={() => setFocusedField('ip')} onBlur={() => setFocusedField(null)} />
            <InputField label="Communicating Port No" value={form.metadata.portNo} onChange={e => updateMeta('portNo', e.target.value)} focused={focusedField === 'port'} onFocus={() => setFocusedField('port')} onBlur={() => setFocusedField(null)} />
            <InputField label="Low Battery Percentage" type="number" value={form.metadata.lowBattery} onChange={e => updateMeta('lowBattery', e.target.value)} focused={focusedField === 'lbat'} onFocus={() => setFocusedField('lbat')} onBlur={() => setFocusedField(null)} />
          </div>
        </SectionCard>

        {/* Section 4: Other Details (Moved to bottom) */}
        <SectionCard title="Other Details" icon={Settings}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px', marginBottom: '32px' }}>
            <InputField label="Made In" value={form.metadata.madeIn} onChange={e => updateMeta('madeIn', e.target.value)} focused={focusedField === 'madeIn'} onFocus={() => setFocusedField('madeIn')} onBlur={() => setFocusedField(null)} />
            <InputField label="Manufacturing Date" type="date" value={form.metadata.mfgDate} onChange={e => updateMeta('mfgDate', e.target.value)} focused={focusedField === 'mfg'} onFocus={() => setFocusedField('mfg')} onBlur={() => setFocusedField(null)} />
            <InputField label="Chassis Number" value={form.metadata.chassisNo} onChange={e => updateMeta('chassisNo', e.target.value)} focused={focusedField === 'chas'} onFocus={() => setFocusedField('chas')} onBlur={() => setFocusedField(null)} />
            <InputField label="Alt Vehicle Name" value={form.metadata.altVehicleName} onChange={e => updateMeta('altVehicleName', e.target.value)} focused={focusedField === 'altV'} onFocus={() => setFocusedField('altV')} onBlur={() => setFocusedField(null)} />
            <InputField label="Service Engineer" value={form.metadata.serviceEngineer} onChange={e => updateMeta('serviceEngineer', e.target.value)} focused={focusedField === 'sEng'} onFocus={() => setFocusedField('sEng')} onBlur={() => setFocusedField(null)} />
            <InputField label="Salesman" value={form.metadata.salesman} onChange={e => updateMeta('salesman', e.target.value)} focused={focusedField === 'sales'} onFocus={() => setFocusedField('sales')} onBlur={() => setFocusedField(null)} />
            <InputField label="Ticket Id" value={form.metadata.ticketId} onChange={e => updateMeta('ticketId', e.target.value)} focused={focusedField === 'tix'} onFocus={() => setFocusedField('tix')} onBlur={() => setFocusedField(null)} />
            <InputField label="Sensor No" value={form.metadata.sensorNo} onChange={e => updateMeta('sensorNo', e.target.value)} focused={focusedField === 'sns'} onFocus={() => setFocusedField('sns')} onBlur={() => setFocusedField(null)} />
            <div style={{ gridColumn: '1 / -1' }}>
              <InputField label="Description / Remarks" value={form.metadata.remarks} onChange={e => updateMeta('remarks', e.target.value)} focused={focusedField === 'rmk'} onFocus={() => setFocusedField('rmk')} onBlur={() => setFocusedField(null)} />
            </div>
          </div>

          <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleSave} disabled={submitting}
              style={{ padding: '16px 40px', borderRadius: '12px', background: '#8ba0b5', border: 'none', color: '#FFFFFF', fontSize: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '12px', cursor: submitting ? 'not-allowed' : 'pointer', boxShadow: '0 10px 20px -5px rgba(139,160,181,0.4)', transition: 'all 0.2s', opacity: submitting ? 0.7 : 1 }}
              onMouseEnter={e => { if (!submitting) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 15px 25px -5px rgba(139,160,181,0.5)'; } }}
              onMouseLeave={e => { if (!submitting) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 10px 20px -5px rgba(139,160,181,0.4)'; } }}
            >
              {submitting ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />}
              {isEditing ? 'Save Vehicle Details' : 'Submit New Vehicle Registration'}
            </button>
          </div>
        </SectionCard>

      </div>

      {/* Migration Modal was removed - now uses dedicated page */}

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}} />
    </div>
  );
};

export default EditVehiclePage;
