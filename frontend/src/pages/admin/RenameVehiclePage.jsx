import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Home, ChevronRight, Loader2, AlertTriangle, CheckCircle, Tag } from 'lucide-react';
import * as vehicleApi from '../../api/vehicleApi';

const RenameVehiclePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vehicle, setVehicle] = useState(null);
  const [vehicleName, setVehicleName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!id) {
      setError('No vehicle ID specified.');
      setLoading(false);
      return;
    }

    vehicleApi.getVehicleById(id)
      .then(res => {
        const v = res.data || res;
        setVehicle(v);
        setVehicleName(v.name || v.plate || '');
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load vehicle for rename:', err);
        setError('Failed to load vehicle information.');
        setLoading(false);
      });
  }, [id]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!vehicleName.trim()) {
      setError('Vehicle Id / Name cannot be empty.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await vehicleApi.renameVehicle(id, vehicleName.trim());
      setSuccess('Vehicle renamed successfully!');
      setTimeout(() => {
        navigate('/admin/vehicles');
      }, 1200);
    } catch (err) {
      console.error('Rename vehicle error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to rename vehicle.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '12px' }}>
        <Loader2 size={36} className="animate-spin" color="#f97316" />
        <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 600 }}>Loading vehicle details...</span>
      </div>
    );
  }

  const currentDisplayName = vehicle?.name || vehicle?.plate || 'Vehicle';

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'inherit' }}>
      {/* Top Header Bar & Breadcrumb Navigation (Matching Screenshot) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        marginBottom: '28px',
        flexWrap: 'wrap'
      }}>
        {/* Page Title */}
        <h1 style={{
          fontSize: '22px',
          fontWeight: 800,
          color: '#1e293b',
          margin: 0,
          letterSpacing: '-0.02em'
        }}>
          Vehicle Rename
        </h1>

        {/* Vertical Divider */}
        <div style={{ width: '1px', height: '24px', background: '#cbd5e1' }} />

        {/* Breadcrumb Path */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: '#64748b' }}>
          <button
            type="button"
            onClick={() => navigate('/admin/vehicles')}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              transition: 'color 0.15s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#f97316'}
            onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
            title="Vehicle List"
          >
            <Home size={16} />
          </button>

          <ChevronRight size={14} color="#94a3b8" />

          <button
            type="button"
            onClick={() => navigate('/admin/vehicles')}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: '#64748b',
              fontSize: '13.5px',
              fontWeight: 500,
              transition: 'color 0.15s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#f97316'}
            onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
          >
            Vehicle list
          </button>

          <ChevronRight size={14} color="#94a3b8" />

          <span style={{ color: '#64748b', fontWeight: 500 }}>
            Vehicle Rename
          </span>

          <ChevronRight size={14} color="#94a3b8" />

          <span style={{ color: '#475569', fontWeight: 600 }}>
            {currentDisplayName}
          </span>
        </div>
      </div>

      {/* Error & Success Feedback Alerts */}
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
          marginBottom: '20px',
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
          marginBottom: '20px',
          boxShadow: '0 2px 6px rgba(22, 163, 74, 0.06)'
        }}>
          <CheckCircle size={18} />
          <span>{success}</span>
        </div>
      )}

      {/* Main Form Card (Matching Screenshot) */}
      <div style={{
        background: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
        padding: '50px 40px',
        boxSizing: 'border-box'
      }}>
        <form onSubmit={handleSubmit}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '36px',
            gap: '24px',
            flexWrap: 'wrap'
          }}>
            {/* Label on the Left (approx 20% width) */}
            <div style={{ minWidth: '160px', width: '22%' }}>
              <label style={{
                fontSize: '14px',
                fontWeight: 700,
                color: '#334155',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Tag size={15} color="#f97316" />
                <span>Vehicle Id</span>
              </label>
            </div>

            {/* Input on the Right */}
            <div style={{ flex: '1', maxWidth: '480px', minWidth: '280px' }}>
              <input
                type="text"
                value={vehicleName}
                onChange={(e) => setVehicleName(e.target.value)}
                placeholder="Enter vehicle name or id"
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 16px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#f97316';
                  e.target.style.boxShadow = '0 0 0 3px rgba(249, 115, 22, 0.18)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#cbd5e1';
                  e.target.style.boxShadow = 'none';
                }}
                autoFocus
              />
            </div>
          </div>

          {/* Action Buttons: Aligned directly under the input field */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            paddingLeft: 'max(0px, calc(22% + 24px))',
            flexWrap: 'wrap'
          }}>
            {/* Submit Button: FuelTracks Brand Orange */}
            <button
              type="submit"
              disabled={saving}
              style={{
                background: '#f97316',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '9px 28px',
                fontSize: '13.5px',
                fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(249, 115, 22, 0.28)',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                opacity: saving ? 0.75 : 1
              }}
              onMouseEnter={e => {
                if (!saving) {
                  e.currentTarget.style.background = '#ea580c';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(249, 115, 22, 0.38)';
                }
              }}
              onMouseLeave={e => {
                if (!saving) {
                  e.currentTarget.style.background = '#f97316';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(249, 115, 22, 0.28)';
                }
              }}
            >
              {saving ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Submit</span>
              )}
            </button>

            {/* Cancel Button: Matches FuelTracks Brand Color System */}
            <button
              type="button"
              onClick={() => navigate('/admin/vehicles')}
              disabled={saving}
              style={{
                background: '#ffffff',
                color: '#475569',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '9px 28px',
                fontSize: '13.5px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#fff7ed';
                e.currentTarget.style.color = '#ea580c';
                e.currentTarget.style.borderColor = '#fed7aa';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#ffffff';
                e.currentTarget.style.color = '#475569';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RenameVehiclePage;
