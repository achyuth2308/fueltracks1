import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Home, ChevronRight, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
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
        setNewImei(v.imei || '');
        setNewVehicleId(v.plate || v.name || v.imei || '');
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
      setError('Please enter a valid 15-digit Device ID / IMEI.');
      return;
    }
    setMigrating(true);
    setError('');
    setSuccess('');
    try {
      // If vehicle plate/name was modified
      if (newVehicleId && newVehicleId !== (vehicle?.plate || vehicle?.name || vehicle?.imei)) {
        await vehicleApi.updateVehicle(id, {
          ...vehicle,
          plate: newVehicleId,
          name: newVehicleId
        });
      }

      // Finalize device IMEI migration
      await vehicleApi.migrateVehicle(id, newImei);

      setSuccess('Vehicle migrated successfully!');
      setTimeout(() => {
        navigate('/admin/vehicles');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to migrate vehicle');
    } finally {
      setMigrating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '12px' }}>
        <Loader2 size={36} className="animate-spin" color="#f97316" />
        <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 600 }}>Loading Vehicle Migration...</span>
      </div>
    );
  }

  const displayVehicleId = vehicle?.plate || vehicle?.name || vehicle?.imei || 'ACTIVA_TS07';

  return (
    <div className="pastel-page-bg" style={{ padding: '32px', minHeight: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '1150px', width: '100%', margin: '0 auto' }}>

        {/* Header & Breadcrumbs Bar (FuelTracks Themed) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '18px',
          marginBottom: '24px',
          flexWrap: 'wrap'
        }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 800,
            color: '#0f172a',
            letterSpacing: '-0.02em',
            margin: 0
          }}>
            Vehicle Migration
          </h1>

          <div style={{ width: '1px', height: '22px', background: '#cbd5e1' }} />

          {/* Breadcrumb Line with FuelTracks brand styling */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b' }}>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}
              title="Dashboard"
            >
              <Home size={15} />
            </button>
            <ChevronRight size={13} color="#94a3b8" />
            <button
              type="button"
              onClick={() => navigate('/admin/vehicles')}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#64748b', fontWeight: 600 }}
            >
              Vehicle list
            </button>
            <ChevronRight size={13} color="#94a3b8" />
            <span style={{ color: '#64748b', fontWeight: 500 }}>Vehicle Migration</span>
            <ChevronRight size={13} color="#94a3b8" />
            <span style={{ color: '#ea580c', fontWeight: 700 }}>{displayVehicleId}</span>
          </div>
        </div>

        {/* Status Alerts */}
        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '10px',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#dc2626',
            fontSize: '13.5px',
            fontWeight: 600,
            marginBottom: '18px',
            boxShadow: '0 2px 6px rgba(220, 38, 38, 0.06)'
          }}>
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '10px',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#16a34a',
            fontSize: '13.5px',
            fontWeight: 600,
            marginBottom: '18px',
            boxShadow: '0 2px 6px rgba(22, 163, 74, 0.06)'
          }}>
            <CheckCircle size={18} />
            <span>{success}</span>
          </div>
        )}

        {/* Main Card (FuelTracks Theme & Clean Modern Styling) */}
        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
          overflow: 'hidden'
        }}>
          {/* Card Top Subtitle Row */}
          <div style={{
            padding: '18px 26px',
            borderBottom: '1px solid #f1f5f9',
            background: '#fafbfc'
          }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#334155', margin: 0, letterSpacing: '-0.01em' }}>
              Vehicle Migration
            </h2>
          </div>

          {/* Form matching structure with FuelTracks UI colors */}
          <form onSubmit={handleMigrate} style={{ padding: '48px 32px 56px 32px', maxWidth: '640px', margin: '0 auto' }}>
            {/* Row 1: Vehicle Id */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '190px 1fr',
              alignItems: 'center',
              gap: '24px',
              marginBottom: '24px'
            }}>
              <label style={{ fontSize: '14px', fontWeight: 700, color: '#334155', textAlign: 'right' }}>
                Vehicle Id :
              </label>
              <input
                type="text"
                value={newVehicleId}
                onChange={e => setNewVehicleId(e.target.value)}
                placeholder="ACTIVA_TS07"
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 16px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                }}
                onFocus={e => {
                  e.target.style.borderColor = '#f97316';
                  e.target.style.boxShadow = '0 0 0 3px rgba(249, 115, 22, 0.15)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = '#cbd5e1';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Row 2: Device Id / IMEI No */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '190px 1fr',
              alignItems: 'center',
              gap: '24px',
              marginBottom: '40px'
            }}>
              <label style={{ fontSize: '14px', fontWeight: 700, color: '#334155', textAlign: 'right' }}>
                Device Id / IMEI No :
              </label>
              <input
                type="text"
                value={newImei}
                onChange={e => setNewImei(e.target.value.replace(/\D/g, '').slice(0, 15))}
                placeholder="Enter 15-digit IMEI"
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 16px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                }}
                onFocus={e => {
                  e.target.style.borderColor = '#f97316';
                  e.target.style.boxShadow = '0 0 0 3px rgba(249, 115, 22, 0.15)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = '#cbd5e1';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Centered Action Buttons (Cancel on left, Migrate Vehicle on right) */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '14px' }}>
              <button
                type="button"
                onClick={() => navigate('/admin/vehicles')}
                style={{
                  padding: '10px 32px',
                  borderRadius: '8px',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '14px',
                  fontWeight: 700,
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.borderColor = '#94a3b8';
                  e.currentTarget.style.color = '#0f172a';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.color = '#475569';
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={migrating || !newImei || newImei.length !== 15}
                style={{
                  padding: '10px 32px',
                  borderRadius: '8px',
                  background: '#f97316',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 800,
                  border: 'none',
                  cursor: (migrating || !newImei || newImei.length !== 15) ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(249, 115, 22, 0.3)',
                  transition: 'all 0.15s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: (migrating || !newImei || newImei.length !== 15) ? 0.65 : 1
                }}
                onMouseEnter={e => {
                  if (!migrating && newImei && newImei.length === 15) {
                    e.currentTarget.style.background = '#ea580c';
                    e.currentTarget.style.boxShadow = '0 6px 18px rgba(249, 115, 22, 0.4)';
                  }
                }}
                onMouseLeave={e => {
                  if (!migrating && newImei && newImei.length === 15) {
                    e.currentTarget.style.background = '#f97316';
                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(249, 115, 22, 0.3)';
                  }
                }}
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
