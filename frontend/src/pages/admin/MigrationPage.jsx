import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertTriangle, CheckCircle, Shuffle, Cpu, ArrowRight, ShieldCheck, RefreshCw, ChevronRight, Home } from 'lucide-react';
import * as vehicleApi from '../../api/vehicleApi';
import * as adminApi from '../../api/adminApi';

const VEHICLE_MODELS = [
  { value: 'truck', label: 'Truck / Lorry' },
  { value: 'car', label: 'Car' },
  { value: 'bike', label: 'Bike / Scooter' },
  { value: 'bus', label: 'Bus' },
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

  // Mode: 'replace_hardware' (same vehicle, new device, keeps history)
  //   or 'reassign_device' (same device, new vehicle/customer, clean slate)
  const [migrationMode, setMigrationMode] = useState('replace_hardware');

  // Fields for Mode 1: Replace Hardware on Same Vehicle
  const [newVehicleId, setNewVehicleId] = useState('');
  const [newImei, setNewImei] = useState('');

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
        setNewVehicleId(v.plate || v.name || v.imei || '');
        setNewImei('');
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
      if (!newImei || !/^\d{15}$/.test(newImei)) {
        setError('Please enter a valid 15-digit target Device ID / IMEI.');
        return;
      }

      if (vehicle?.imei && newImei === vehicle.imei) {
        setError('Target IMEI is identical to current IMEI. Please enter the new device IMEI to migrate to.');
        return;
      }

      setMigrating(true);
      try {
        if (newVehicleId && newVehicleId !== (vehicle?.plate || vehicle?.name || vehicle?.imei)) {
          await vehicleApi.updateVehicle(id, {
            ...vehicle,
            plate: newVehicleId,
            name: newVehicleId
          });
        }

        await vehicleApi.migrateVehicle(id, { mode: 'replace_hardware', newImei });

        setSuccess('Hardware replaced successfully! All past telemetry and trip history are preserved.');
        setTimeout(() => {
          navigate('/admin/vehicles');
        }, 1300);
      } catch (err) {
        setError(err.response?.data?.error || err.message || 'Failed to replace device');
      } finally {
        setMigrating(false);
      }
      return;
    }

    // MODE 2: Move Device to Different Vehicle / Customer (Clean History)
    if (migrationMode === 'reassign_device') {
      if (!reassignPlate || !reassignPlate.trim()) {
        setError('Please enter the registration plate for the new vehicle.');
        return;
      }

      if (vehicle?.plate && reassignPlate.trim().toUpperCase() === vehicle.plate.trim().toUpperCase()) {
        setError('The new vehicle plate must be different from the current vehicle plate.');
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

        setSuccess('Device transferred to new vehicle! The new vehicle starts fresh with zero previous history.');
        setTimeout(() => {
          navigate('/admin/vehicles');
        }, 1400);
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
  const isImeiValid = /^\d{15}$/.test(newImei);

  return (
    <div style={{ background: '#EEF5F8', minHeight: '100%', padding: '16px 24px 30px 24px', boxSizing: 'border-box' }}>
      <style>{`
        .migration-wrapper {
          max-width: 1040px;
          width: 100%;
          margin: 0 auto;
        }
        .migration-tabs-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          padding: 12px 24px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }
        .migration-info-grid {
          display: grid;
          grid-template-columns: minmax(240px, 320px) 1fr;
          gap: 12px;
          margin-bottom: 16px;
        }
        .migration-fields-mode1 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 8px;
        }
        .migration-fields-mode2 {
          display: grid;
          grid-template-columns: 1.2fr 1fr 1fr;
          gap: 16px;
          margin-bottom: 14px;
        }
        @media (max-width: 840px) {
          .migration-tabs-grid {
            grid-template-columns: 1fr !important;
          }
          .migration-info-grid {
            grid-template-columns: 1fr !important;
          }
          .migration-fields-mode1 {
            grid-template-columns: 1fr !important;
          }
          .migration-fields-mode2 {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 640px) {
          .migration-card-body {
            padding: 14px 16px !important;
          }
          .migration-footer {
            flex-direction: column-reverse !important;
            gap: 8px !important;
            padding: 12px 16px !important;
          }
          .migration-footer button {
            width: 100% !important;
            justify-content: center !important;
          }
        }
      `}</style>

      <div className="migration-wrapper">
        {/* Top Header Bar & Breadcrumb Path */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '14px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <h1 style={{
              fontSize: '20px',
              fontWeight: 800,
              color: '#0f172a',
              margin: 0,
              letterSpacing: '-0.02em'
            }}>
              Vehicle & Telemetry Migration
            </h1>
            <div style={{ width: '1px', height: '18px', background: '#cbd5e1' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
              <span
                onClick={() => navigate('/admin/vehicles')}
                style={{ cursor: 'pointer', transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#f97316'}
                onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
              >
                Vehicles
              </span>
              <ChevronRight size={13} color="#94a3b8" />
              <span>Migration</span>
              <ChevronRight size={13} color="#94a3b8" />
              <span style={{ color: '#ea580c', fontWeight: 700 }}>{displayVehicleId}</span>
            </div>
          </div>

          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Replace hardware or reassign tracker to a fresh vehicle
          </div>
        </div>

        {/* Status Alerts */}
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
            fontWeight: 600,
            marginBottom: '14px'
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
            fontWeight: 600,
            marginBottom: '14px'
          }}>
            <CheckCircle size={16} />
            <span>{success}</span>
          </div>
        )}

        {/* Form Card Container */}
        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.05)',
          overflow: 'hidden'
        }}>
          {/* Header Bar */}
          <div style={{
            padding: '12px 24px',
            borderBottom: '1px solid #f1f5f9',
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCw size={15} color="#475569" />
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Device Migration Wizard
              </h2>
            </div>
            <span style={{
              fontSize: '11.5px',
              fontWeight: 700,
              color: '#334155',
              background: '#e2e8f0',
              padding: '3px 10px',
              borderRadius: '6px'
            }}>
              Current Vehicle: {displayVehicleId}
            </span>
          </div>

          {/* TWO-MODE SELECTION TABS */}
          <div className="migration-tabs-grid">
            {/* Tab 1: Replace Hardware */}
            <button
              type="button"
              onClick={() => {
                setMigrationMode('replace_hardware');
                setError('');
              }}
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                border: migrationMode === 'replace_hardware' ? '2px solid #f97316' : '1px solid #cbd5e1',
                background: migrationMode === 'replace_hardware' ? '#fff7ed' : '#ffffff',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '13px', color: migrationMode === 'replace_hardware' ? '#c2410c' : '#1e293b' }}>
                <Cpu size={16} color={migrationMode === 'replace_hardware' ? '#ea580c' : '#64748b'} />
                <span>Replace GPS Tracker</span>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
                Same vehicle, new hardware. <b>Preserves all previous trips & distance.</b>
              </div>
            </button>

            {/* Tab 2: Reassign to Different Vehicle */}
            <button
              type="button"
              onClick={() => {
                setMigrationMode('reassign_device');
                setError('');
              }}
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                border: migrationMode === 'reassign_device' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                background: migrationMode === 'reassign_device' ? '#eff6ff' : '#ffffff',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '13px', color: migrationMode === 'reassign_device' ? '#1d4ed8' : '#1e293b' }}>
                <Shuffle size={16} color={migrationMode === 'reassign_device' ? '#2563eb' : '#64748b'} />
                <span>Move to Different Vehicle</span>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
                Same device, new vehicle/customer. <b>Clean slate (starts at 0 km, no old trips).</b>
              </div>
            </button>
          </div>

          <form onSubmit={handleMigrate}>
            <div className="migration-card-body" style={{ padding: '18px 24px 22px 24px' }}>
              {/* Info Row: Left: Current IMEI, Right: Mode Guarantee Details */}
              <div className="migration-info-grid">
                {/* Current Hardware IMEI */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b' }}>
                    <Cpu size={15} color="#f97316" />
                    <span style={{ fontWeight: 600 }}>Physical IMEI:</span>
                  </div>
                  <span style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'monospace', letterSpacing: '0.04em' }}>
                    {vehicle?.imei || 'Not Assigned'}
                  </span>
                </div>

                {/* Mode Explanation Banner */}
                {migrationMode === 'replace_hardware' ? (
                  <div style={{
                    padding: '9px 14px',
                    background: '#fff7ed',
                    borderRadius: '8px',
                    border: '1px solid #fed7aa',
                    color: '#9a3412',
                    fontSize: '12px',
                    lineHeight: 1.45,
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <span><b>Keep History:</b> Past trips, distance, and alerts of <b>{displayVehicleId}</b> remain intact. New IMEI will continue seamlessly.</span>
                  </div>
                ) : (
                  <div style={{
                    padding: '9px 14px',
                    background: '#eff6ff',
                    borderRadius: '8px',
                    border: '1px solid #bfdbfe',
                    color: '#1e40af',
                    fontSize: '12px',
                    lineHeight: 1.45,
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <span><b>Clean Slate Guarantee:</b> New vehicle starts at <b>0 km with no old trips</b>. Old vehicle <b>{displayVehicleId}</b> history is archived separately.</span>
                  </div>
                )}
              </div>

              {/* ───────────────────────────────────────────────────────────── */}
              {/* MODE 1: REPLACE GPS DEVICE (SAME VEHICLE)                     */}
              {/* ───────────────────────────────────────────────────────────── */}
              {migrationMode === 'replace_hardware' && (
                <div className="migration-fields-mode1">
                  {/* Vehicle Id / Plate */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: '0.02em',
                      marginBottom: '5px'
                    }}>
                      Vehicle ID / Plate Name<span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newVehicleId}
                      onChange={e => setNewVehicleId(e.target.value)}
                      placeholder="e.g. KA05LT0001"
                      style={{
                        width: '100%',
                        height: '38px',
                        padding: '0 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#0f172a',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Target New Device IMEI */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                      <label style={{
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: '#475569',
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em'
                      }}>
                        New Hardware Device IMEI<span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <span style={{
                        fontSize: '10.5px',
                        fontWeight: 700,
                        color: isImeiValid ? '#10b981' : (newImei ? '#f97316' : '#94a3b8')
                      }}>
                        {newImei.length}/15 digits
                      </span>
                    </div>
                    <input
                      type="text"
                      required
                      value={newImei}
                      onChange={e => setNewImei(e.target.value.replace(/\D/g, '').slice(0, 15))}
                      placeholder="Enter 15-digit new IMEI"
                      style={{
                        width: '100%',
                        height: '38px',
                        padding: '0 12px',
                        borderRadius: '6px',
                        border: isImeiValid ? '1.5px solid #10b981' : '1px solid #cbd5e1',
                        background: '#ffffff',
                        fontSize: '13px',
                        fontWeight: 600,
                        fontFamily: 'monospace',
                        letterSpacing: '0.04em',
                        color: '#0f172a',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* ───────────────────────────────────────────────────────────── */}
              {/* MODE 2: MOVE TO DIFFERENT VEHICLE / CUSTOMER (CLEAN SLATE)    */}
              {/* ───────────────────────────────────────────────────────────── */}
              {migrationMode === 'reassign_device' && (
                <>
                  <div className="migration-fields-mode2">
                    {/* New Vehicle Plate Number */}
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: '#475569',
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em',
                        marginBottom: '5px'
                      }}>
                        New Vehicle Plate / Reg Number<span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={reassignPlate}
                        onChange={e => setReassignPlate(e.target.value.toUpperCase())}
                        placeholder="e.g. AP39TV1234"
                        style={{
                          width: '100%',
                          height: '38px',
                          padding: '0 12px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          fontSize: '13px',
                          fontWeight: 700,
                          color: '#0f172a',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    {/* Vehicle Type / Model */}
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: '#475569',
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em',
                        marginBottom: '5px'
                      }}>
                        Vehicle Model / Type
                      </label>
                      <select
                        value={reassignModel}
                        onChange={e => setReassignModel(e.target.value)}
                        style={{
                          width: '100%',
                          height: '38px',
                          padding: '0 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          fontSize: '13px',
                          color: '#0f172a',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      >
                        {VEHICLE_MODELS.map(m => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Organization / Customer */}
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: '#475569',
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em',
                        marginBottom: '5px'
                      }}>
                        Assign to Organization / Customer
                      </label>
                      <select
                        value={reassignOrgId}
                        onChange={e => setReassignOrgId(e.target.value)}
                        style={{
                          width: '100%',
                          height: '38px',
                          padding: '0 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          fontSize: '13px',
                          color: '#0f172a',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      >
                        {orgs.map(o => (
                          <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Archive checkbox */}
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <input
                      type="checkbox"
                      id="deactivateOld"
                      checked={deactivateOld}
                      onChange={e => setDeactivateOld(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: '#2563eb', cursor: 'pointer' }}
                    />
                    <label htmlFor="deactivateOld" style={{ fontSize: '12.5px', color: '#334155', cursor: 'pointer', fontWeight: 500 }}>
                      Mark previous vehicle (<b>{displayVehicleId}</b>) as inactive while preserving all historical trips & reports
                    </label>
                  </div>
                </>
              )}
            </div>

            {/* Footer Action Buttons */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              padding: '14px 24px',
              background: '#fafbfc',
              borderTop: '1px solid #f1f5f9'
            }}>
              <button
                type="button"
                onClick={() => navigate('/admin/vehicles')}
                style={{
                  height: '38px',
                  padding: '0 20px',
                  borderRadius: '6px',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={migrating || (migrationMode === 'replace_hardware' && !isImeiValid) || (migrationMode === 'reassign_device' && !reassignPlate.trim())}
                style={{
                  height: '38px',
                  padding: '0 24px',
                  borderRadius: '6px',
                  background: migrationMode === 'replace_hardware' ? '#f97316' : '#2563eb',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: migrating ? 'not-allowed' : 'pointer',
                  boxShadow: migrationMode === 'replace_hardware'
                    ? '0 2px 6px rgba(249, 115, 22, 0.28)'
                    : '0 2px 6px rgba(37, 99, 235, 0.28)',
                  transition: 'all 0.15s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: (migrating || (migrationMode === 'replace_hardware' && !isImeiValid) || (migrationMode === 'reassign_device' && !reassignPlate.trim())) ? 0.65 : 1
                }}
              >
                {migrating && <Loader2 size={15} className="animate-spin" />}
                <span>
                  {migrating
                    ? 'Processing...'
                    : migrationMode === 'replace_hardware'
                      ? 'Replace Tracker (Keep History)'
                      : 'Move Tracker (Fresh Start)'}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default MigrationPage;
