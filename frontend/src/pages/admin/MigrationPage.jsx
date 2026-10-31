import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertTriangle, CheckCircle, Shuffle, Cpu } from 'lucide-react';
import * as vehicleApi from '../../api/vehicleApi';

const MigrationPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [vehicle, setVehicle] = useState(null);
  const [newVehicleId, setNewVehicleId] = useState('');
  const [newImei, setNewImei] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    vehicleApi.getVehicleById(id)
      .then(res => {
        const v = res.data || res;
        setVehicle(v);
        setNewVehicleId(v.plate || v.name || v.imei || '');
        setNewImei(''); // Target IMEI starts blank to prompt the admin to enter the new hardware IMEI
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

    if (!newImei || !/^\d{15}$/.test(newImei)) {
      setError('Please enter a valid 15-digit target Device ID / IMEI.');
      return;
    }

    if (vehicle?.imei && newImei === vehicle.imei) {
      setError('Target IMEI is identical to current IMEI. Please enter the new device IMEI to migrate to.');
      return;
    }

    setMigrating(true);
    setError('');
    setSuccess('');
    try {
      if (newVehicleId && newVehicleId !== (vehicle?.plate || vehicle?.name || vehicle?.imei)) {
        await vehicleApi.updateVehicle(id, {
          ...vehicle,
          plate: newVehicleId,
          name: newVehicleId
        });
      }

      await vehicleApi.migrateVehicle(id, newImei);

      setSuccess('Vehicle migrated successfully!');
      setTimeout(() => {
        navigate('/admin/vehicles');
      }, 1200);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to migrate vehicle');
    } finally {
      setMigrating(false);
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
    <div className="pastel-page-bg migration-page" style={{ padding: '24px 28px', minHeight: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <style>{`
        .migration-wrapper {
          max-width: 620px;
          width: 100%;
          margin: 0 auto;
        }
        .migration-card-body {
          padding: 24px 28px 28px 28px;
        }
        .migration-footer {
          display: flex;
          align-items: center;
          justifyContent: flex-end;
          gap: 12px;
          padding: 14px 28px;
          background: #fafbfc;
          border-top: 1px solid #f1f5f9;
        }
        @media (max-width: 640px) {
          .migration-page {
            padding: 14px 12px !important;
          }
          .migration-card-body {
            padding: 18px 16px !important;
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
        {/* Top Header without redundant breadcrumbs */}
        <div style={{ marginBottom: '20px' }}>
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
            fontWeight: 600,
            marginBottom: '16px'
          }}>
            <CheckCircle size={16} />
            <span>{success}</span>
          </div>
        )}

        {/* Centered Symmetrical Card */}
        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.05)',
          overflow: 'hidden'
        }}>
          {/* Header Bar */}
          <div style={{
            padding: '14px 24px',
            borderBottom: '1px solid #f1f5f9',
            background: '#fff7ed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shuffle size={15} color="#ea580c" />
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Migrate Telemetry Device
              </h2>
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#c2410c',
              background: '#ffedd5',
              padding: '2px 8px',
              borderRadius: '6px'
            }}>
              {displayVehicleId}
            </span>
          </div>

          <form onSubmit={handleMigrate}>
            <div className="migration-card-body">
              {/* Context Callout: Current Hardware */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                marginBottom: '20px',
                fontSize: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b' }}>
                  <Cpu size={14} color="#f97316" />
                  <span style={{ fontWeight: 600 }}>Current Device IMEI:</span>
                </div>
                <span style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'monospace', letterSpacing: '0.04em' }}>
                  {vehicle?.imei || 'Not Assigned'}
                </span>
              </div>

              {/* Field 1: Vehicle Id */}
              <div style={{ marginBottom: '18px' }}>
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
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = '#f97316';
                    e.target.style.boxShadow = '0 0 0 3px rgba(249, 115, 22, 0.12)';
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = '#cbd5e1';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* Field 2: Target Device ID / IMEI */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                  <label style={{
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: '#475569',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em'
                  }}>
                    New Device ID / IMEI No<span style={{ color: '#ef4444' }}>*</span>
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
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                  }}
                  onFocus={e => {
                    if (!isImeiValid) {
                      e.target.style.borderColor = '#f97316';
                      e.target.style.boxShadow = '0 0 0 3px rgba(249, 115, 22, 0.12)';
                    }
                  }}
                  onBlur={e => {
                    if (!isImeiValid) {
                      e.target.style.borderColor = '#cbd5e1';
                      e.target.style.boxShadow = 'none';
                    }
                  }}
                />
                <span style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                  Vehicle telemetry and history will be mapped to this new device IMEI.
                </span>
              </div>
            </div>

            {/* Footer Action Buttons */}
            <div className="migration-footer">
              <button
                type="button"
                onClick={() => navigate('/admin/vehicles')}
                style={{
                  height: '36px',
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
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.borderColor = '#94a3b8';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={migrating || !isImeiValid}
                style={{
                  height: '36px',
                  padding: '0 24px',
                  borderRadius: '6px',
                  background: '#f97316',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: (migrating || !isImeiValid) ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 6px rgba(249, 115, 22, 0.28)',
                  transition: 'all 0.15s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: (migrating || !isImeiValid) ? 0.65 : 1
                }}
                onMouseEnter={e => {
                  if (!migrating && isImeiValid) {
                    e.currentTarget.style.background = '#ea580c';
                  }
                }}
                onMouseLeave={e => {
                  if (!migrating && isImeiValid) {
                    e.currentTarget.style.background = '#f97316';
                  }
                }}
              >
                {migrating && <Loader2 size={14} className="animate-spin" />}
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
