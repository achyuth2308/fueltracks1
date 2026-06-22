import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Home, ChevronRight, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import * as vehicleApi from '../../api/vehicleApi';

const inputBaseStyle = {
  width: '100%', maxWidth: '400px', padding: '12px 16px', borderRadius: '6px', 
  border: '1px solid #CBD5E1', fontSize: '15px', outline: 'none', 
  color: '#111827', background: '#FFFFFF', boxSizing: 'border-box',
  transition: 'all 0.2s ease', fontFamily: 'Inter, sans-serif'
};

const labelStyle = {
  width: '200px', textAlign: 'right', fontSize: '14px', fontWeight: 600, color: '#475569', marginRight: '24px'
};

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
        setVehicle(res.data);
        setNewImei(res.data.imei || '');
        setNewVehicleId(res.data.metadata?.vehicleId || res.data.name || res.data.imei || '');
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to load vehicle details.');
        setLoading(false);
      });
  }, [id]);

  const handleMigrate = async () => {
    if (!newImei || !/^\d{15}$/.test(newImei)) {
      setError("Please enter a valid 15-digit Device ID / IMEI.");
      return;
    }
    setMigrating(true);
    setError(''); setSuccess('');
    try {
      // If the Vehicle ID was changed, update it via the standard vehicle update API
      if (newVehicleId !== (vehicle.metadata?.vehicleId || vehicle.name || vehicle.imei)) {
        await vehicleApi.updateVehicle(id, {
          ...vehicle,
          metadata: { ...vehicle.metadata, vehicleId: newVehicleId }
        });
      }

      // If the IMEI was changed, or just to finalize migration
      await vehicleApi.migrateVehicle(id, newImei);

      setSuccess('Vehicle migrated successfully!');
      setTimeout(() => {
        navigate('/admin/vehicles');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to migrate vehicle');
      setMigrating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#EEF5F8' }}>
        <Loader2 size={48} className="animate-spin" color="#f97316" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2 style={{ color: '#DC2626' }}>Vehicle Not Found</h2>
      </div>
    );
  }

  // Get the Vehicle ID string to display (fallback to name or IMEI if empty)
  const displayVehicleId = vehicle.metadata?.vehicleId || vehicle.name || vehicle.imei || '-';

  return (
    <div style={{ background: '#EEF5F8', minHeight: '100%', padding: '32px', boxSizing: 'border-box' }}>
      
      {/* Header & Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#1E293B', margin: 0 }}>Vehicle Migration</h1>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#94A3B8', fontSize: '13px' }}>
          <Home size={16} style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/vehicles')} />
          <ChevronRight size={14} />
          <span style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/vehicles')}>Vehicle list</span>
          <ChevronRight size={14} />
          <span style={{ color: '#475569' }}>Vehicle Migration</span>
          <ChevronRight size={14} />
          <span style={{ color: '#475569' }}>{displayVehicleId}</span>
        </div>
      </div>

      {/* Status Alerts */}
      {error && (
        <div style={{ padding: '16px 20px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', color: '#DC2626', marginBottom: '24px' }}>
          <AlertTriangle size={20} />
          <div style={{ fontSize: '14px', fontWeight: 500 }}>{error}</div>
        </div>
      )}
      {success && (
        <div style={{ padding: '16px 20px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', color: '#059669', marginBottom: '24px' }}>
          <CheckCircle size={20} />
          <div style={{ fontSize: '14px', fontWeight: 500 }}>{success}</div>
        </div>
      )}

      {/* Migration Card */}
      <div style={{ background: '#FFFFFF', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 500, color: '#64748B', margin: 0 }}>Vehicle Migration</h2>
        </div>
        
        <div style={{ padding: '60px 40px', display: 'flex', flexDirection: 'column', gap: '32px', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', maxWidth: '600px' }}>
            <label style={labelStyle}>Vehicle Id :</label>
            <input 
              type="text" 
              value={newVehicleId}
              onChange={e => setNewVehicleId(e.target.value)}
              placeholder="Enter new Vehicle ID"
              style={{ ...inputBaseStyle, borderColor: '#3B82F6', boxShadow: '0 0 0 1px #3B82F6' }} 
              autoFocus
            />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', maxWidth: '600px' }}>
            <label style={labelStyle}>Device Id / IMEI No :</label>
            <input 
              type="text" 
              value={newImei} 
              onChange={e => setNewImei(e.target.value.replace(/\D/g, '').slice(0, 15))}
              placeholder="Enter 15-digit IMEI"
              style={{ ...inputBaseStyle, borderColor: '#3B82F6', boxShadow: '0 0 0 1px #3B82F6' }} 
            />
          </div>

        </div>

        {/* Action Buttons */}
        <div style={{ padding: '24px', display: 'flex', justifyContent: 'center', gap: '16px', borderTop: '1px solid #F1F5F9', background: '#FAFAFA' }}>
          <button 
            onClick={() => navigate(-1)}
            style={{ padding: '10px 32px', borderRadius: '4px', background: '#EF4444', border: 'none', color: '#FFFFFF', fontSize: '14px', fontWeight: 500, cursor: 'pointer', transition: 'background 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#DC2626'}
            onMouseLeave={e => e.currentTarget.style.background = '#EF4444'}
          >
            Cancel
          </button>
          <button 
            onClick={handleMigrate}
            disabled={migrating || newImei.length !== 15}
            style={{ padding: '10px 24px', borderRadius: '4px', background: '#f97316', border: 'none', color: '#FFFFFF', fontSize: '14px', fontWeight: 500, cursor: (migrating || newImei.length !== 15) ? 'not-allowed' : 'pointer', opacity: (migrating || newImei.length !== 15) ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.2s' }}
            onMouseEnter={e => { if(!migrating && newImei.length === 15) e.currentTarget.style.background = '#ea580c'; }}
            onMouseLeave={e => { if(!migrating && newImei.length === 15) e.currentTarget.style.background = '#f97316'; }}
          >
            {migrating && <Loader2 size={16} className="animate-spin" />}
            Migrate Vehicle
          </button>
        </div>
      </div>

    </div>
  );
};

export default MigrationPage;
