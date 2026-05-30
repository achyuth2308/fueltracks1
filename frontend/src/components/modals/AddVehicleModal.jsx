import React, { useState, useEffect } from 'react';
import { X, Loader2, Cpu, AlertCircle, CheckCircle } from 'lucide-react';
import * as adminApi from '../../api/adminApi';

const FieldLabel = ({ children, required }) => (
  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#374151', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '5px' }}>
    {children} {required && <span style={{ color: '#2563eb' }}>*</span>}
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
  background: 'rgba(0,0,0,0.35)',
  border: `1px solid ${focused ? 'rgba(37,99,235,0.6)' : 'rgba(255,255,255,0.06)'}`,
  borderRadius: '7px', color: '#e2e8f0', fontSize: '12px',
  fontFamily: 'Inter, sans-serif', outline: 'none',
  boxShadow: focused ? '0 0 0 3px rgba(37,99,235,0.1)' : 'none',
  transition: 'all 0.15s', boxSizing: 'border-box',
});

const AddVehicleModal = ({ isOpen, onClose, onSave, vehicle = null, orgs = [] }) => {
  const [form, setForm] = useState({ imei: '', name: '', plate: '', model: '', make: '', driverName: '', driverPhone: '', orgId: '', groupIds: [] });
  const [availableGroups, setAvailableGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [focused, setFocused] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    if (vehicle) {
      setForm({ imei: vehicle.imei || '', name: vehicle.name || '', plate: vehicle.plate || '', model: vehicle.model || '', make: vehicle.make || '', driverName: vehicle.driver_name || '', driverPhone: vehicle.driver_phone || '', orgId: vehicle.org_id || '', groupIds: vehicle.groups ? vehicle.groups.map(g => g.id) : [] });
    } else {
      setForm({ imei: '', name: '', plate: '', model: '', make: '', driverName: '', driverPhone: '', orgId: orgs.length > 0 ? orgs[0].id : '', groupIds: [] });
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
    setLoading(true); setError(null);
    try {
      await onSave({ ...form, driverName: form.driverName, driverPhone: form.driverPhone, orgId: form.orgId, groupIds: form.groupIds });
      onClose();
    } catch (err) { setError(err.response?.data?.error || 'Failed to save vehicle.'); }
    finally { setLoading(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '540px' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Cpu size={16} color="#2563eb" />
            </div>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.02em', margin: 0 }}>
                {vehicle ? 'Edit Vehicle' : 'Register Vehicle'}
              </h3>
              <p style={{ fontSize: '11px', color: '#374151', margin: 0 }}>
                {vehicle ? 'Update fleet asset details' : 'Bind IMEI device to fleet'}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: '28px', height: '28px', borderRadius: '7px', border: 'none', background: 'rgba(255,255,255,0.04)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#e2e8f0'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#374151'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}>
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '65vh', overflowY: 'auto' }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 11px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '7px' }}>
              <AlertCircle size={13} color="#f87171" />
              <span style={{ fontSize: '12px', color: '#f87171', fontWeight: 500 }}>{error}</span>
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
            <Field label="License Plate">
              <input type="text" value={form.plate} onChange={e => update('plate', e.target.value)} placeholder="MH12AB1234"
                style={inputStyle(focused === 'plate')} onFocus={() => setFocused('plate')} onBlur={() => setFocused(null)} />
            </Field>
          </div>

          {/* Name + Model */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Field label="Vehicle Name" required>
              <input type="text" required value={form.name} onChange={e => update('name', e.target.value)} placeholder="Truck Alpha"
                style={inputStyle(focused === 'name')} onFocus={() => setFocused('name')} onBlur={() => setFocused(null)} />
            </Field>
            <Field label="Model">
              <input type="text" value={form.model} onChange={e => update('model', e.target.value)} placeholder="Tata Prima 3518"
                style={inputStyle(focused === 'model')} onFocus={() => setFocused('model')} onBlur={() => setFocused(null)} />
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
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '7px' }}>
                {availableGroups.map(g => {
                  const selected = form.groupIds.includes(g.id);
                  return (
                    <button key={g.id} type="button" onClick={() => toggleGroup(g.id)} style={{
                      padding: '4px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                      background: selected ? 'rgba(37,99,235,0.15)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${selected ? 'rgba(37,99,235,0.4)' : 'rgba(255,255,255,0.06)'}`,
                      color: selected ? '#60a5fa' : '#374151', transition: 'all 0.15s',
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
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '7px', color: '#4a5568', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', background: loading ? 'rgba(37,99,235,0.4)' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', border: '1px solid rgba(37,99,235,0.4)', borderRadius: '7px', color: 'white', fontSize: '12px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}>
            {loading ? <><Loader2 size={13} style={{ animation: 'spin 0.75s linear infinite' }} /> Saving...</> : <>{vehicle ? 'Update Vehicle' : 'Register Vehicle'}</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddVehicleModal;
