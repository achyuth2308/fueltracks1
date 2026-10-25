import React, { useState, useEffect } from 'react';
import {
  X, Search, Shield, Check, MapPin, Truck, AlertCircle, Loader2,
  ArrowRightLeft, Plus, ExternalLink
} from 'lucide-react';
import axiosInstance from '../../api/axios';
import { formatRadius } from '../../utils/geofenceUtils';

const AssignSavedGeofenceModal = ({
  isOpen,
  onClose,
  vehicle,
  replacingGeofence = null, // if passed, we are switching/replacing this geofence
  onSuccess,
  onOpenCreateNew
}) => {
  const [search, setSearch] = useState('');
  const [availableGeofences, setAvailableGeofences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState(null);
  const [error, setError] = useState('');

  const vehicleId = vehicle?.id;

  useEffect(() => {
    if (!isOpen || !vehicleId) return;

    const fetchAvailable = async () => {
      setLoading(true);
      setError('');
      try {
        let items = [];
        try {
          const res = await axiosInstance.get(`/api/vehicles/${vehicleId}/available-geofences`);
          if (res.data?.success && Array.isArray(res.data.data)) {
            items = res.data.data;
          }
        } catch (subErr) {
          // Fallback to /api/admin/geofences
          const [adminRes, currentRes] = await Promise.all([
            axiosInstance.get('/api/admin/geofences').catch(() => ({ data: { data: [] } })),
            axiosInstance.get(`/api/vehicles/${vehicleId}/geofences`).catch(() => ({ data: { data: [] } })),
          ]);

          const allGeos = adminRes.data?.data || [];
          const currentGeos = currentRes.data?.data || [];
          const currentIds = new Set(currentGeos.map((g) => g.id));

          items = allGeos.map((g) => ({
            ...g,
            is_assigned_to_vehicle: currentIds.has(g.id),
          }));
        }

        setAvailableGeofences(items);
      } catch (err) {
        console.error('Failed to load places:', err);
        setError('Failed to fetch saved places from database.');
      } finally {
        setLoading(false);
      }
    };

    fetchAvailable();
  }, [isOpen, vehicleId]);

  if (!isOpen) return null;

  const filtered = availableGeofences.filter((g) => {
    if (!search.trim()) return true;
    return g.name?.toLowerCase().includes(search.toLowerCase());
  });

  const handleAssign = async (geofence) => {
    if (!vehicleId) return;
    setAssigningId(geofence.id);
    setError('');

    try {
      let linked = false;
      try {
        const res = await axiosInstance.post(`/api/vehicles/${vehicleId}/geofences/link`, {
          geofenceId: geofence.id,
          replaceGeofenceId: replacingGeofence ? replacingGeofence.id : undefined,
        });
        if (res.data?.success) {
          linked = true;
        }
      } catch (linkErr) {
        // Fallback to admin assign endpoints
        if (replacingGeofence) {
          const oldVehsRes = await axiosInstance.get(`/api/admin/geofences/${replacingGeofence.id}/vehicles`).catch(() => ({ data: { data: [] } }));
          const remainingIds = (oldVehsRes.data?.data || []).map((v) => v.id).filter((id) => id !== vehicleId);
          await axiosInstance.post(`/api/admin/geofences/${replacingGeofence.id}/assign`, { vehicleIds: remainingIds }).catch(() => {});
        }

        const newVehsRes = await axiosInstance.get(`/api/admin/geofences/${geofence.id}/vehicles`).catch(() => ({ data: { data: [] } }));
        const existingIds = (newVehsRes.data?.data || []).map((v) => v.id);
        const updatedIds = Array.from(new Set([...existingIds, vehicleId]));
        const assignRes = await axiosInstance.post(`/api/admin/geofences/${geofence.id}/assign`, { vehicleIds: updatedIds });
        if (assignRes.data?.success) {
          linked = true;
        }
      }

      if (linked) {
        if (onSuccess) onSuccess(geofence);
        onClose();
      } else {
        setError('Failed to link geofence to this vehicle.');
      }
    } catch (err) {
      console.error('Error assigning geofence:', err);
      setError(err.response?.data?.error || 'Failed to assign geofence.');
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: '1px solid #E2E8F0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #E2E8F0',
            background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'rgba(13, 148, 136, 0.25)',
                border: '1px solid rgba(13, 148, 136, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Shield size={22} color="#2DD4BF" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, letterSpacing: '-0.01em' }}>
                {replacingGeofence ? 'Switch / Reassign Geofence' : 'Choose From Saved Places'}
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>
                Vehicle: <strong style={{ color: '#FFFFFF' }}>{vehicle?.name || 'Selected Vehicle'}</strong>
                {replacingGeofence && (
                  <span> • Replacing: <strong style={{ color: '#F87171' }}>{replacingGeofence.name}</strong></span>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '8px',
              color: '#FFFFFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div style={{ padding: '16px 24px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', gap: '10px' }}>
          <div
            style={{
              position: 'relative',
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              background: '#FFFFFF',
              borderRadius: '10px',
              border: '1.5px solid #CBD5E1',
              padding: '0 12px',
            }}
          >
            <Search size={16} color="#64748B" style={{ marginRight: '8px' }} />
            <input
              type="text"
              placeholder="Search by warehouse or city (e.g. Hyderabad, Nellore, Mumbai)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '13px',
                fontWeight: 600,
                color: '#0F172A',
                height: '40px',
              }}
            />
          </div>

          {onOpenCreateNew && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCreateNew();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#FFFFFF',
                color: '#0284C7',
                border: '1.5px solid #BAE6FD',
                borderRadius: '10px',
                padding: '0 14px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <Plus size={15} />
              <span>Draw New Place</span>
            </button>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div
            style={{
              margin: '12px 24px 0 24px',
              padding: '10px 14px',
              borderRadius: '8px',
              background: '#FEF2F2',
              border: '1px solid #FCA5A5',
              color: '#DC2626',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Saved Places List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: '12px', color: '#64748B' }}>
              <Loader2 size={28} className="animate-spin text-teal-600" />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Loading saved places from software...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', background: '#F8FAFC', borderRadius: '16px', border: '1px dashed #CBD5E1' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>🏢</div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                {search ? 'No matching saved places found' : 'No master places saved yet'}
              </h3>
              <p style={{ margin: '6px 0 16px 0', fontSize: '12px', color: '#64748B', maxWidth: '360px', marginLeft: 'auto', marginRight: 'auto' }}>
                {search ? 'Try checking your spelling or search another keyword.' : 'Draw a new location on the map to save it to your company places library.'}
              </p>
              {onOpenCreateNew && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCreateNew();
                  }}
                  style={{
                    background: '#0284C7',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  + Draw New Geofence on Map
                </button>
              )}
            </div>
          ) : (
            filtered.map((item) => {
              const isAlreadyAssigned = item.is_assigned_to_vehicle;
              const isCurrentReplacing = replacingGeofence && replacingGeofence.id === item.id;
              const isWorking = assigningId === item.id;

              return (
                <div
                  key={item.id}
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '14px',
                    border: isAlreadyAssigned ? '1.5px solid #10B981' : '1px solid #E2E8F0',
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                  }}
                >
                  {/* Left Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        background: item.color ? `${item.color}15` : '#F1F5F9',
                        border: `1.5px solid ${item.color || '#CBD5E1'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <MapPin size={20} color={item.color || '#0284C7'} />
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
                          {item.name}
                        </span>
                        {isAlreadyAssigned && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              background: '#ECFDF5',
                              color: '#047857',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              border: '1px solid #A7F3D0',
                            }}
                          >
                            Currently Active
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', fontSize: '11px', color: '#64748B' }}>
                        <span>Type: <b>{item.type === 'circle' ? `Circle (${formatRadius(item.radius)})` : 'Polygon'}</b></span>
                        <span>•</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Truck size={12} color="#0284C7" />
                          <b>{item.assigned_vehicles_count || 0}</b> trucks assigned
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Button */}
                  <div>
                    {isCurrentReplacing ? (
                      <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>Current Selection</span>
                    ) : isAlreadyAssigned ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 700, color: '#047857' }}>
                        <Check size={16} />
                        <span>Attached</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={isWorking}
                        onClick={() => handleAssign(item)}
                        style={{
                          background: replacingGeofence ? '#0284C7' : '#0D9488',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '8px 14px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: isWorking ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 6px rgba(13, 148, 136, 0.3)',
                          transition: 'all 0.15s ease',
                          opacity: isWorking ? 0.7 : 1,
                        }}
                      >
                        {isWorking ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : replacingGeofence ? (
                          <ArrowRightLeft size={13} />
                        ) : (
                          <Check size={13} />
                        )}
                        <span>{replacingGeofence ? 'Switch to this Place' : 'Assign to Vehicle'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info note */}
        <div
          style={{
            padding: '12px 24px',
            background: '#F1F5F9',
            borderTop: '1px solid #E2E8F0',
            fontSize: '11px',
            color: '#64748B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>💡 <b>Tip</b>: Multiple vehicles can share the exact same warehouse without re-drawing.</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '6px',
              padding: '5px 12px',
              fontSize: '11px',
              fontWeight: 700,
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignSavedGeofenceModal;
