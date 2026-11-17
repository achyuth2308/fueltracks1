import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Home, ChevronRight, Loader2, AlertTriangle, CheckCircle2,
  Cpu, Shuffle, Check
} from 'lucide-react';
import * as vehicleApi from '../../api/vehicleApi';
import * as adminApi from '../../api/adminApi';

const VEHICLE_MODELS = [
  { value: 'truck', label: 'Truck / Lorry' },
  { value: 'car', label: 'Car / Sedan / SUV' },
  { value: 'bike', label: 'Bike / Scooter' },
  { value: 'bus', label: 'Bus / Coach' },
  { value: 'van', label: 'Van / Pickup' },
  { value: 'tractor', label: 'Tractor' },
  { value: 'jcb', label: 'JCB / Heavy Equipment' },
];

const MigrationPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [vehicle, setVehicle] = useState(null);
  const [orgs, setOrgs] = useState([]);

  // Mode: 'replace_hardware' (default) or 'reassign_device'
  const [migrationMode, setMigrationMode] = useState('replace_hardware');

  // Fields for Mode 1: Replace Hardware on Same Vehicle
  const [vehicleId, setVehicleId] = useState('');
  const [deviceImei, setDeviceImei] = useState('');

  // Fields for Mode 2: Move Device to Different Vehicle
  const [reassignPlate, setReassignPlate] = useState('');
  const [reassignName, setReassignName] = useState('');
  const [reassignOrgId, setReassignOrgId] = useState('');
  const [reassignModel, setReassignModel] = useState('truck');
  const [deactivateOld, setDeactivateOld] = useState(true);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    Promise.all([
      vehicleApi.getVehicleById(id),
      adminApi.getOrgs().catch(() => ({ data: [] }))
    ])
      .then(([vehRes, orgRes]) => {
        const v = vehRes.data || vehRes;
        setVehicle(v);
        setVehicleId(v.plate || v.name || v.imei || '');
        setDeviceImei('');
        setReassignOrgId(v.org_id || '');
        setReassignModel(v.model || 'truck');
        setOrgs(Array.isArray(orgRes.data) ? orgRes.data : (Array.isArray(orgRes) ? orgRes : []));
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load vehicle for migration:', err);
        setError('Failed to load vehicle details.');
        setLoading(false);
      });
  }, [id]);

  const handleMigrate = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setSuccess('');

    // MODE 1: Replace Hardware Device on Same Vehicle
    if (migrationMode === 'replace_hardware') {
      const cleanImei = deviceImei.trim();
      if (!cleanImei || !/^\d{15}$/.test(cleanImei)) {
        setError('Please enter a valid 15-digit Device ID / IMEI No.');
        return;
      }

      if (vehicle?.imei && cleanImei === vehicle.imei) {
        setError('Target IMEI is identical to current IMEI. Please enter the new device IMEI.');
        return;
      }

      setMigrating(true);
      try {
        if (vehicleId && vehicleId.trim() !== (vehicle?.plate || vehicle?.name || vehicle?.imei)) {
          await vehicleApi.updateVehicle(id, {
            ...vehicle,
            plate: vehicleId.trim().toUpperCase(),
            name: vehicleId.trim()
          });
        }

        await vehicleApi.migrateVehicle(id, { mode: 'replace_hardware', newImei: cleanImei });

        setSuccess('Vehicle migrated successfully! New hardware device linked.');
        setTimeout(() => {
          navigate('/admin/vehicles');
        }, 1200);
      } catch (err) {
        setError(err.response?.data?.error || err.message || 'Failed to migrate vehicle');
      } finally {
        setMigrating(false);
      }
      return;
    }

    // MODE 2: Move Device to Different Vehicle
    if (migrationMode === 'reassign_device') {
      if (!reassignPlate || !reassignPlate.trim()) {
        setError('Please enter the registration plate for the new vehicle.');
        return;
      }

      if (vehicle?.plate && reassignPlate.trim().toUpperCase() === vehicle.plate.trim().toUpperCase()) {
        setError('The new vehicle plate must be different from current vehicle plate.');
        return;
      }

      setMigrating(true);
      try {
        await vehicleApi.migrateVehicle(id, {
          mode: 'reassign_device',
          newPlate: reassignPlate.trim().toUpperCase(),
          newName: (reassignName || reassignPlate).trim().toUpperCase(),
          targetOrgId: reassignOrgId,
          model: reassignModel,
          deactivateOldVehicle: deactivateOld
        });

        setSuccess('Tracker moved to new vehicle successfully!');
        setTimeout(() => {
          navigate('/admin/vehicles');
        }, 1300);
      } catch (err) {
        setError(err.response?.data?.error || err.message || 'Failed to reassign device');
      } finally {
        setMigrating(false);
      }
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '12px' }}>
        <Loader2 size={32} className="animate-spin" color="#f97316" />
        <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Loading Vehicle Migration...</span>
      </div>
    );
  }

  const displayVehicleId = vehicle?.plate || vehicle?.name || vehicle?.imei || 'Vehicle';
  const isImeiValid = /^\d{15}$/.test(deviceImei.trim());

  return (
    <div style={{
      background: '#f8fafc',
      minHeight: '100%',
      padding: '20px 30px',
      boxSizing: 'border-box',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    }}>
      <div style={{ maxWidth: '1020px', margin: '0 auto' }}>

        {/* 1. Top Header & Breadcrumb (Inspired by sample, refined with FuelTracks styling) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '20px'
        }}>
          {/* Left Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={() => navigate('/admin/vehicles')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                cursor: 'pointer',
                color: '#334155',
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
              onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
              title="Back to Vehicles"
            >
              <ArrowLeft size={16} />
            </button>
            <h1 style={{
              fontSize: '22px',
              fontWeight: 800,
              color: '#0f172a',
              margin: 0,
              letterSpacing: '-0.02em'
            }}>
              Vehicle Migration
            </h1>
          </div>

          {/* Right Breadcrumb */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            color: '#64748b',
            fontWeight: 500
          }}>
            <span
              onClick={() => navigate('/admin/vehicles')}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#64748b' }}
              title="Home / Vehicles"
            >
              <Home size={15} />
            </span>
            <ChevronRight size={13} color="#94a3b8" />
            <span
              onClick={() => navigate('/admin/vehicles')}
              style={{ cursor: 'pointer', transition: 'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color = '#ea580c'}
              onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
            >
              Vehicle list
            </span>
            <ChevronRight size={13} color="#94a3b8" />
            <span>Vehicle Migration</span>
            <ChevronRight size={13} color="#94a3b8" />
            <span style={{ color: '#ea580c', fontWeight: 800 }}>{displayVehicleId}</span>
          </div>
        </div>

        {/* 2. Main Form Card */}
        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden'
        }}>
          {/* Card Header */}
          <div style={{
            padding: '16px 28px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <h2 style={{
              fontSize: '16px',
              fontWeight: 700,
              color: '#1e293b',
              margin: 0
            }}>
              Vehicle Migration
            </h2>

            {/* Mode Switcher Pills (Solid Deep FuelTracks Orange) */}
            <div style={{
              display: 'inline-flex',
              background: '#f1f5f9',
              padding: '4px',
              borderRadius: '9px',
              gap: '4px',
              border: '1px solid #e2e8f0'
            }}>
              <button
                type="button"
                onClick={() => { setMigrationMode('replace_hardware'); setError(''); }}
                style={{
                  padding: '6px 16px',
                  borderRadius: '7px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  background: migrationMode === 'replace_hardware' ? '#ea580c' : 'transparent',
                  color: migrationMode === 'replace_hardware' ? '#ffffff' : '#475569',
                  boxShadow: migrationMode === 'replace_hardware' ? '0 2px 5px rgba(234, 88, 12, 0.3)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                Replace Device
              </button>
              <button
                type="button"
                onClick={() => { setMigrationMode('reassign_device'); setError(''); }}
                style={{
                  padding: '6px 16px',
                  borderRadius: '7px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  background: migrationMode === 'reassign_device' ? '#ea580c' : 'transparent',
                  color: migrationMode === 'reassign_device' ? '#ffffff' : '#475569',
                  boxShadow: migrationMode === 'reassign_device' ? '0 2px 5px rgba(234, 88, 12, 0.3)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                Move to New Vehicle
              </button>
            </div>
          </div>

          {/* Form Content */}
          <form onSubmit={handleMigrate} style={{ padding: '36px 28px 40px 28px' }}>

            {/* Error & Success Messages */}
            {error && (
              <div style={{
                maxWidth: '680px',
                margin: '0 auto 24px auto',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#dc2626',
                fontSize: '13px',
                fontWeight: 600
              }}>
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div style={{
                maxWidth: '680px',
                margin: '0 auto 24px auto',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#16a34a',
                fontSize: '13px',
                fontWeight: 700
              }}>
                <CheckCircle2 size={16} />
                <span>{success}</span>
              </div>
            )}

            {/* ─────────────── MODE 1: REPLACE DEVICE (Matching the sample layout) ─────────────── */}
            {migrationMode === 'replace_hardware' ? (
              <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '22px' }}>

                {/* Field 1: Vehicle Id */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <label style={{
                    width: '180px',
                    textAlign: 'right',
                    fontSize: '13.5px',
                    fontWeight: 600,
                    color: '#334155',
                    flexShrink: 0
                  }}>
                    Vehicle Id :
                  </label>
                  <input
                    type="text"
                    value={vehicleId}
                    onChange={e => setVehicleId(e.target.value)}
                    style={{
                      flex: 1,
                      height: '40px',
                      padding: '0 14px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      fontSize: '13.5px',
                      fontWeight: 700,
                      color: '#0f172a',
                      outline: 'none',
                      transition: 'border-color 0.15s'
                    }}
                    onFocus={e => e.target.style.borderColor = '#ea580c'}
                    onBlur={e => e.target.style.borderColor = '#cbd5e1'}
                  />
                </div>

                {/* Field 2: Device Id / IMEI No */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <label style={{
                    width: '180px',
                    textAlign: 'right',
                    fontSize: '13.5px',
                    fontWeight: 600,
                    color: '#334155',
                    flexShrink: 0
                  }}>
                    Device Id / IMEI No :
                  </label>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input
                      type="text"
                      required
                      value={deviceImei}
                      onChange={e => setDeviceImei(e.target.value.replace(/\D/g, '').slice(0, 15))}
                      placeholder="Enter 15-digit Device Id / IMEI"
                      style={{
                        width: '100%',
                        height: '40px',
                        padding: '0 14px',
                        borderRadius: '6px',
                        border: isImeiValid ? '1.5px solid #10b981' : '1px solid #cbd5e1',
                        background: '#ffffff',
                        fontSize: '13.5px',
                        fontWeight: 600,
                        fontFamily: 'monospace',
                        color: '#0f172a',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.15s'
                      }}
                      onFocus={e => { if (!isImeiValid) e.target.style.borderColor = '#ea580c'; }}
                      onBlur={e => { if (!isImeiValid) e.target.style.borderColor = '#cbd5e1'; }}
                    />
                    {isImeiValid && (
                      <span style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#10b981',
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        <Check size={16} />
                      </span>
                    )}
                  </div>
                </div>

                {/* Current Hardware Hint */}
                {vehicle?.imei && (
                  <div style={{
                    marginLeft: '200px',
                    fontSize: '11.5px',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span>Current Active IMEI:</span>
                    <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>{vehicle.imei}</strong>
                  </div>
                )}

              </div>
            ) : (
              /* ─────────────── MODE 2: MOVE TO NEW VEHICLE ─────────────── */
              <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>

                {/* Current Tracker Info (FuelTracks Warm Pastel Styling) */}
                <div style={{
                  padding: '11px 18px',
                  background: '#fff7ed',
                  borderRadius: '8px',
                  border: '1px solid #fed7aa',
                  fontSize: '12.5px',
                  color: '#9a3412',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <span>Moving Tracker IMEI:</span>
                  <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>{vehicle?.imei || 'Not Set'}</strong>
                  <span style={{ color: '#fed7aa' }}>|</span>
                  <span>From: <strong style={{ color: '#0f172a' }}>{displayVehicleId}</strong></span>
                </div>

                {/* New Vehicle Plate */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <label style={{ width: '180px', textAlign: 'right', fontSize: '13.5px', fontWeight: 600, color: '#334155', flexShrink: 0 }}>
                    New Vehicle Plate :
                  </label>
                  <input
                    type="text"
                    required
                    value={reassignPlate}
                    onChange={e => setReassignPlate(e.target.value.toUpperCase())}
                    placeholder="e.g. AP39TV1234"
                    style={{
                      flex: 1,
                      height: '40px',
                      padding: '0 14px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13.5px',
                      fontWeight: 700,
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.15s'
                    }}
                    onFocus={e => e.target.style.borderColor = '#ea580c'}
                    onBlur={e => e.target.style.borderColor = '#cbd5e1'}
                  />
                </div>

                {/* Model / Type */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <label style={{ width: '180px', textAlign: 'right', fontSize: '13.5px', fontWeight: 600, color: '#334155', flexShrink: 0 }}>
                    Vehicle Model :
                  </label>
                  <select
                    value={reassignModel}
                    onChange={e => setReassignModel(e.target.value)}
                    style={{
                      flex: 1,
                      height: '40px',
                      padding: '0 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '13.5px',
                      fontWeight: 600,
                      color: '#0f172a',
                      outline: 'none',
                      transition: 'border-color 0.15s'
                    }}
                    onFocus={e => e.target.style.borderColor = '#ea580c'}
                    onBlur={e => e.target.style.borderColor = '#cbd5e1'}
                  >
                    {VEHICLE_MODELS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>

                {/* Organization */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <label style={{ width: '180px', textAlign: 'right', fontSize: '13.5px', fontWeight: 600, color: '#334155', flexShrink: 0 }}>
                    Assign Organization :
                  </label>
                  <select
                    value={reassignOrgId}
                    onChange={e => setReassignOrgId(e.target.value)}
                    style={{
                      flex: 1,
                      height: '40px',
                      padding: '0 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '13.5px',
                      fontWeight: 600,
                      color: '#0f172a',
                      outline: 'none',
                      transition: 'border-color 0.15s'
                    }}
                    onFocus={e => e.target.style.borderColor = '#ea580c'}
                    onBlur={e => e.target.style.borderColor = '#cbd5e1'}
                  >
                    {orgs.map(o => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>

                {/* Archive Old Vehicle */}
                <div style={{
                  marginLeft: '200px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <input
                    type="checkbox"
                    id="archiveOld"
                    checked={deactivateOld}
                    onChange={e => setDeactivateOld(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#ea580c', cursor: 'pointer' }}
                  />
                  <label htmlFor="archiveOld" style={{ fontSize: '12.5px', color: '#475569', cursor: 'pointer', fontWeight: 500 }}>
                    Deactivate old vehicle (<strong>{displayVehicleId}</strong>) while archiving past trips
                  </label>
                </div>

              </div>
            )}

            {/* 3. Centered Action Buttons (FuelTracks Primary Orange & Clean Secondary) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '14px',
              marginTop: '36px'
            }}>
              {/* Cancel Button */}
              <button
                type="button"
                onClick={() => navigate('/admin/vehicles')}
                style={{
                  height: '40px',
                  padding: '0 26px',
                  borderRadius: '8px',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.color = '#0f172a'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#475569'; }}
              >
                Cancel
              </button>

              {/* Migrate Vehicle Button (Deep Solid FuelTracks Orange) */}
              <button
                type="submit"
                disabled={migrating}
                style={{
                  height: '42px',
                  padding: '0 34px',
                  borderRadius: '8px',
                  background: '#ea580c',
                  color: '#ffffff',
                  fontSize: '13.5px',
                  fontWeight: 800,
                  border: 'none',
                  cursor: migrating ? 'not-allowed' : 'pointer',
                  boxShadow: '0 3px 10px rgba(234, 88, 12, 0.35)',
                  transition: 'all 0.15s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: 1
                }}
                onMouseEnter={e => { if (!migrating) e.currentTarget.style.background = '#c2410c'; }}
                onMouseLeave={e => { if (!migrating) e.currentTarget.style.background = '#ea580c'; }}
              >
                {migrating && <Loader2 size={16} className="animate-spin" />}
                <span>{migrating ? 'Migrating...' : 'Migrate Vehicle'}</span>
              </button>
            </div>

          </form>
        </div>

      </div>
    </div>
  );
};

export default MigrationPage;
