import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, Loader2, AlertTriangle, CheckCircle, RefreshCcw,
  Truck, UserCircle, Settings, Fuel, ChevronRight, Layers, Check, Search, Tag, UserCheck, Cpu, ShieldCheck
} from 'lucide-react';
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
        border: focused ? '1px solid #f97316' : '1px solid #E2E8F0',
        boxShadow: focused ? '0 0 0 3px rgba(249,115,22,0.1)' : 'none',
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

const VEHICLE_MODELS = [
  'Truck', 'Tipper', 'Tanker', 'Bus', 'Car', 'Van', 'Tractor',
  'JCB', 'Crane', 'Ambulance', 'Pickup', 'Borewell', 'Trailer', 'Auto / 3-Wheeler'
];

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
    category: 'General',
    serverName: '', gpsSimNo: '', deviceVersion: 'AIS140', timezone: 'IST', apn: '',
    licenceIssuedDate: '', licenceExpireDate: '', orgId: '',
    metadata: {
      vehicleId: '', vlttdSlno: '', licenceNo: '', iccid: '', sim1: '', sim2: '',
      telecomOperator: '', installationDate: '', onboardDate: '', installedDate: '',
      madeIn: 'India', mfgDate: '', chassisNo: '', engineNo: '', rtoLocation: '',
      altVehicleName: '', remarks: '',
      serviceEngineer: '', serviceEngineerPhone: '', salesman: '', salesmanPhone: '',
      ticketId: '', sensorNo: '',
      engineOnStatus: 'Voltage+Ignition', engineOn: 'Voltage+Ignition', batteryVoltage: '12V', vehicleVoltage: '12V',
      oldGroups: '',
      ownerName: '', ownerPhone: '', customerName: '', customerPhone: '', aadharNo: '', panNo: '',
      fuelMode: 'Manual Calibrate', sensorCount: '1', noOfTanks: '1', fuelType: 'Diesel',
      vehicleMode: 'Moving Vehicle', tankSize: '0', fuelEmptyAdc: '0', fuelFullAdc: '1000', speed: '',
      fuelBatteryVolt: 'NO', consumptionDuringFill: 'NO',
      deviceOdo: 'YES', assetTrack: 'NO', safetyPark: 'NO', rigMode: 'NO', acToggle: 'NO',
      secondaryEngine: 'Digital Input 2',
      odometerReading: '0', overSpeedLimit: '60', overspeedDurationAlert: '3', idleDurationAlert: '10', expectedMileage: '4', enableDebugs: 'Disable',
      countryTimezone: '', ipAddress: '', portNo: '', lowBattery: '20',
      externalDevice: 'NO'
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
            imei: v.imei || '', name: v.name || '', plate: v.plate || '', model: v.model || meta.vehicleModel || 'Truck',
            make: v.make || '', driverName: v.driver_name || '', driverPhone: v.driver_phone || '',
            category: v.category || 'General',
            serverName: v.server_name || '', gpsSimNo: v.gps_sim_no || meta.sim1 || '', deviceVersion: v.device_version || meta.deviceModel || 'AIS140',
            timezone: v.timezone || meta.timezone || 'IST', apn: v.apn || '', orgId: v.org_id || '',
            licenceIssuedDate: v.licence_issued_date ? new Date(v.licence_issued_date).toISOString().split('T')[0] : '',
            licenceExpireDate: v.licence_expire_date ? new Date(v.licence_expire_date).toISOString().split('T')[0] : '',
            metadata: { ...form.metadata, ...meta }
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
        plate: form.plate,
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
        metadata: {
          ...form.metadata,
          sim1: form.gpsSimNo,
          vehicleModel: form.model,
          deviceModel: form.deviceVersion
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
            <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 font-semibold mb-1">
              Vehicles <ChevronRight size={14} /> {isEditing ? 'Edit Vehicle' : 'Register Vehicle'}
            </div>
            <h1 className="text-xl sm:text-3xl font-extrabold text-slate-900 m-0 tracking-tight truncate">
              {isEditing ? form.name || 'Edit Vehicle' : 'Register New Vehicle'}
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

        {/* Section 1: Vehicle & Categorization */}
        <SectionCard title="Vehicle & Model Details" icon={Truck}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
            
            {/* Category Dropdown */}
            <SelectField
              label="Operating Category"
              value={form.category}
              onChange={e => updateField('category', e.target.value)}
              options={['General', 'TG Mining', 'VLTD', 'VLTD + Mining']}
              focused={focusedField === 'cat'}
              onFocus={() => setFocusedField('cat')}
              onBlur={() => setFocusedField(null)}
            />

            <InputField label="Vehicle Name" value={form.name} onChange={e => updateField('name', e.target.value)} placeholder="e.g. Mining Tipper 01" focused={focusedField === 'name'} onFocus={() => setFocusedField('name')} onBlur={() => setFocusedField(null)} />
            <InputField label="Registration / Plate Number" value={form.plate} onChange={e => updateField('plate', e.target.value)} placeholder="e.g. TS09AB1234" focused={focusedField === 'plate'} onFocus={() => setFocusedField('plate')} onBlur={() => setFocusedField(null)} />
            <InputField label="Custom Vehicle ID" value={form.metadata.vehicleId || ''} onChange={e => updateMeta('vehicleId', e.target.value)} placeholder="e.g. TRK-01" focused={focusedField === 'vId'} onFocus={() => setFocusedField('vId')} onBlur={() => setFocusedField(null)} />
            
            {/* Vehicle Model Dropdown */}
            <SelectField
              label="Vehicle Model"
              value={form.model}
              onChange={e => updateField('model', e.target.value)}
              options={VEHICLE_MODELS}
              focused={focusedField === 'model'}
              onFocus={() => setFocusedField('model')}
              onBlur={() => setFocusedField(null)}
            />

            <InputField label="Vehicle Make / Manufacturer" value={form.make} onChange={e => updateField('make', e.target.value)} placeholder="e.g. Tata Signa 4825.TK" focused={focusedField === 'make'} onFocus={() => setFocusedField('make')} onBlur={() => setFocusedField(null)} />
            <InputField label="Chassis Number" value={form.metadata.chassisNo || ''} onChange={e => updateMeta('chassisNo', e.target.value)} placeholder="Chassis / VIN" focused={focusedField === 'chas'} onFocus={() => setFocusedField('chas')} onBlur={() => setFocusedField(null)} />
            <InputField label="Engine Number" value={form.metadata.engineNo || ''} onChange={e => updateMeta('engineNo', e.target.value)} placeholder="Engine Serial No" focused={focusedField === 'eng'} onFocus={() => setFocusedField('eng')} onBlur={() => setFocusedField(null)} />
            <InputField label="RTO / Location" value={form.metadata.rtoLocation || ''} onChange={e => updateMeta('rtoLocation', e.target.value)} placeholder="e.g. Hyderabad RTO" focused={focusedField === 'rto'} onFocus={() => setFocusedField('rto')} onBlur={() => setFocusedField(null)} />
            <InputField label="Installed Date" type="date" value={form.metadata.installationDate || form.metadata.installedDate || ''} onChange={e => updateMeta('installationDate', e.target.value)} focused={focusedField === 'instDate'} onFocus={() => setFocusedField('instDate')} onBlur={() => setFocusedField(null)} />
            <SelectField label="Assigned Organization" value={form.orgId} onChange={e => updateField('orgId', e.target.value)} options={orgs.map(o => ({ value: o.id, label: o.name }))} focused={focusedField === 'org'} onFocus={() => setFocusedField('org')} onBlur={() => setFocusedField(null)} />
          </div>
        </SectionCard>

        {/* Section 2: Device & SIM Hardware */}
        <SectionCard title="GPS Hardware & SIM Configuration" icon={Cpu}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
            
            {/* Device Protocol / Model */}
            <SelectField
              label="Device Type / Protocol"
              value={form.deviceVersion}
              onChange={e => updateField('deviceVersion', e.target.value)}
              options={['AIS140', 'BSTPL', 'CONCOX', 'FMB920', 'VOLTY', 'AIS140 V2', 'GT06N']}
              focused={focusedField === 'dver'}
              onFocus={() => setFocusedField('dver')}
              onBlur={() => setFocusedField(null)}
            />

            <div style={{ position: 'relative' }}>
              <InputField label="Device ID (IMEI Number)" value={form.imei} onChange={e => updateField('imei', e.target.value)} disabled={isEditing} placeholder="15-digit numeric IMEI" />
              {isEditing && <span style={{ position: 'absolute', top: '0', right: '0', fontSize: '11px', color: '#f97316', fontWeight: 700, background: '#EEF5F8', padding: '2px 8px', borderRadius: '4px' }}>Use Migrate</span>}
            </div>

            <InputField label="VLTTD SLNO (Compliance Serial)" value={form.metadata.vlttdSlno || ''} onChange={e => updateMeta('vlttdSlno', e.target.value)} placeholder="e.g. VLT-TS-98721" focused={focusedField === 'vlttd'} onFocus={() => setFocusedField('vlttd')} onBlur={() => setFocusedField(null)} />
            <InputField label="Primary SIM 1 Number" value={form.gpsSimNo} onChange={e => updateField('gpsSimNo', e.target.value)} placeholder="e.g. 9876543210" focused={focusedField === 'gps'} onFocus={() => setFocusedField('gps')} onBlur={() => setFocusedField(null)} />
            <InputField label="Secondary SIM 2 Number" value={form.metadata.sim2 || ''} onChange={e => updateMeta('sim2', e.target.value)} placeholder="Optional backup SIM" focused={focusedField === 'sim2'} onFocus={() => setFocusedField('sim2')} onBlur={() => setFocusedField(null)} />
            <InputField label="SIM ICCID" value={form.metadata.iccid} onChange={e => updateMeta('iccid', e.target.value)} placeholder="19-20 digit ICCID" focused={focusedField === 'iccid'} onFocus={() => setFocusedField('iccid')} onBlur={() => setFocusedField(null)} />
            <InputField label="Sensor No" value={form.metadata.sensorNo || ''} onChange={e => updateMeta('sensorNo', e.target.value)} placeholder="e.g. SNS-FUEL-01" focused={focusedField === 'sns'} onFocus={() => setFocusedField('sns')} onBlur={() => setFocusedField(null)} />
            
            <SelectField
              label="Engine ON Status"
              value={form.metadata.engineOnStatus || form.metadata.engineOn || 'Voltage+Ignition'}
              onChange={e => { updateMeta('engineOnStatus', e.target.value); updateMeta('engineOn', e.target.value); }}
              options={['Voltage+Ignition', 'Ignition', 'Voltage', 'Digital Input 1', 'Digital Input 2']}
              focused={focusedField === 'engon'}
              onFocus={() => setFocusedField('engon')}
              onBlur={() => setFocusedField(null)}
            />

            <InputField label="Vehicle Operating Voltage" value={form.metadata.batteryVoltage || form.metadata.vehicleVoltage || ''} onChange={e => { updateMeta('batteryVoltage', e.target.value); updateMeta('vehicleVoltage', e.target.value); }} placeholder="e.g. 12V or 24V" focused={focusedField === 'volt'} onFocus={() => setFocusedField('volt')} onBlur={() => setFocusedField(null)} />
            <SelectField label="Timezone" value={form.timezone} onChange={e => updateField('timezone', e.target.value)} options={['IST', 'UTC', 'Asia/Kolkata']} focused={focusedField === 'tz'} onFocus={() => setFocusedField('tz')} onBlur={() => setFocusedField(null)} />
          </div>
        </SectionCard>

        {/* Section 3: Multi-Group Assignment (Checkboxes) */}
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

        {/* Section 4: Owner & KYC */}
        <SectionCard title="Owner & Customer KYC" icon={UserCheck}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
            <InputField label="Owner Name" value={form.metadata.ownerName || form.driverName || ''} onChange={e => { updateMeta('ownerName', e.target.value); updateField('driverName', e.target.value); }} placeholder="Client / Owner Full Name" focused={focusedField === 'oName'} onFocus={() => setFocusedField('oName')} onBlur={() => setFocusedField(null)} />
            <InputField label="Owner Mobile Number" value={form.metadata.ownerPhone || form.driverPhone || ''} onChange={e => { updateMeta('ownerPhone', e.target.value); updateField('driverPhone', e.target.value); }} placeholder="+91 XXXXX XXXXX" focused={focusedField === 'oPhone'} onFocus={() => setFocusedField('oPhone')} onBlur={() => setFocusedField(null)} />
            <InputField label="Owner Aadhar Number" value={form.metadata.aadharNo || ''} onChange={e => updateMeta('aadharNo', e.target.value)} placeholder="12-digit Aadhar KYC" focused={focusedField === 'adh'} onFocus={() => setFocusedField('adh')} onBlur={() => setFocusedField(null)} />
            <InputField label="Owner PAN Number" value={form.metadata.panNo || ''} onChange={e => updateMeta('panNo', e.target.value)} placeholder="10-digit PAN (ABCDE1234F)" focused={focusedField === 'pan'} onFocus={() => setFocusedField('pan')} onBlur={() => setFocusedField(null)} />
          </div>
        </SectionCard>

        {/* Section 5: Personnel & Engineering */}
        <SectionCard title="Field Engineering & Sales Personnel" icon={ShieldCheck}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
            <InputField label="Service Engineer Name" value={form.metadata.serviceEngineer || ''} onChange={e => updateMeta('serviceEngineer', e.target.value)} placeholder="Technician Name" focused={focusedField === 'techName'} onFocus={() => setFocusedField('techName')} onBlur={() => setFocusedField(null)} />
            <InputField label="Service Engineer Mobile Number" value={form.metadata.serviceEngineerPhone || ''} onChange={e => updateMeta('serviceEngineerPhone', e.target.value)} placeholder="+91 XXXXX XXXXX" focused={focusedField === 'techPhone'} onFocus={() => setFocusedField('techPhone')} onBlur={() => setFocusedField(null)} />
            <InputField label="Salesman Name" value={form.metadata.salesman || ''} onChange={e => updateMeta('salesman', e.target.value)} placeholder="Sales Executive Name" focused={focusedField === 'sName'} onFocus={() => setFocusedField('sName')} onBlur={() => setFocusedField(null)} />
            <InputField label="Salesman Mobile Number" value={form.metadata.salesmanPhone || ''} onChange={e => updateMeta('salesmanPhone', e.target.value)} placeholder="+91 XXXXX XXXXX" focused={focusedField === 'sPhone'} onFocus={() => setFocusedField('sPhone')} onBlur={() => setFocusedField(null)} />
          </div>
        </SectionCard>

        {/* Section 6: Fuel & Telemetry Configuration */}
        <SectionCard title="Fuel Configuration" icon={Fuel}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4B5563', marginBottom: '4px' }}>Fuel Type</label>
              <select value={form.metadata.fuelType} onChange={e => updateMeta('fuelType', e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '14px' }}>
                <option>None</option>
                <option>Diesel</option>
                <option>Petrol</option>
                <option>CNG</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4B5563', marginBottom: '4px' }}>Tank Size (Liters)</label>
              <input type="number" value={form.metadata.tankSize} onChange={e => updateMeta('tankSize', e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '14px' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4B5563', marginBottom: '4px' }}>OverSpeed Limit (km/h)</label>
              <input type="number" value={form.metadata.overSpeedLimit || '60'} onChange={e => updateMeta('overSpeedLimit', e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '14px' }} />
            </div>
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
