import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Search, Shield, Check, MapPin, Truck, AlertCircle, Loader2,
  ArrowRightLeft, Copy, CheckCircle2, RefreshCw, Zap, Layers,
  ChevronRight, ArrowRight, CornerDownRight, Radio
} from 'lucide-react';
import axiosInstance from '../../api/axios';
import { formatRadius } from '../../utils/geofenceUtils';

const CopyVehicleGeofenceModal = ({
  isOpen,
  onClose,
  vehicle, // Current vehicle being inspected
  initialMode = 'copy_from', // 'copy_from' | 'copy_to'
  onSuccess
}) => {
  const [activeTab, setActiveTab] = useState(initialMode); // 'copy_from' | 'copy_to'
  const [vehiclesSummary, setVehiclesSummary] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [error, setError] = useState('');

  // Mode 1: Copy From
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [sourceGeofences, setSourceGeofences] = useState([]);
  const [loadingSourceGeos, setLoadingSourceGeos] = useState(false);
  const [replaceExistingFrom, setReplaceExistingFrom] = useState(true);
  const [submittingFrom, setSubmittingFrom] = useState(false);

  // Mode 2: Apply To (Multiple)
  const [selectedTargetIds, setSelectedTargetIds] = useState(new Set());
  const [targetSearch, setTargetSearch] = useState('');
  const [replaceExistingTo, setReplaceExistingTo] = useState(true);
  const [submittingTo, setSubmittingTo] = useState(false);

  const currentVehicleId = vehicle?.id;

  // Sync mode when prop changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialMode);
      setError('');
    }
  }, [isOpen, initialMode]);

  // Load vehicles list with geofence counts
  useEffect(() => {
    if (!isOpen) return;

    const fetchSummary = async () => {
      setLoadingVehicles(true);
      setError('');
      try {
        let items = [];
        try {
          const res = await axiosInstance.get('/api/vehicles/geofences/summary');
          if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
            items = res.data.data;
          }
        } catch (_) {}

        // Fallback or ensure real-time accuracy via /api/vehicles
        if (items.length === 0) {
          const fallbackRes = await axiosInstance.get('/api/vehicles');
          const vehs = fallbackRes.data?.data || [];

          items = await Promise.all(
            vehs.map(async (v) => {
              try {
                const geoRes = await axiosInstance.get(`/api/vehicles/${v.id}/geofences`);
                const geos = geoRes.data?.data || [];
                return {
                  ...v,
                  geofence_count: geos.length,
                };
              } catch (_) {
                return { ...v, geofence_count: 0 };
              }
            })
          );
        }

        setVehiclesSummary(items);

        // Auto-select first available source vehicle that has geofences (excluding current vehicle)
        const availableSource = items.find(
          (v) => String(v.id) !== String(currentVehicleId) && v.geofence_count > 0
        ) || items.find((v) => String(v.id) !== String(currentVehicleId));

        if (availableSource && !selectedSourceId) {
          setSelectedSourceId(String(availableSource.id));
        }
      } catch (err) {
        setError('Failed to load vehicles list.');
      } finally {
        setLoadingVehicles(false);
      }
    };

    fetchSummary();
  }, [isOpen, currentVehicleId]);

  // Fetch preview geofences when selectedSourceId changes
  useEffect(() => {
    if (!selectedSourceId) {
      setSourceGeofences([]);
      return;
    }

    const fetchSourceGeos = async () => {
      setLoadingSourceGeos(true);
      try {
        const res = await axiosInstance.get(`/api/vehicles/${selectedSourceId}/geofences`);
        if (res.data?.success) {
          const geos = res.data.data || [];
          setSourceGeofences(geos);
          // Sync count immediately into vehiclesSummary ground truth
          setVehiclesSummary((prev) =>
            prev.map((v) =>
              String(v.id) === String(selectedSourceId)
                ? { ...v, geofence_count: geos.length }
                : v
            )
          );
        } else {
          setSourceGeofences([]);
        }
      } catch (err) {
        console.error('Failed to preview source geofences:', err);
        setSourceGeofences([]);
      } finally {
        setLoadingSourceGeos(false);
      }
    };

    fetchSourceGeos();
  }, [selectedSourceId]);

  if (!isOpen) return null;

  const currentVehicleName = vehicle?.name || vehicle?.plate || 'Current Vehicle';

  // Vehicles eligible as sources (have geofences, not current vehicle)
  const eligibleSources = vehiclesSummary.filter(
    (v) => String(v.id) !== String(currentVehicleId)
  );

  const selectedSourceVehicle = vehiclesSummary.find(
    (v) => String(v.id) === String(selectedSourceId)
  );

  // Targets for Mode 2 (all vehicles except current)
  const eligibleTargets = vehiclesSummary.filter(
    (v) => String(v.id) !== String(currentVehicleId)
  );

  const formatVehicleOptionLabel = (v) => {
    const isSelected = String(v.id) === String(selectedSourceId);
    const count = isSelected && sourceGeofences.length > 0
      ? sourceGeofences.length
      : (v.geofence_count || 0);

    const displayName = v.name && v.plate && v.name !== v.plate
      ? `${v.name} (${v.plate})`
      : (v.name || v.plate || 'Vehicle');

    if (count === 2) {
      return `${displayName} — 2 Geofences (Two-Way Transit Pair)`;
    }
    if (count === 1) {
      return `${displayName} — 1 Geofence defined`;
    }
    if (count > 2) {
      return `${displayName} — ${count} Geofences defined`;
    }
    return `${displayName} — No geofences configured`;
  };

  const filteredTargets = eligibleTargets.filter((v) => {
    if (!targetSearch.trim()) return true;
    const term = targetSearch.toLowerCase();
    return (
      v.name?.toLowerCase().includes(term) ||
      v.plate?.toLowerCase().includes(term) ||
      v.imei?.includes(term)
    );
  });

  // Handle 1-Click Copy From
  const handleExecuteCopyFrom = async () => {
    if (!selectedSourceId || !currentVehicleId) return;
    setSubmittingFrom(true);
    setError('');

    try {
      let done = false;
      try {
        const res = await axiosInstance.post(
          `/api/vehicles/${currentVehicleId}/geofences/copy-from`,
          {
            sourceVehicleId: selectedSourceId,
            replaceExisting: replaceExistingFrom,
          }
        );

        if (res.data?.success) {
          done = true;
          if (onSuccess) onSuccess(res.data.message);
          onClose();
          return;
        }
      } catch (postErr) {
        if (postErr.response?.status !== 404) {
          throw postErr;
        }
      }

      // Seamless fallback if server not restarted yet
      if (!done) {
        if (replaceExistingFrom) {
          const currentRes = await axiosInstance
            .get(`/api/vehicles/${currentVehicleId}/geofences`)
            .catch(() => ({ data: { data: [] } }));
          const currentGeos = currentRes.data?.data || [];
          for (const cg of currentGeos) {
            await axiosInstance
              .delete(`/api/vehicles/${currentVehicleId}/geofences/${cg.id}`)
              .catch(() => {});
          }
        }
        for (const sg of sourceGeofences) {
          await axiosInstance.post(`/api/vehicles/${currentVehicleId}/geofences/link`, {
            geofenceId: sg.id,
          });
        }
        if (onSuccess) {
          onSuccess(
            `Successfully copied ${sourceGeofences.length} geofence(s) from ${
              selectedSourceVehicle?.name || 'selected vehicle'
            }!`
          );
        }
        onClose();
      }
    } catch (err) {
      setError(
        err.response?.data?.error || 'Failed to copy geofences from selected vehicle.'
      );
    } finally {
      setSubmittingFrom(false);
    }
  };

  // Handle 1-Click Apply To Multiple
  const handleExecuteCopyTo = async () => {
    if (selectedTargetIds.size === 0 || !currentVehicleId) return;
    setSubmittingTo(true);
    setError('');

    try {
      let done = false;
      try {
        const res = await axiosInstance.post(
          `/api/vehicles/${currentVehicleId}/geofences/copy-to`,
          {
            targetVehicleIds: Array.from(selectedTargetIds),
            replaceExisting: replaceExistingTo,
          }
        );

        if (res.data?.success) {
          done = true;
          if (onSuccess) onSuccess(res.data.message);
          onClose();
          return;
        }
      } catch (postErr) {
        if (postErr.response?.status !== 404) {
          throw postErr;
        }
      }

      // Seamless fallback if server not restarted yet
      if (!done) {
        const currentRes = await axiosInstance
          .get(`/api/vehicles/${currentVehicleId}/geofences`)
          .catch(() => ({ data: { data: [] } }));
        const myGeos = currentRes.data?.data || [];

        for (const targetId of selectedTargetIds) {
          if (replaceExistingTo) {
            const tRes = await axiosInstance
              .get(`/api/vehicles/${targetId}/geofences`)
              .catch(() => ({ data: { data: [] } }));
            const tGeos = tRes.data?.data || [];
            for (const tg of tGeos) {
              await axiosInstance
                .delete(`/api/vehicles/${targetId}/geofences/${tg.id}`)
                .catch(() => {});
            }
          }
          for (const mg of myGeos) {
            await axiosInstance
              .post(`/api/vehicles/${targetId}/geofences/link`, {
                geofenceId: mg.id,
              })
              .catch(() => {});
          }
        }

        if (onSuccess) {
          onSuccess(
            `Successfully applied geofences to ${selectedTargetIds.size} vehicle(s)!`
          );
        }
        onClose();
      }
    } catch (err) {
      setError(
        err.response?.data?.error || 'Failed to apply geofences to selected vehicles.'
      );
    } finally {
      setSubmittingTo(false);
    }
  };

  const handleToggleSelectAllTargets = () => {
    if (selectedTargetIds.size === filteredTargets.length) {
      setSelectedTargetIds(new Set());
    } else {
      setSelectedTargetIds(new Set(filteredTargets.map((v) => String(v.id))));
    }
  };

  const handleToggleTarget = (id) => {
    const sId = String(id);
    setSelectedTargetIds((prev) => {
      const next = new Set(prev);
      if (next.has(sId)) {
        next.delete(sId);
      } else {
        next.add(sId);
      }
      return next;
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #F1F5F9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(to right, #F8FAFC, #FFFFFF)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: '#4F46E515',
                border: '1px solid #4F46E530',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ArrowRightLeft size={22} color="#4F46E5" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0F172A' }}>
                Clone & Sync Vehicle Geofences
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                Set identical geofences or transit pairs across your fleet with 1 click.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#F1F5F9',
              border: 'none',
              borderRadius: '8px',
              padding: '8px',
              cursor: 'pointer',
              color: '#64748B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#E2E8F0')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#F1F5F9')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            padding: '8px 24px 0',
            borderBottom: '1px solid #E2E8F0',
            background: '#FAFAFA',
            gap: '8px',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('copy_from')}
            style={{
              padding: '10px 16px',
              border: 'none',
              borderBottom: activeTab === 'copy_from' ? '2px solid #4F46E5' : '2px solid transparent',
              background: 'transparent',
              fontSize: '13px',
              fontWeight: activeTab === 'copy_from' ? 700 : 500,
              color: activeTab === 'copy_from' ? '#4F46E5' : '#64748B',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Zap size={14} />
            <span>Set Same as Another Vehicle</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('copy_to')}
            style={{
              padding: '10px 16px',
              border: 'none',
              borderBottom: activeTab === 'copy_to' ? '2px solid #4F46E5' : '2px solid transparent',
              background: 'transparent',
              fontSize: '13px',
              fontWeight: activeTab === 'copy_to' ? 700 : 500,
              color: activeTab === 'copy_to' ? '#4F46E5' : '#64748B',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Layers size={14} />
            <span>Apply This Vehicle to Others</span>
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div
            style={{
              margin: '16px 24px 0',
              padding: '10px 14px',
              borderRadius: '8px',
              background: '#FEF2F2',
              border: '1px solid #FCA5A5',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#B91C1C',
              fontSize: '12px',
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Modal Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {loadingVehicles ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
              <Loader2 size={32} className="animate-spin" color="#4F46E5" />
              <p style={{ marginTop: '12px', fontSize: '13px', color: '#64748B' }}>Loading fleet vehicles...</p>
            </div>
          ) : activeTab === 'copy_from' ? (
            /* ======================================================== */
            /* TAB 1: COPY FROM ANOTHER VEHICLE TO THIS VEHICLE          */
            /* ======================================================== */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Target Notice Box */}
              <div
                style={{
                  background: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <Truck size={18} color="#16A34A" />
                <div style={{ fontSize: '13px', color: '#166534' }}>
                  Target Vehicle:{' '}
                  <strong style={{ color: '#0F172A' }}>
                    {currentVehicleName} {vehicle?.plate ? `(${vehicle.plate})` : ''}
                  </strong>
                </div>
              </div>

              {/* Source Vehicle Select */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>
                  1. Select Source Vehicle to copy from:
                </label>
                <select
                  value={selectedSourceId}
                  onChange={(e) => setSelectedSourceId(e.target.value)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#0F172A',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">-- Choose a vehicle --</option>
                  {eligibleSources.map((v) => (
                    <option key={v.id} value={v.id}>
                      {formatVehicleOptionLabel(v)}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '11px', color: '#64748B' }}>
                  Pick the vehicle that already has the exact warehouse / route geofences you need.
                </span>
              </div>

              {/* Geofences Preview Card */}
              {selectedSourceId && (
                <div
                  style={{
                    background: '#F8FAFC',
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0',
                    padding: '16px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Shield size={16} color="#4F46E5" />
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>
                        Geofences to be copied ({sourceGeofences.length})
                      </span>
                    </div>
                    {sourceGeofences.length === 2 && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          background: '#EEF2FF',
                          color: '#4F46E5',
                          padding: '2px 8px',
                          borderRadius: '99px',
                        }}
                      >
                        ⇄ Origin-Destination Transit Pair
                      </span>
                    )}
                  </div>

                  {loadingSourceGeos ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px', color: '#64748B', fontSize: '12px' }}>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Reading geofences from selected vehicle...</span>
                    </div>
                  ) : sourceGeofences.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>
                      This vehicle does not have any geofences assigned yet. Choose another vehicle above.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {sourceGeofences.map((geo, idx) => (
                        <div
                          key={geo.id || idx}
                          style={{
                            background: '#FFFFFF',
                            borderRadius: '8px',
                            border: '1px solid #E2E8F0',
                            padding: '10px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                background: geo.color ? `${geo.color}15` : '#4F46E515',
                                border: `1px solid ${geo.color || '#4F46E5'}40`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                fontWeight: 800,
                                color: geo.color || '#4F46E5',
                              }}
                            >
                              {sourceGeofences.length === 2 ? (idx === 0 ? 'A' : 'B') : '⬡'}
                            </div>
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                                {geo.name}
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748B' }}>
                                {geo.type === 'circle'
                                  ? `Circle • ${formatRadius(geo.radius)}`
                                  : 'Polygon Zone'}{' '}
                                • Center: {Number(geo.center_lat || 0).toFixed(4)},{' '}
                                {Number(geo.center_lng || 0).toFixed(4)}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '4px' }}>
                            {geo.alert_on_enter && (
                              <span style={{ fontSize: '10px', background: '#DCFCE7', color: '#166534', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                Enter Alert
                              </span>
                            )}
                            {geo.alert_on_exit && (
                              <span style={{ fontSize: '10px', background: '#FEF3C7', color: '#92400E', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                Exit Alert
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Replace Existing Option */}
              <div
                style={{
                  background: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <input
                  type="checkbox"
                  id="replace_existing_from"
                  checked={replaceExistingFrom}
                  onChange={(e) => setReplaceExistingFrom(e.target.checked)}
                  style={{ marginTop: '3px', cursor: 'pointer' }}
                />
                <label
                  htmlFor="replace_existing_from"
                  style={{ fontSize: '12px', color: '#78350F', cursor: 'pointer', lineHeight: 1.4 }}
                >
                  <strong style={{ display: 'block', color: '#92400E' }}>
                    Replace existing geofences on {currentVehicleName}
                  </strong>
                  Unlinks any previous owner's or old geofences currently set on this vehicle and sets it to cleanly match{' '}
                  {selectedSourceVehicle?.name || 'the source vehicle'}. (Recommended)
                </label>
              </div>

              {/* 1-Click Action Button */}
              <button
                type="button"
                onClick={handleExecuteCopyFrom}
                disabled={submittingFrom || !selectedSourceId || sourceGeofences.length === 0}
                style={{
                  padding: '12px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  background:
                    submittingFrom || !selectedSourceId || sourceGeofences.length === 0
                      ? '#CBD5E1'
                      : '#4F46E5',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor:
                    submittingFrom || !selectedSourceId || sourceGeofences.length === 0
                      ? 'not-allowed'
                      : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
                  transition: 'background 0.15s ease',
                }}
              >
                {submittingFrom ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Applying geofences...</span>
                  </>
                ) : (
                  <>
                    <Zap size={16} />
                    <span>
                      Set as {selectedSourceVehicle?.name || 'Selected Vehicle'} (1-Click)
                    </span>
                  </>
                )}
              </button>
            </div>
          ) : (
            /* ======================================================== */
            /* TAB 2: APPLY THIS VEHICLE'S GEOFENCES TO OTHER VEHICLES   */
            /* ======================================================== */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  background: '#EEF2FF',
                  border: '1px solid #C7D2FE',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  fontSize: '13px',
                  color: '#3730A3',
                }}
              >
                Push the current geofence configuration of{' '}
                <strong>{currentVehicleName}</strong> to other vehicles in your fleet (e.g. newly purchased trucks).
              </div>

              {/* Search and Select All */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    type="text"
                    value={targetSearch}
                    onChange={(e) => setTargetSearch(e.target.value)}
                    placeholder="Search vehicles by name, plate, or IMEI..."
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 34px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '12px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <Search
                    size={14}
                    color="#94A3B8"
                    style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleToggleSelectAllTargets}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    background: '#FFFFFF',
                    color: '#475569',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {selectedTargetIds.size === filteredTargets.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              {/* Targets List */}
              <div
                style={{
                  maxHeight: '220px',
                  overflowY: 'auto',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                {filteredTargets.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>
                    No other vehicles found.
                  </div>
                ) : (
                  filteredTargets.map((v) => {
                    const isChecked = selectedTargetIds.has(String(v.id));
                    return (
                      <div
                        key={v.id}
                        onClick={() => handleToggleTarget(v.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          background: isChecked ? '#F0FDF4' : '#FFFFFF',
                          border: `1px solid ${isChecked ? '#86EFAC' : '#F1F5F9'}`,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // handled by parent onClick
                            style={{ cursor: 'pointer' }}
                          />
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>
                              {v.name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748B' }}>
                              {v.plate || 'No plate'} {v.imei ? `• IMEI: ${v.imei}` : ''}
                            </div>
                          </div>
                        </div>

                        <span
                          style={{
                            fontSize: '11px',
                            color: v.geofence_count > 0 ? '#0284C7' : '#94A3B8',
                            fontWeight: 600,
                          }}
                        >
                          {v.geofence_count === 2
                            ? '2 Geofences (Two-Way Pair)'
                            : v.geofence_count > 0
                            ? `${v.geofence_count} defined`
                            : 'No geofences'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Replace existing option for Mode 2 */}
              <div
                style={{
                  background: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <input
                  type="checkbox"
                  id="replace_existing_to"
                  checked={replaceExistingTo}
                  onChange={(e) => setReplaceExistingTo(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label
                  htmlFor="replace_existing_to"
                  style={{ fontSize: '12px', color: '#92400E', cursor: 'pointer' }}
                >
                  Replace existing geofences on target vehicles with this vehicle's geofences
                </label>
              </div>

              {/* 1-Click Action Button */}
              <button
                type="button"
                onClick={handleExecuteCopyTo}
                disabled={submittingTo || selectedTargetIds.size === 0}
                style={{
                  padding: '12px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  background: submittingTo || selectedTargetIds.size === 0 ? '#CBD5E1' : '#4F46E5',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: submittingTo || selectedTargetIds.size === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
                }}
              >
                {submittingTo ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Applying geofences to {selectedTargetIds.size} vehicles...</span>
                  </>
                ) : (
                  <>
                    <Zap size={16} />
                    <span>
                      Apply to {selectedTargetIds.size} Selected Vehicle(s) (1-Click)
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CopyVehicleGeofenceModal;
