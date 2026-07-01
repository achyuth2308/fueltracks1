import React, { useState, useEffect } from 'react';
import CustomDatePicker from '../ui/CustomDatePicker';
import { X, Loader2, Cpu, AlertCircle, CheckCircle } from 'lucide-react';
import * as adminApi from '../../api/adminApi';

const FieldLabel = ({ children, required }) => (
  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748B', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '5px' }}>
    {children} {required && <span style={{ color: '#f97316' }}>*</span>}
  </label>
);

const Field = ({ label, required, children }) => (
  <div>
    <FieldLabel required={required}>{label}</FieldLabel>
    {children}
  </div>
);

const inputStyle = (focused) => ({
  width: '100%', padding: '9px 11px',
  background: '#FFFFFF',
  border: `1px solid ${focused ? '#f97316' : '#E2E8F0'}`,
  borderRadius: '7px', color: '#111827', fontSize: '12px',
  fontFamily: 'Inter, sans-serif', outline: 'none',
  boxShadow: focused ? '0 0 0 3px rgba(249,115,22,0.1)' : 'none',
  transition: 'all 0.15s', boxSizing: 'border-box',
});

const AddVehicleModal = ({ isOpen, onClose, onSave, vehicle = null, orgs = [] }) => {
  const [form, setForm] = useState({ imei: '', name: '', plate: '', model: '', make: '', driverName: '', driverPhone: '', serverName: '', gpsSimNo: '', deviceVersion: '', timezone: '', apn: '', licenceIssuedDate: '', licenceExpireDate: '', orgId: '', groupIds: [] });
  const [availableGroups, setAvailableGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [focused, setFocused] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    if (vehicle) {
      setForm({
        imei: vehicle.imei || '', name: vehicle.name || '', plate: vehicle.plate || '',
        model: vehicle.model || '', make: vehicle.make || '', driverName: vehicle.driver_name || '', driverPhone: vehicle.driver_phone || '',
        serverName: vehicle.server_name || '', gpsSimNo: vehicle.gps_sim_no || '', deviceVersion: vehicle.device_version || '',
        timezone: vehicle.timezone || '', apn: vehicle.apn || '',
        licenceIssuedDate: vehicle.licence_issued_date ? new Date(vehicle.licence_issued_date).toISOString().split('T')[0] : '',
        licenceExpireDate: vehicle.licence_expire_date ? new Date(vehicle.licence_expire_date).toISOString().split('T')[0] : '',
        orgId: vehicle.org_id || '', groupIds: vehicle.groups ? vehicle.groups.map(g => g.id) : []
      });
    } else {
      setForm({ imei: '', name: '', plate: '', model: '', make: '', driverName: '', driverPhone: '', serverName: '', gpsSimNo: '', deviceVersion: '', timezone: '', apn: '', licenceIssuedDate: '', licenceExpireDate: '', orgId: orgs.length > 0 ? orgs[0].id : '', groupIds: [] });
    }
    setError(null);
  }, [vehicle, isOpen, orgs]);

  useEffect(() => {
    if (!isOpen) return;
    adminApi.getGroups().then(res => {
      if (res.success) {
        const filtered = res.data.filter(g => g.org_id === (form.orgId || vehicle?.org_id));
        setAvailableGroups(filtered);
      }
    }).catch(() => {});
  }, [form.orgId, isOpen, vehicle]);

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
  const toggleGroup = (id) => update('groupIds', form.groupIds.includes(id) ? form.groupIds.filter(x => x !== id) : [...form.groupIds, id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.imei || !/^\d{15}$/.test(form.imei)) { setError('IMEI must be exactly 15 digits.'); return; }
    if (!form.name || form.name.trim() === '') { setError('Vehicle Name is mandatory.'); return; }
    setLoading(true); setError(null);
    try {
      await onSave({ ...form });
      onClose();
    } catch (err) { setError(err.response?.data?.error || 'Failed to save vehicle.'); }
    finally { setLoading(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ background: 'rgba(15,23,42,0.6)' }}>
      <div className="modal-box" style={{ maxWidth: '540px', background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: '#EEF5F8', border: '1px solid #FFE4D6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Cpu size={16} color="#f97316" />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em', margin: 0 }}>
                {vehicle ? 'Edit Vehicle' : 'Register Vehicle'}
              </h3>
              <p style={{ fontSize: '12px', color: '#64748B', margin: 0, fontWeight: 500 }}>
                {vehicle ? 'Update fleet asset details' : 'Bind IMEI device to fleet'}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: '28px', height: '28px', borderRadius: '7px', border: 'none', background: '#EEF5F8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#111827'; e.currentTarget.style.background = '#F1F5F9'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#64748B'; e.currentTarget.style.background = '#F8FAFC'; }}>
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '65vh', overflowY: 'auto' }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 11px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '7px' }}>
              <AlertCircle size={13} color="#EF4444" />
              <span style={{ fontSize: '12px', color: '#EF4444', fontWeight: 600 }}>{error}</span>
            </div>
          )}

          {/* IMEI + Plate */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Field label="Device IMEI" required>
              <input
                type="text" required value={form.imei} disabled={!!vehicle}
                onChange={e => update('imei', e.target.value.replace(/\D/g, '').slice(0, 15))}
                placeholder="865006049210215"
                style={{ ...inputStyle(focused === 'imei'), opacity: vehicle ? 0.5 : 1 }}
                onFocus={() => setFocused('imei')} onBlur={() => setFocused(null)}
              />
              <div style={{ fontSize: '9px', color: '#2d3748', marginTop: '3px', fontFamily: 'JetBrains Mono, monospace' }}>
                {form.imei.length}/15 digits
              </div>
            </Field>
            <Field label="Vehicle Registration Number">
              <input type="text" value={form.plate} onChange={e => update('plate', e.target.value)} placeholder="MH12AB1234"
                style={inputStyle(focused === 'plate')} onFocus={() => setFocused('plate')} onBlur={() => setFocused(null)} />
            </Field>
          </div>

          {/* Name + Type + Model */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <Field label="Vehicle Name" required>
              <input type="text" required value={form.name} onChange={e => update('name', e.target.value)} placeholder="Truck Alpha"
                style={inputStyle(focused === 'name')} onFocus={() => setFocused('name')} onBlur={() => setFocused(null)} />
            </Field>
            <Field label="Vehicle Type">
              <select value={form.model} onChange={e => update('model', e.target.value)}
                style={{ ...inputStyle(focused === 'model'), cursor: 'pointer' }} onFocus={() => setFocused('model')} onBlur={() => setFocused(null)}>
                <option value="">Select Type</option>
                <option value="Truck">Truck</option>
                <option value="Bus">Bus</option>
                <option value="Car">Car</option>
                <option value="Van">Van</option>
                <option value="Scooty">Scooty</option>
                <option value="Motorcycle">Motorcycle</option>
                <option value="Tractor">Tractor</option>
                <option value="JCB">JCB</option>
                <option value="Crane">Crane</option>
                <option value="Ambulance">Ambulance</option>
                <option value="Pickup">Pickup</option>
                <option value="Borewell">Borewell</option>
                <option value="Tanker">Tanker</option>
              </select>
            </Field>
            <Field label="Vehicle Model">
              <input type="text" value={form.make} onChange={e => update('make', e.target.value)} placeholder="Tata Prima 3518"
                style={inputStyle(focused === 'make')} onFocus={() => setFocused('make')} onBlur={() => setFocused(null)} />
            </Field>
          </div>

          {/* Driver */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Field label="Driver Name">
              <input type="text" value={form.driverName} onChange={e => update('driverName', e.target.value)} placeholder="Ravi Kumar"
                style={inputStyle(focused === 'driverName')} onFocus={() => setFocused('driverName')} onBlur={() => setFocused(null)} />
            </Field>
            <Field label="Driver Phone">
              <input type="text" value={form.driverPhone} onChange={e => update('driverPhone', e.target.value)} placeholder="+91 98765 43210"
                style={inputStyle(focused === 'driverPhone')} onFocus={() => setFocused('driverPhone')} onBlur={() => setFocused(null)} />
            </Field>
          </div>

          {/* New Device Fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Field label="Server Name">
              <input type="text" value={form.serverName} onChange={e => update('serverName', e.target.value)} placeholder="137.184.248.156"
                style={inputStyle(focused === 'serverName')} onFocus={() => setFocused('serverName')} onBlur={() => setFocused(null)} />
            </Field>
            <Field label="GPS SIM No">
              <input type="text" value={form.gpsSimNo} onChange={e => update('gpsSimNo', e.target.value)} placeholder="9999999999"
                style={inputStyle(focused === 'gpsSimNo')} onFocus={() => setFocused('gpsSimNo')} onBlur={() => setFocused(null)} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <Field label="Version">
              <input type="text" value={form.deviceVersion} onChange={e => update('deviceVersion', e.target.value)} placeholder="1.0"
                style={inputStyle(focused === 'deviceVersion')} onFocus={() => setFocused('deviceVersion')} onBlur={() => setFocused(null)} />
            </Field>
            <Field label="Time Zone">
              <input type="text" value={form.timezone} onChange={e => update('timezone', e.target.value)} placeholder="UTC+05:30"
                style={inputStyle(focused === 'timezone')} onFocus={() => setFocused('timezone')} onBlur={() => setFocused(null)} />
            </Field>
            <Field label="APN">
              <input type="text" value={form.apn} onChange={e => update('apn', e.target.value)} placeholder="internet"
                style={inputStyle(focused === 'apn')} onFocus={() => setFocused('apn')} onBlur={() => setFocused(null)} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Field label="Licence Issued Date">
              <CustomDatePicker value={form.licenceIssuedDate} onChange={e => update('licenceIssuedDate', e.target.value)}
                style={inputStyle(focused === 'licenceIssuedDate')} onFocus={() => setFocused('licenceIssuedDate')} onBlur={() => setFocused(null)} />
            </Field>
            <Field label="Licence Expire Date">
              <CustomDatePicker value={form.licenceExpireDate} onChange={e => update('licenceExpireDate', e.target.value)}
                style={inputStyle(focused === 'licenceExpireDate')} onFocus={() => setFocused('licenceExpireDate')} onBlur={() => setFocused(null)} />
            </Field>
            <Field label="Licence Number">
              <input type="text" value={form.metadata?.licenceNo || ''} onChange={e => setForm(prev => ({ ...prev, metadata: { ...prev.metadata, licenceNo: e.target.value } }))} placeholder="e.g. DL-12345"
                style={inputStyle(focused === 'licenceNo')} onFocus={() => setFocused('licenceNo')} onBlur={() => setFocused(null)} />
            </Field>
          </div>

          {/* Org selector */}
          {orgs.length > 0 && (
            <Field label="Organization" required>
              <select value={form.orgId} onChange={e => update('orgId', e.target.value)} style={{ ...inputStyle(focused === 'org'), appearance: 'none', cursor: 'pointer' }}
                onFocus={() => setFocused('org')} onBlur={() => setFocused(null)}>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name} ({o.type})</option>)}
              </select>
            </Field>
          )}

          {/* Groups */}
          {availableGroups.length > 0 && (
            <Field label="Sub-Fleet Groups">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '8px', background: '#FAFAF9', border: '1px solid #E2E8F0', borderRadius: '7px' }}>
                {availableGroups.map(g => {
                  const selected = form.groupIds.includes(g.id);
                  return (
                    <button key={g.id} type="button" onClick={() => toggleGroup(g.id)} style={{
                      padding: '4px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                      background: selected ? '#f0f9ff' : '#FFFFFF',
                      border: `1px solid ${selected ? '#f97316' : '#E2E8F0'}`,
                      color: selected ? '#f97316' : '#64748B', transition: 'all 0.15s',
                    }}>
                      {selected && '✓ '}{g.name}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}
        </form>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '14px 20px', borderTop: '1px solid #F1F5F9' }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '7px', color: '#475569', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'} onMouseLeave={e => e.currentTarget.style.background = '#FFFFFF'}>
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', background: loading ? '#ea580c' : '#f97316', border: 'none', borderRadius: '7px', color: 'white', fontSize: '12px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', boxShadow: '0 4px 12px rgba(249,115,22,0.2)', transition: 'background 0.15s' }} onMouseEnter={e => { if(!loading) e.currentTarget.style.background = '#7ea0b6' }} onMouseLeave={e => { if(!loading) e.currentTarget.style.background = '#f97316' }}>
            {loading ? <><Loader2 size={13} style={{ animation: 'spin 0.75s linear infinite' }} /> Saving...</> : <>{vehicle ? 'Update Vehicle' : 'Register Vehicle'}</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddVehicleModal;
