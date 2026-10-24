import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Plus, RefreshCw, Loader2, AlertCircle, Compass,
  CheckCircle2, Filter, Layers, Navigation, BarChart2, FolderPlus
} from 'lucide-react';
import axiosInstance from '../../api/axios';
import VehicleGeofenceCard from './VehicleGeofenceCard';
import VehicleGeofenceEditorModal from './VehicleGeofenceEditorModal';
import AssignSavedGeofenceModal from './AssignSavedGeofenceModal';

const VehicleGeofenceManager = ({ vehicle, onGeofenceCountChange }) => {
  const navigate = useNavigate();
  const [geofences, setGeofences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingGeofence, setEditingGeofence] = useState(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [replacingGeofence, setReplacingGeofence] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [filterType, setFilterType] = useState('all'); // 'all', 'circle', 'polygon', 'active'

  const vehicleId = vehicle?.id;

  const fetchGeofences = useCallback(async () => {
    if (!vehicleId) return;
    setLoading(true);
    setError('');
    try {
      const res = await axiosInstance.get(`/api/vehicles/${vehicleId}/geofences`);
      if (res.data?.success) {
        const data = res.data.data || [];
        setGeofences(data);
        if (onGeofenceCountChange) onGeofenceCountChange(data.length);
      } else {
        setError(res.data?.error || 'Failed to load vehicle geofences.');
      }
    } catch (err) {
      console.error('Error fetching vehicle geofences:', err);
      setError(err.response?.data?.error || 'Failed to load vehicle geofences.');
    } finally {
      setLoading(false);
    }
  }, [vehicleId, onGeofenceCountChange]);

  useEffect(() => {
    fetchGeofences();
  }, [fetchGeofences]);

  const handleOpenCreateModal = () => {
    setEditingGeofence(null);
    setEditorOpen(true);
  };

  const handleOpenEditModal = (geo) => {
    setEditingGeofence(geo);
    setEditorOpen(true);
  };

  const handleSaveGeofence = async (formData) => {
    if (!vehicleId) return;

    if (formData.isPair) {
      // Create Location A (Origin)
      const resA = await axiosInstance.post(
        `/api/vehicles/${vehicleId}/geofences`,
        formData.fromGeofence
      );
      if (!resA.data?.success) {
        throw new Error(resA.data?.error || 'Failed to create Location A (Origin) geofence.');
      }

      // Create Location B (Destination)
      const resB = await axiosInstance.post(
        `/api/vehicles/${vehicleId}/geofences`,
        formData.toGeofence
      );
      if (!resB.data?.success) {
        throw new Error(resB.data?.error || 'Failed to create Location B (Destination) geofence.');
      }
    } else if (formData.id) {
      // Update
      const res = await axiosInstance.put(
        `/api/vehicles/${vehicleId}/geofences/${formData.id}`,
        formData
      );
      if (!res.data?.success) {
        throw new Error(res.data?.error || 'Failed to update geofence.');
      }
    } else {
      // Create directly for this single vehicle
      const res = await axiosInstance.post(
        `/api/vehicles/${vehicleId}/geofences`,
        formData
      );
      if (!res.data?.success) {
        throw new Error(res.data?.error || 'Failed to create geofence.');
      }
    }

    await fetchGeofences();
  };

  const handleDeleteGeofence = async (geofenceId) => {
    if (!window.confirm('Unlink this geofence from this vehicle? (The master warehouse will remain safely saved in your software for other vehicles).')) return;
    try {
      const res = await axiosInstance.delete(`/api/vehicles/${vehicleId}/geofences/${geofenceId}`);
      if (res.data?.success) {
        setGeofences((prev) => prev.filter((g) => g.id !== geofenceId));
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to unlink geofence.');
    }
  };

  const handleToggleActive = async (geofenceId, nextState) => {
    setTogglingId(geofenceId);
    // Optimistic UI update
    setGeofences((prev) =>
      prev.map((g) => (g.id === geofenceId ? { ...g, is_active: nextState } : g))
    );

    try {
      await axiosInstance.patch(`/api/vehicles/${vehicleId}/geofences/${geofenceId}/toggle`, {
        is_active: nextState,
      });
    } catch (err) {
      // Revert on error
      setGeofences((prev) =>
        prev.map((g) => (g.id === geofenceId ? { ...g, is_active: !nextState } : g))
      );
      alert('Failed to update geofence active status.');
    } finally {
      setTogglingId(null);
    }
  };

  const filteredGeofences = geofences.filter((g) => {
    if (filterType === 'circle') return g.type === 'circle';
    if (filterType === 'polygon') return g.type === 'polygon';
    if (filterType === 'active') return g.is_active;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          background: '#FFFFFF',
          padding: '16px 20px',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: '#0284C715',
              border: '1px solid #0284C730',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Shield size={22} color="#0284C7" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
                Vehicle Geofences
              </h3>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  background: '#F1F5F9',
                  color: '#475569',
                  padding: '2px 8px',
                  borderRadius: '99px',
                }}
              >
                {geofences.length} defined
              </span>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>
              Virtual boundaries and alert zones configured specifically for {vehicle?.name || vehicle?.plate}.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Filter Pills */}
          <div style={{ display: 'flex', background: '#F1F5F9', padding: '3px', borderRadius: '8px', gap: '2px' }}>
            {['all', 'circle', 'polygon', 'active'].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilterType(f)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: filterType === f ? 700 : 500,
                  background: filterType === f ? '#FFFFFF' : 'transparent',
                  color: filterType === f ? '#0F172A' : '#64748B',
                  boxShadow: filterType === f ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {f}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={fetchGeofences}
            style={{
              padding: '8px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              color: '#64748B',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Refresh geofences"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            type="button"
            onClick={() => navigate(`/admin/reports/geofence-transit?vehicleId=${vehicleId}`)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#FFFFFF',
              color: '#0284C7',
              border: '1px solid #BAE6FD',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(2, 132, 199, 0.08)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#F0F9FF')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
            title="View 3-type transit reports for this vehicle"
          >
            <BarChart2 size={15} color="#0284C7" />
            <span>Transit Report</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setReplacingGeofence(null);
              setAssignModalOpen(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#0D9488',
              color: '#FFFFFF',
              border: 'none',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(13, 148, 136, 0.25)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#0F766E')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#0D9488')}
            title="Attach an existing saved warehouse or place in 1 click"
          >
            <span>📂</span>
            <span>Choose Saved Place</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#0284C7',
              color: '#FFFFFF',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
            }}
          >
            <Plus size={16} />
            <span>Draw New Geofence</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '12px',
            color: '#DC2626',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Content State */}
      {loading ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 24px',
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            gap: '10px',
          }}
        >
          <Loader2 size={28} color="#0284C7" className="animate-spin" />
          <span style={{ fontSize: '13px', color: '#64748B' }}>Loading geofences for this vehicle...</span>
        </div>
      ) : filteredGeofences.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 24px',
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '2px dashed #E2E8F0',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#F1F5F9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px',
            }}
          >
            <Compass size={28} color="#94A3B8" />
          </div>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700, color: '#1E293B' }}>
            No Geofences Attached Yet
          </h4>
          <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748B', maxWidth: '420px' }}>
            {filterType !== 'all'
              ? `No ${filterType} geofences match your filter criteria.`
              : `You can instantly choose from your company's saved warehouses (e.g. Hyderabad, Mumbai, Nellore) or draw a brand new location on the map.`}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => {
                setReplacingGeofence(null);
                setAssignModalOpen(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#0D9488',
                color: '#FFFFFF',
                border: 'none',
                padding: '10px 18px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(13, 148, 136, 0.25)',
              }}
            >
              <span>📂</span>
              <span>Choose From Saved Places</span>
            </button>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#FFFFFF',
                color: '#0284C7',
                border: '1.5px solid #BAE6FD',
                padding: '10px 18px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <Plus size={16} />
              <span>Draw Brand New Place</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
            gap: '16px',
          }}
        >
          {filteredGeofences.map((geo) => (
            <VehicleGeofenceCard
              key={geo.id}
              geofence={geo}
              onEdit={handleOpenEditModal}
              onDelete={handleDeleteGeofence}
              onSwitchPlace={(item) => {
                setReplacingGeofence(item);
                setAssignModalOpen(true);
              }}
              onToggleActive={handleToggleActive}
              isToggling={togglingId === geo.id}
            />
          ))}
        </div>
      )}

      {/* Editor Modal (Draw New / Edit) */}
      {editorOpen && (
        <VehicleGeofenceEditorModal
          isOpen={editorOpen}
          onClose={() => setEditorOpen(false)}
          vehicle={vehicle}
          geofenceToEdit={editingGeofence}
          onSave={handleSaveGeofence}
        />
      )}

      {/* Assign Saved Geofence Modal (1-Click Picker / Switcher) */}
      {assignModalOpen && (
        <AssignSavedGeofenceModal
          isOpen={assignModalOpen}
          onClose={() => {
            setAssignModalOpen(false);
            setReplacingGeofence(null);
          }}
          vehicle={vehicle}
          replacingGeofence={replacingGeofence}
          onSuccess={() => {
            fetchGeofences();
          }}
          onOpenCreateNew={() => {
            handleOpenCreateModal();
          }}
        />
      )}
    </div>
  );
};

export default VehicleGeofenceManager;
