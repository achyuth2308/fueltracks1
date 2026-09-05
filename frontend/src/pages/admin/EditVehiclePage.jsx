import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, Loader2, AlertTriangle, CheckCircle, RefreshCcw,
  Truck, UserCircle, Settings, Fuel, ChevronRight, Layers, Check, Search, Tag, UserCheck, Cpu, ShieldCheck
} from 'lucide-react';
import * as vehicleApi from '../../api/vehicleApi';
import * as adminApi from '../../api/adminApi';
import { expandScientificNotation } from '../../utils/formatUtils';

const inputBaseStyle = {
  width: '100%', padding: '12px 16px', borderRadius: '10px',
  border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none',
  color: '#0F172A', fontWeight: 600, background: '#FFFFFF', boxSizing: 'border-box',
  transition: 'all 0.2s ease', fontFamily: 'Inter, sans-serif'
};

const labelStyle = {
  display: 'block', fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '8px'
};

const InputField = ({ label, type = "text", value, onChange, disabled, placeholder, onFocus, onBlur, focused, autoComplete }) => (
  <div>
    <label style={labelStyle}>{label}</label>
    <input
      type={type}
      value={value ?? ''}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      onFocus={onFocus}
      onBlur={onBlur}
      autoComplete={autoComplete}
      style={{
        ...inputBaseStyle,
        background: disabled ? '#F1F5F9' : (focused ? '#FFFFFF' : '#F8FAFC'),
        border: focused ? '1px solid #f97316' : '1px solid #CBD5E1',
        boxShadow: focused ? '0 0 0 3px rgba(249,115,22,0.1)' : 'none',
        color: '#0F172A',
        opacity: 1,
        cursor: disabled ? 'not-allowed' : 'text'
      }}
    />
  </div>
);

const SelectField = ({ label, value, onChange, options, focused, onFocus, onBlur }) => (
  <div>
    <label style={labelStyle}>{label}</label>
    <select
      value={value ?? ''}
      onChange={onChange}
      onFocus={onFocus}
      onBlur={onBlur}
      style={{
        ...inputBaseStyle,
        background: focused ? '#FFFFFF' : '#F8FAFC',
        border: focused ? '1px solid #f97316' : '1px solid #E2E8F0',
        boxShadow: focused ? '0 0 0 3px rgba(249,115,22,0.1)' : 'none',
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

const ToggleButton = ({ label, active, onChange }) => (
  <div>
    <label style={labelStyle}>{label}</label>
    <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
      <button
        type="button"
        onClick={() => onChange('NO')}
        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
          active === 'NO' || !active ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
        }`}
      >
        NO
      </button>
      <button
        type="button"
        onClick={() => onChange('YES')}
        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
          active === 'YES' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
        }`}
      >
        YES
      </button>
    </div>
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
      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#EEF5F8', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={18} />
      </div>
      <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: 0, letterSpacing: '-0.01em' }}>{title}</h2>
    </div>
    <div className="p-4 sm:p-8">
      {children}
    </div>
  </div>
);

const VEHICLE_TYPES = [
  'Truck', 'Car', 'Van', 'Bus', 'Scooty', 'Motorcycle', 'Tractor',
  'JCB', 'Crane', 'Ambulance', 'Pickup', 'Borewell', 'Tanker', 'Tipper'
];

const DEVICE_TYPES = [
  'VOLTY (5004)', 'CONCOX (5002)', 'AIS140 V2 (5003)',
  'FMB 920 (5005)', 'BSTPL (5000)', 'AIS140 (5001)'
];

const TELECOM_OPERATORS = ['Airtel', 'Jio', 'Vodafone Idea (Vi)', 'BSNL', 'Other'];

const EditVehiclePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [orgs, setOrgs] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [focusedField, setFocusedField] = useState(null);

  // Form State
  const [form, setForm] = useState({
    imei: '', name: '', plate: '', model: 'Truck', make: '', driverName: '', driverPhone: '',
    category: 'General', isSandMining: false,
    serverName: '', gpsSimNo: '', deviceVersion: 'VOLTY', timezone: 'IST', apn: '',
    licenceIssuedDate: '', licenceExpireDate: '', orgId: '',
    metadata: {
      vehicleId: '', registrationNo: '', vehicleTypeSelect: 'Truck', vehicleModel: '',
      deviceModel: 'VOLTY', vlttdSlno: '', licenceId: '', iccid: '', sim1: '', sim2: '',
      telecomOperator: 'Airtel', installationDate: '', onboardDate: '', onboardingDate: '', installedDate: '',
      madeIn: 'India', mfgDate: '', chassisNo: '', engineNo: '', rtoLocation: '',
      serviceEngineer: '', serviceEngineerPhone: '', salesman: '', salesmanPhone: '',
      ticketId: '', sensorNo: '',
      vehicleVoltage: '', batteryVoltage: '', engineOnStatus: '', engineOn: '',
      oldGroups: '',
      ownerName: '', ownerPhone: '', customerName: '', customerPhone: '', aadharNo: '', panNo: '',
      email: '', username: '', password: '',
      // Fuel configuration fields - defaulted to empty
      fuelType: '', tankSize: '', fuelEmptyAdc: '', fuelFullAdc: '', expectedMileage: '',
      // Configuration Details Toggles - ALL DEFAULT TO NO
      deviceOdo: 'NO', assetTrack: 'NO', safetyPark: 'NO', rigMode: 'NO', acToggle: 'NO', externalDevice: 'NO',
      // Telemetry & Threshold fields - defaulted to empty
      secondaryEngine: '', odometerReading: '', odoDistance: '',
      overSpeedLimit: '', overspeedDurationAlert: '', idleDurationAlert: '', enableDebugs: '',
      ipAddress: '', portNo: '', lowBattery: ''
    }
  });

  useEffect(() => {
    adminApi.getOrgs?.().then(res => setOrgs(res.data || [])).catch(console.error);
    adminApi.getGroups?.().then(res => setGroups(res.data || [])).catch(console.error);

    if (isEditing) {
      vehicleApi.getVehicleById(id)
        .then(res => {
          const v = res.data;
          const meta = v.metadata || {};
          setForm({
            imei: v.imei || '',
            name: v.name || '',
            plate: v.plate || meta.registrationNo || '',
            model: v.model || meta.vehicleTypeSelect || 'Truck',
            make: v.make || '',
            driverName: v.driver_name || meta.ownerName || '',
            driverPhone: v.driver_phone || meta.ownerPhone || '',
            category: v.category || 'General',
            isSandMining: v.is_sand_mining || false,
            serverName: v.server_name || '',
            gpsSimNo: expandScientificNotation(v.gps_sim_no || meta.sim1 || ''),
            deviceVersion: v.device_version || meta.deviceModel || 'VOLTY',
            timezone: v.timezone || meta.timezone || 'IST',
            apn: v.apn || '',
            orgId: v.org_id || '',
            licenceIssuedDate: v.licence_issued_date ? new Date(v.licence_issued_date).toISOString().split('T')[0] : '',
            licenceExpireDate: v.licence_expire_date ? new Date(v.licence_expire_date).toISOString().split('T')[0] : '',
            metadata: { 
              ...meta,
              sim2: expandScientificNotation(meta.sim2 || ''),
              iccid: expandScientificNotation(meta.iccid || ''),
              vltdSlno: expandScientificNotation(meta.vltdSlno || '')
            }
          });
          if (v.groups && Array.isArray(v.groups)) {
            setSelectedGroupIds(v.groups.map(g => g.id));
          }
          setLoading(false);
        })
        .catch(err => {
          setError('Failed to load vehicle details.');
          setLoading(false);
        });
    }
  }, [id, isEditing]);

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
  const updateMeta = (field, value) => setForm(prev => ({ ...prev, metadata: { ...prev.metadata, [field]: value } }));

  const toggleGroup = (groupId) => {
    setSelectedGroupIds(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleSave = async () => {
    if (!form.name || form.name.trim() === '') {
      setError('Vehicle Name is mandatory.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!form.imei || !/^\d{10,20}$/.test(form.imei)) {
      setError('A valid IMEI number (10-20 digits) is required.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSubmitting(true);
    setError(''); setSuccess('');
    try {
      const payload = {
        imei: form.imei,
        name: form.name,
        plate: form.plate || form.metadata.vehicleId,
        model: form.model,
        category: form.category || 'General',
        driverName: form.driverName || form.metadata.ownerName,
        driverPhone: form.driverPhone || form.metadata.ownerPhone,
        orgId: form.orgId,
        groupIds: selectedGroupIds,
        serverName: form.serverName,
        gpsSimNo: form.gpsSimNo,
        deviceVersion: form.deviceVersion,
        timezone: form.timezone,
        apn: form.apn,
        licenceIssuedDate: form.licenceIssuedDate,
        licenceExpireDate: form.licenceExpireDate,
        isSandMining: form.isSandMining,
        metadata: {
          ...form.metadata,
          sim1: form.gpsSimNo,
          vehicleModel: form.model,
          deviceModel: form.deviceVersion,
          registrationNo: form.plate || form.metadata.vehicleId
        }
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

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(groupSearchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#EEF5F8' }}>
        <Loader2 size={48} className="animate-spin" color="#f97316" style={{ marginBottom: '16px' }} />
        <h2 style={{ fontSize: '18px', color: '#475569', fontWeight: 600 }}>Loading Vehicle Data...</h2>
      </div>
    );
  }

  return (
    <div style={{ background: '#EEF5F8', minHeight: '100%', paddingBottom: '64px', boxSizing: 'border-box' }}>

      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-slate-200/80 p-4 sm:px-10 sm:py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3 sm:gap-5 w-full sm:w-auto">
          <button
            onClick={() => navigate('/admin/vehicles')}
            style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#111827'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.color = '#475569'; }}
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Vehicles <ChevronRight size={14} /> {isEditing ? 'Edit Vehicle' : 'Register Vehicle'}
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
              {isEditing ? form.name || form.plate || 'Edit Vehicle' : 'Register New Vehicle'}
            </h1>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full sm:w-auto">
          {isEditing && (
            <button
              onClick={() => navigate(`/admin/vehicles/migration/${id}`)}
              style={{ padding: '12px 24px', borderRadius: '12px', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#111827', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#94A3B8'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#CBD5E1'; }}
            >
              <RefreshCcw size={18} color="#f97316" /> Migrate Device
            </button>
          )}
          <button
            onClick={handleSave} disabled={submitting}
            style={{ padding: '12px 32px', borderRadius: '12px', background: '#f97316', border: 'none', color: '#FFFFFF', fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px', cursor: submitting ? 'not-allowed' : 'pointer', boxShadow: '0 10px 15px -3px rgba(249,115,22,0.3)', transition: 'all 0.2s', opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            {isEditing ? 'Save Changes' : 'Register Vehicle'}
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-10 max-w-[1400px] mx-auto">

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

        {/* Section 1: Top Main Vehicle & Device Fields Grid (Matching Screenshot 2) */}
        <SectionCard title="Vehicle & Device Core Information" icon={Truck}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
            
            <InputField label="Vehicle ID" value={form.metadata.vehicleId || form.plate || ''} onChange={e => updateMeta('vehicleId', e.target.value)} placeholder="e.g. AP04X5678" focused={focusedField === 'vId'} onFocus={() => setFocusedField('vId')} onBlur={() => setFocusedField(null)} />
            <InputField label="Vehicle Name" value={form.name} onChange={e => updateField('name', e.target.value)} placeholder="e.g. AP04X5678" focused={focusedField === 'name'} onFocus={() => setFocusedField('name')} onBlur={() => setFocusedField(null)} />
            <InputField label="Vehicle Registration Number" value={form.plate} onChange={e => { updateField('plate', e.target.value); updateMeta('registrationNo', e.target.value); }} placeholder="e.g. MH12AB1234" focused={focusedField === 'plate'} onFocus={() => setFocusedField('plate')} onBlur={() => setFocusedField(null)} />
            
            <SelectField
              label="Vehicle Type"
              value={form.model || form.metadata.vehicleTypeSelect}
              onChange={e => { updateField('model', e.target.value); updateMeta('vehicleTypeSelect', e.target.value); }}
              options={VEHICLE_TYPES}
              focused={focusedField === 'vType'}
              onFocus={() => setFocusedField('vType')}
              onBlur={() => setFocusedField(null)}
            />

            <InputField label="Vehicle Model" value={form.metadata.vehicleModel || ''} onChange={e => updateMeta('vehicleModel', e.target.value)} placeholder="e.g. Tata Prima 3518" focused={focusedField === 'vModel'} onFocus={() => setFocusedField('vModel')} onBlur={() => setFocusedField(null)} />
            
            <SelectField
              label="Device Type"
              value={form.deviceVersion}
              onChange={e => { updateField('deviceVersion', e.target.value); updateMeta('deviceModel', e.target.value); }}
              options={DEVICE_TYPES}
              focused={focusedField === 'dModel'}
              onFocus={() => setFocusedField('dModel')}
              onBlur={() => setFocusedField(null)}
            />

            <div style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
                Device ID / IMEI No
              </label>
              <input
                type="text"
                value={form.imei}
                onChange={e => updateField('imei', e.target.value.replace(/\D/g, '').slice(0, 15))}
                disabled={isEditing}
                placeholder="868329087240119"
                maxLength={15}
                style={{
                  ...inputBaseStyle,
                  cursor: isEditing ? 'not-allowed' : 'text',
                  border: !isEditing && form.imei && form.imei.length !== 15
                    ? '2px solid #EF4444'
                    : form.imei && form.imei.length === 15
                    ? '2px solid #22C55E'
                    : '1px solid #CBD5E1',
                  background: isEditing ? '#F1F5F9' : '#FFFFFF',
                  color: '#0F172A',
                  boxShadow: !isEditing && form.imei && form.imei.length !== 15
                    ? '0 0 0 3px rgba(239,68,68,0.15)'
                    : form.imei && form.imei.length === 15
                    ? '0 0 0 3px rgba(34,197,94,0.15)'
                    : 'none'
                }}
              />
              {/* IMEI digit counter */}
              {!isEditing && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  {form.imei && form.imei.length !== 15 && (
                    <span style={{ fontSize: '11px', color: '#EF4444', fontWeight: 700 }}>
                      ⚠ IMEI must be exactly 15 digits
                    </span>
                  )}
                  {form.imei && form.imei.length === 15 && (
                    <span style={{ fontSize: '11px', color: '#22C55E', fontWeight: 700 }}>
                      ✓ Valid IMEI
                    </span>
                  )}
                  <span style={{ fontSize: '11px', color: form.imei?.length === 15 ? '#22C55E' : '#64748B', fontWeight: 600, marginLeft: 'auto' }}>
                    {form.imei?.length || 0}/15
                  </span>
                </div>
              )}
              {isEditing && (
                <span style={{ position: 'absolute', top: '0', right: '0', fontSize: '11px', color: '#f97316', fontWeight: 700, background: '#EEF5F8', padding: '2px 8px', borderRadius: '4px' }}>
                  Use Migrate
                </span>
              )}
            </div>

            <InputField label="GPS Sim Number" value={form.gpsSimNo} onChange={e => updateField('gpsSimNo', e.target.value)} placeholder="0123456789" focused={focusedField === 'sim1'} onFocus={() => setFocusedField('sim1')} onBlur={() => setFocusedField(null)} />
            <InputField label="GPS Sim Number 2" value={form.metadata.sim2 || ''} onChange={e => updateMeta('sim2', e.target.value)} placeholder="Secondary SIM" focused={focusedField === 'sim2'} onFocus={() => setFocusedField('sim2')} onBlur={() => setFocusedField(null)} />
            <InputField label="GPS Sim ICCID" value={form.metadata.iccid || ''} onChange={e => updateMeta('iccid', e.target.value)} placeholder="ICCID Serial No" focused={focusedField === 'iccid'} onFocus={() => setFocusedField('iccid')} onBlur={() => setFocusedField(null)} />
            
            <SelectField
              label="Telecom Operator"
              value={form.metadata.telecomOperator}
              onChange={e => updateMeta('telecomOperator', e.target.value)}
              options={TELECOM_OPERATORS}
              focused={focusedField === 'telecom'}
              onFocus={() => setFocusedField('telecom')}
              onBlur={() => setFocusedField(null)}
            />

            <InputField label="Installation Date" type="date" value={form.metadata.installationDate || form.metadata.installedDate || ''} onChange={e => updateMeta('installationDate', e.target.value)} focused={focusedField === 'instDate'} onFocus={() => setFocusedField('instDate')} onBlur={() => setFocusedField(null)} />
            
            <SelectField
              label="Organization Name"
              value={form.orgId}
              onChange={e => updateField('orgId', e.target.value)}
              options={orgs.map(o => ({ value: o.id, label: o.name }))}
              focused={focusedField === 'org'}
              onFocus={() => setFocusedField('org')}
              onBlur={() => setFocusedField(null)}
            />

            <InputField label="Licence" value={form.metadata.licenceId || form.metadata.licenceNo || ''} onChange={e => updateMeta('licenceId', e.target.value)} placeholder="e.g. DL-12345" focused={focusedField === 'lic'} onFocus={() => setFocusedField('lic')} onBlur={() => setFocusedField(null)} />
            <InputField label="Onboard Date" type="date" value={form.metadata.onboardingDate || form.metadata.onboardDate || ''} onChange={e => updateMeta('onboardingDate', e.target.value)} focused={focusedField === 'onboardDate'} onFocus={() => setFocusedField('onboardDate')} onBlur={() => setFocusedField(null)} />
            <InputField label="Licence Issued Date" type="date" value={form.licenceIssuedDate} onChange={e => updateField('licenceIssuedDate', e.target.value)} focused={focusedField === 'licIss'} onFocus={() => setFocusedField('licIss')} onBlur={() => setFocusedField(null)} />
            <InputField label="Licence Expiration Date" type="date" value={form.licenceExpireDate} onChange={e => updateField('licenceExpireDate', e.target.value)} focused={focusedField === 'licExp'} onFocus={() => setFocusedField('licExp')} onBlur={() => setFocusedField(null)} />
            
            <InputField label="VLTD SLNO" value={form.metadata.vlttdSlno || ''} onChange={e => updateMeta('vlttdSlno', e.target.value)} placeholder="e.g. VLT-TS-98721" focused={focusedField === 'vlttd'} onFocus={() => setFocusedField('vlttd')} onBlur={() => setFocusedField(null)} />
            <InputField label="Chassis Number" value={form.metadata.chassisNo || ''} onChange={e => updateMeta('chassisNo', e.target.value)} placeholder="Chassis / VIN" focused={focusedField === 'chas'} onFocus={() => setFocusedField('chas')} onBlur={() => setFocusedField(null)} />
            <InputField label="Engine Number" value={form.metadata.engineNo || ''} onChange={e => updateMeta('engineNo', e.target.value)} placeholder="Engine Serial No" focused={focusedField === 'engNo'} onFocus={() => setFocusedField('engNo')} onBlur={() => setFocusedField(null)} />
            <InputField label="Sensor Number" value={form.metadata.sensorNo || ''} onChange={e => updateMeta('sensorNo', e.target.value)} placeholder="e.g. SNS-FUEL-01" focused={focusedField === 'sns'} onFocus={() => setFocusedField('sns')} onBlur={() => setFocusedField(null)} />
            <InputField label="Ticket ID" value={form.metadata.ticketId || ''} onChange={e => updateMeta('ticketId', e.target.value)} placeholder="e.g. TCK-98722" focused={focusedField === 'tck'} onFocus={() => setFocusedField('tck')} onBlur={() => setFocusedField(null)} />
            
            <SelectField
              label="Operating Category"
              value={form.category}
              onChange={e => updateField('category', e.target.value)}
              options={['General', 'TG Mining', 'VLTD', 'VLTD + Mining']}
              focused={focusedField === 'cat'}
              onFocus={() => setFocusedField('cat')}
              onBlur={() => setFocusedField(null)}
            />

            {/* Sand Mining Filter Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>Enable Sand Mining</span>
                <span style={{ fontSize: '11px', color: '#64748B' }}>Forward live data to TG Mining Government server</span>
              </div>
              <ToggleButton active={form.isSandMining ? 'YES' : 'NO'} onChange={(val) => updateField('isSandMining', val === 'YES')} />
            </div>
          </div>
        </SectionCard>

        {/* Section 2: Fuel Configuration (Matching Screenshot 3) */}
        <SectionCard title="Fuel Configuration" icon={Fuel}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
            
            <SelectField
              label="Fuel Type"
              value={form.metadata.fuelType}
              onChange={e => updateMeta('fuelType', e.target.value)}
              options={['None', 'Diesel', 'Petrol', 'CNG']}
              focused={focusedField === 'fType'}
              onFocus={() => setFocusedField('fType')}
              onBlur={() => setFocusedField(null)}
            />

            <InputField label="Tank Size (Liters)" type="number" value={form.metadata.tankSize} onChange={e => updateMeta('tankSize', e.target.value)} placeholder="0" focused={focusedField === 'tSize'} onFocus={() => setFocusedField('tSize')} onBlur={() => setFocusedField(null)} />
            <InputField label="Fuel Empty ADC (Quick Calib)" type="number" value={form.metadata.fuelEmptyAdc} onChange={e => updateMeta('fuelEmptyAdc', e.target.value)} placeholder="0" focused={focusedField === 'fEmpty'} onFocus={() => setFocusedField('fEmpty')} onBlur={() => setFocusedField(null)} />
            <InputField label="Fuel Full ADC (Quick Calib)" type="number" value={form.metadata.fuelFullAdc} onChange={e => updateMeta('fuelFullAdc', e.target.value)} placeholder="1000" focused={focusedField === 'fFull'} onFocus={() => setFocusedField('fFull')} onBlur={() => setFocusedField(null)} />
            <InputField label="Expected Mileage (km/L)" type="number" value={form.metadata.expectedMileage} onChange={e => updateMeta('expectedMileage', e.target.value)} placeholder="4" focused={focusedField === 'exMil'} onFocus={() => setFocusedField('exMil')} onBlur={() => setFocusedField(null)} />
          </div>
        </SectionCard>

        {/* Section 3: Configuration Details Toggles (Matching Screenshots 3 & 4) */}
        <SectionCard title="Configuration Details" icon={Settings}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '24px' }}>
            <ToggleButton label="Device Odo" active={form.metadata.deviceOdo} onChange={val => updateMeta('deviceOdo', val)} />
            <ToggleButton label="Asset Track" active={form.metadata.assetTrack} onChange={val => updateMeta('assetTrack', val)} />
            <ToggleButton label="Safety Park" active={form.metadata.safetyPark} onChange={val => updateMeta('safetyPark', val)} />
            <ToggleButton label="Rig Mode" active={form.metadata.rigMode} onChange={val => updateMeta('rigMode', val)} />
            <ToggleButton label="Ac Toggle" active={form.metadata.acToggle} onChange={val => updateMeta('acToggle', val)} />
            <ToggleButton label="External Device" active={form.metadata.externalDevice} onChange={val => updateMeta('externalDevice', val)} />
          </div>
        </SectionCard>

        {/* Section 4: Advanced Telemetry & Threshold Settings (Matching Screenshots 4 & 5) */}
        <SectionCard title="Telemetry & Threshold Settings" icon={Cpu}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '24px' }}>
            
            <SelectField
              label="Secondary Engine (AC)"
              value={form.metadata.secondaryEngine}
              onChange={e => updateMeta('secondaryEngine', e.target.value)}
              options={['Digital Input 1', 'Digital Input 2', 'Analog Input', 'Disabled']}
              focused={focusedField === 'secEng'}
              onFocus={() => setFocusedField('secEng')}
              onBlur={() => setFocusedField(null)}
            />

            <SelectField
              label="Engine ON"
              value={form.metadata.engineOnStatus || form.metadata.engineOn}
              onChange={e => { updateMeta('engineOnStatus', e.target.value); updateMeta('engineOn', e.target.value); }}
              options={['Ignition', 'Voltage', 'Voltage+Ignition', 'Digital Input 1', 'Digital Input 2']}
              focused={focusedField === 'engOn'}
              onFocus={() => setFocusedField('engOn')}
              onBlur={() => setFocusedField(null)}
            />

            <InputField label="Vehicle Battery Voltage" value={form.metadata.vehicleVoltage || form.metadata.batteryVoltage} onChange={e => { updateMeta('vehicleVoltage', e.target.value); updateMeta('batteryVoltage', e.target.value); }} placeholder="12V" focused={focusedField === 'vVolt'} onFocus={() => setFocusedField('vVolt')} onBlur={() => setFocusedField(null)} />
            <InputField label="Odometer Reading" type="number" value={form.metadata.odometerReading || form.metadata.odoDistance} onChange={e => { updateMeta('odometerReading', e.target.value); updateMeta('odoDistance', e.target.value); }} placeholder="0" focused={focusedField === 'odoRead'} onFocus={() => setFocusedField('odoRead')} onBlur={() => setFocusedField(null)} />
            
            <InputField label="OverSpeed Limit" type="number" value={form.metadata.overSpeedLimit} onChange={e => updateMeta('overSpeedLimit', e.target.value)} placeholder="60" focused={focusedField === 'osLimit'} onFocus={() => setFocusedField('osLimit')} onBlur={() => setFocusedField(null)} />
            <InputField label="Overspeed Duration (mins)" type="number" value={form.metadata.overspeedDurationAlert} onChange={e => updateMeta('overspeedDurationAlert', e.target.value)} placeholder="3" focused={focusedField === 'osDur'} onFocus={() => setFocusedField('osDur')} onBlur={() => setFocusedField(null)} />
            <InputField label="Idle Duration (mins)" type="number" value={form.metadata.idleDurationAlert} onChange={e => updateMeta('idleDurationAlert', e.target.value)} placeholder="10" focused={focusedField === 'idleDur'} onFocus={() => setFocusedField('idleDur')} onBlur={() => setFocusedField(null)} />
            <InputField label="Expected Mileage" type="number" value={form.metadata.expectedMileage} onChange={e => updateMeta('expectedMileage', e.target.value)} placeholder="4" focused={focusedField === 'expMil2'} onFocus={() => setFocusedField('expMil2')} onBlur={() => setFocusedField(null)} />
            
            <SelectField
              label="Enable Debugs"
              value={form.metadata.enableDebugs}
              onChange={e => updateMeta('enableDebugs', e.target.value)}
              options={['Disable', 'Enable']}
              focused={focusedField === 'dbg'}
              onFocus={() => setFocusedField('dbg')}
              onBlur={() => setFocusedField(null)}
            />

            <SelectField
              label="Timezone"
              value={form.timezone}
              onChange={e => updateField('timezone', e.target.value)}
              options={['IST', 'UTC', 'Asia/Kolkata']}
              focused={focusedField === 'tz'}
              onFocus={() => setFocusedField('tz')}
              onBlur={() => setFocusedField(null)}
            />

            <InputField label="IP Address" value={form.metadata.ipAddress} onChange={e => updateMeta('ipAddress', e.target.value)} placeholder="e.g. 5.223.83.39" focused={focusedField === 'ip'} onFocus={() => setFocusedField('ip')} onBlur={() => setFocusedField(null)} />
            <InputField label="Communicating Port No" value={form.metadata.portNo} onChange={e => updateMeta('portNo', e.target.value)} placeholder="e.g. 5004" focused={focusedField === 'port'} onFocus={() => setFocusedField('port')} onBlur={() => setFocusedField(null)} />
            <InputField label="Low Battery Percentage" type="number" value={form.metadata.lowBattery} onChange={e => updateMeta('lowBattery', e.target.value)} placeholder="20" focused={focusedField === 'lowBat'} onFocus={() => setFocusedField('lowBat')} onBlur={() => setFocusedField(null)} />
          </div>
        </SectionCard>

        {/* Section 5: Multi-Group Assignment (Checkboxes) */}
        <SectionCard title="Multi-Group Assignment" icon={Layers}>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Check all groups this vehicle belongs to. Vehicles will be accessible in operational reports for all checked groups.
              </p>
              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter groups..."
                  value={groupSearchQuery}
                  onChange={(e) => setGroupSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            {/* Checkbox Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-64 overflow-y-auto p-3 bg-slate-50/60 rounded-xl border border-slate-200">
              {filteredGroups.length === 0 ? (
                <div className="col-span-full py-6 text-center text-xs text-slate-400">
                  No groups found.
                </div>
              ) : (
                filteredGroups.map(group => {
                  const isChecked = selectedGroupIds.includes(group.id);

                  return (
                    <label
                      key={group.id}
                      onClick={() => toggleGroup(group.id)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-orange-50 border-orange-300 text-orange-950 font-bold shadow-2xs'
                          : 'bg-white border-slate-200 hover:bg-slate-100/80 text-slate-700 font-medium'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${
                        isChecked ? 'bg-orange-600 text-white' : 'border border-slate-300 bg-white'
                      }`}>
                        {isChecked && <Check size={12} strokeWidth={3} />}
                      </div>
                      <span className="text-xs truncate" title={group.name}>{group.name}</span>
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold pt-1">
              <span>{selectedGroupIds.length} group{selectedGroupIds.length !== 1 ? 's' : ''} selected</span>
              {form.metadata.oldGroups && (
                <span className="text-slate-400">Old Groups: {form.metadata.oldGroups}</span>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Section 6: Owner & KYC */}
        <SectionCard title="Owner & Customer KYC" icon={UserCheck}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
            <InputField label="Owner Name" value={form.metadata.ownerName || form.driverName || ''} onChange={e => { updateMeta('ownerName', e.target.value); updateField('driverName', e.target.value); }} placeholder="Client / Owner Full Name" focused={focusedField === 'oName'} onFocus={() => setFocusedField('oName')} onBlur={() => setFocusedField(null)} />
            <InputField label="Owner Mobile Number" value={form.metadata.ownerPhone || form.driverPhone || ''} onChange={e => { updateMeta('ownerPhone', e.target.value); updateField('driverPhone', e.target.value); }} placeholder="+91 XXXXX XXXXX" focused={focusedField === 'oPhone'} onFocus={() => setFocusedField('oPhone')} onBlur={() => setFocusedField(null)} />
            <InputField label="Owner Email ID" type="email" value={form.metadata.email || ''} onChange={e => updateMeta('email', e.target.value)} placeholder="owner@example.com" focused={focusedField === 'oEmail'} onFocus={() => setFocusedField('oEmail')} onBlur={() => setFocusedField(null)} />
            <InputField label="Owner Location" value={form.metadata.rtoLocation || ''} onChange={e => updateMeta('rtoLocation', e.target.value)} placeholder="e.g. Hyderabad RTO" focused={focusedField === 'oLoc'} onFocus={() => setFocusedField('oLoc')} onBlur={() => setFocusedField(null)} />
            <InputField label="Owner Aadhar Number" value={form.metadata.aadharNo || ''} onChange={e => updateMeta('aadharNo', e.target.value)} placeholder="12-digit Aadhar KYC" focused={focusedField === 'adh'} onFocus={() => setFocusedField('adh')} onBlur={() => setFocusedField(null)} />
            <InputField label="Owner PAN Number" value={form.metadata.panNo || ''} onChange={e => updateMeta('panNo', e.target.value)} placeholder="10-digit PAN (ABCDE1234F)" focused={focusedField === 'pan'} onFocus={() => setFocusedField('pan')} onBlur={() => setFocusedField(null)} />
            <InputField label="Username" value={form.metadata.username || ''} onChange={e => updateMeta('username', e.target.value)} placeholder="Username" focused={focusedField === 'uname'} onFocus={() => setFocusedField('uname')} onBlur={() => setFocusedField(null)} autoComplete="new-password" />
            <InputField label="Password" type="password" value={form.metadata.password || ''} onChange={e => updateMeta('password', e.target.value)} placeholder="Password" focused={focusedField === 'pwd'} onFocus={() => setFocusedField('pwd')} onBlur={() => setFocusedField(null)} autoComplete="new-password" />
          </div>
        </SectionCard>

        {/* Section 7: Personnel & Engineering */}
        <SectionCard title="Field Engineering & Sales Personnel" icon={ShieldCheck}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
            <InputField label="Service Engineer Name" value={form.metadata.serviceEngineer || ''} onChange={e => updateMeta('serviceEngineer', e.target.value)} placeholder="Technician Name" focused={focusedField === 'techName'} onFocus={() => setFocusedField('techName')} onBlur={() => setFocusedField(null)} />
            <InputField label="Service Engineer Mobile Number" value={form.metadata.serviceEngineerPhone || ''} onChange={e => updateMeta('serviceEngineerPhone', e.target.value)} placeholder="+91 XXXXX XXXXX" focused={focusedField === 'techPhone'} onFocus={() => setFocusedField('techPhone')} onBlur={() => setFocusedField(null)} />
            <InputField label="Salesman Name" value={form.metadata.salesman || ''} onChange={e => updateMeta('salesman', e.target.value)} placeholder="Sales Executive Name" focused={focusedField === 'sName'} onFocus={() => setFocusedField('sName')} onBlur={() => setFocusedField(null)} />
            <InputField label="Salesman Mobile Number" value={form.metadata.salesmanPhone || ''} onChange={e => updateMeta('salesmanPhone', e.target.value)} placeholder="+91 XXXXX XXXXX" focused={focusedField === 'sPhone'} onFocus={() => setFocusedField('sPhone')} onBlur={() => setFocusedField(null)} />
          </div>
        </SectionCard>

        {/* Save Bar */}
        <div className="flex justify-end pt-4">
          <button
            onClick={handleSave} disabled={submitting}
            style={{ padding: '16px 40px', borderRadius: '12px', background: '#f97316', border: 'none', color: '#FFFFFF', fontSize: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '12px', cursor: submitting ? 'not-allowed' : 'pointer', boxShadow: '0 10px 20px -5px rgba(249,115,22,0.4)', transition: 'all 0.2s', opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />}
            {isEditing ? 'Save Vehicle Details' : 'Submit Vehicle Registration'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default EditVehiclePage;
