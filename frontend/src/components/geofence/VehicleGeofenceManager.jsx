import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Plus, RefreshCw, Loader2, AlertCircle, Compass,
  CheckCircle2, Filter, Layers, Navigation, FolderPlus,
  ArrowRightLeft, Zap, Check
} from 'lucide-react';
import axiosInstance from '../../api/axios';
import VehicleGeofenceCard from './VehicleGeofenceCard';
import VehicleTransitPairCard from './VehicleTransitPairCard';
import VehicleGeofenceEditorModal from './VehicleGeofenceEditorModal';
import AssignSavedGeofenceModal from './AssignSavedGeofenceModal';
import CopyVehicleGeofenceModal from './CopyVehicleGeofenceModal';

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
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copyModalMode, setCopyModalMode] = useState('copy_from');
  const [toastMessage, setToastMessage] = useState('');

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
      // 1. Process Location A (From / Origin / Base)
      if (formData.fromGeofence?.id) {
        await axiosInstance.post(`/api/vehicles/${vehicleId}/geofences/link`, {
          geofenceId: formData.fromGeofence.id,
          vehicleIds: formData.vehicleIds,
        }).catch((err) => {
          throw new Error(err.response?.data?.error || err.message || 'Failed to link Location A geofence.');
        });
      } else if (formData.fromGeofence) {
        const resA = await axiosInstance.post(
          `/api/vehicles/${vehicleId}/geofences`,
          formData.fromGeofence
        ).catch((err) => {
          throw new Error(err.response?.data?.error || err.message || 'Failed to create Location A geofence.');
        });
        if (!resA.data?.success) {
          throw new Error(resA.data?.error || 'Failed to create Location A geofence.');
        }
      }

      // 2. Process Location B (To / Destination)
      if (formData.transitDirection !== 'round_trip' && formData.toGeofence) {
        if (formData.toGeofence?.id) {
          await axiosInstance.post(`/api/vehicles/${vehicleId}/geofences/link`, {
            geofenceId: formData.toGeofence.id,
            vehicleIds: formData.vehicleIds,
          }).catch((err) => {
            throw new Error(err.response?.data?.error || err.message || 'Failed to link Location B geofence.');
          });
        } else {
          const resB = await axiosInstance.post(
            `/api/vehicles/${vehicleId}/geofences`,
            formData.toGeofence
          ).catch((err) => {
            throw new Error(err.response?.data?.error || err.message || 'Failed to create Location B geofence.');
          });
          if (!resB.data?.success) {
            throw new Error(resB.data?.error || 'Failed to create Location B geofence.');
          }
        }
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
      // Create directly for this vehicle
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
              Virtual boundaries and alert zones configured specifically for {vehicle?.name || 'this vehicle'}.
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

          {/* 1-Click Set Same As Another Vehicle */}
          <button
            type="button"
            onClick={() => {
              setCopyModalMode('copy_from');
              setCopyModalOpen(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#4F46E5',
              color: '#FFFFFF',
              border: 'none',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#4338CA')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#4F46E5')}
            title="Set this vehicle's geofences identical to another vehicle with 1 click"
          >
            <Zap size={14} />
            <span>Set Same as Vehicle</span>
          </button>

          {/* Bulk push to other vehicles (if this vehicle has geofences) */}
          {geofences.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setCopyModalMode('copy_to');
                setCopyModalOpen(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#FFFFFF',
                color: '#4F46E5',
                border: '1px solid #C7D2FE',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(79, 70, 229, 0.08)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#EEF2FF')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
              title="Push this vehicle's geofence setup to other vehicles in your fleet"
            >
              <ArrowRightLeft size={14} />
              <span>Apply to Others</span>
            </button>
          )}

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
                setCopyModalMode('copy_from');
                setCopyModalOpen(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#4F46E5',
                color: '#FFFFFF',
                border: 'none',
                padding: '10px 18px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)',
              }}
            >
              <Zap size={16} />
              <span>Set Same as Another Vehicle</span>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Unified Transit Pair Card when 2 geofences are attached */}
          {filteredGeofences.length === 2 ? (
            <div style={{ maxWidth: '640px' }}>
              <VehicleTransitPairCard
                vehicle={vehicle}
                geofenceA={filteredGeofences[0]}
                geofenceB={filteredGeofences[1]}
                onEdit={handleOpenEditModal}
                onDelete={handleDeleteGeofence}
                onSwitchPlace={(item) => {
                  setReplacingGeofence(item);
                  setAssignModalOpen(true);
                }}
                onToggleActive={handleToggleActive}
                isToggling={Boolean(togglingId)}
              />
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

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: '#0F172A',
            color: '#FFFFFF',
            padding: '12px 20px',
            borderRadius: '10px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            zIndex: 999999,
            fontSize: '13px',
            fontWeight: 600,
            animation: 'slideUp 0.25s ease',
          }}
        >
          <CheckCircle2 size={18} color="#22C55E" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage('')}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              marginLeft: '8px',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Copy / Sync Vehicle Geofence Modal */}
      {copyModalOpen && (
        <CopyVehicleGeofenceModal
          isOpen={copyModalOpen}
          onClose={() => setCopyModalOpen(false)}
          vehicle={vehicle}
          initialMode={copyModalMode}
          onSuccess={(msg) => {
            fetchGeofences();
            setToastMessage(msg || 'Geofences synchronized successfully!');
            setTimeout(() => setToastMessage(''), 4500);
          }}
        />
      )}
    </div>
  );
};

export default VehicleGeofenceManager;
