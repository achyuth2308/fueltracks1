import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Home, ChevronRight, ArrowLeft, Loader2, AlertTriangle, CheckCircle2,
  Trash2, MapPin, Truck, Plus, Eye
} from 'lucide-react';
import * as adminApi from '../../api/adminApi';
import * as vehicleApi from '../../api/vehicleApi';

export default function OrgTrackAdminPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [org, setOrg] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [viewMode, setViewMode] = useState(false); // false = Create Form, true = Table View

  // Form State
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [trackName, setTrackName] = useState('');

  // Fetch Organization, Tracks, and Vehicles
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch organization details
      const orgRes = await adminApi.getOrgById(id);
      let orgData = null;
      if (orgRes && orgRes.success && orgRes.data) {
        orgData = orgRes.data;
        setOrg(orgData);
      }

      // 2. Fetch tracks & vehicles via dedicated org tracks API
      let loadedTracks = [];
      let loadedVehicles = [];

      try {
        const tracksRes = await adminApi.getOrgTracks(id);
        if (tracksRes && tracksRes.success && tracksRes.data) {
          loadedTracks = tracksRes.data.tracks || [];
          loadedVehicles = tracksRes.data.vehicles || [];
        }
      } catch (err) {
        console.warn('Dedicated getOrgTracks failed, falling back:', err.message);
      }

      // Fallback vehicles if none returned
      if (loadedVehicles.length === 0) {
        try {
          const vehRes = await vehicleApi.getVehicles();
          const allVeh = Array.isArray(vehRes) ? vehRes : (vehRes.data || vehRes.vehicles || []);
          loadedVehicles = allVeh.filter(v => !v.org_id || v.org_id === id);
        } catch (_) {}
      }

      // Fallback routes if none returned
      if (loadedTracks.length === 0) {
        try {
          const routesRes = await adminApi.getRoutes({ org_id: id });
          if (routesRes && routesRes.success && Array.isArray(routesRes.data)) {
            loadedTracks = routesRes.data.filter(r => !r.org_id || r.org_id === id);
          }
        } catch (_) {}
      }

      // Fallback to org settings if routes table empty
      if (loadedTracks.length === 0 && orgData?.settings?.organization_tracks) {
        loadedTracks = orgData.settings.organization_tracks;
      }

      setVehicles(loadedVehicles);
      setTracks(loadedTracks);
      if (loadedVehicles.length > 0 && !selectedVehicleId) {
        setSelectedVehicleId(loadedVehicles[0].id);
      }
    } catch (err) {
      console.error('Failed to load organization track data:', err);
      setError('Failed to load organization track details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  // Handle Create Organization Track
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!trackName.trim()) {
      setError('Track Name is required.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      let created = false;

      // 1. Try dedicated endpoint first
      try {
        const res = await adminApi.createOrgTrack(id, {
          name: trackName.trim(),
          coordinates: [{ lat: 17.3850, lng: 78.4867 }, { lat: 17.3900, lng: 78.4900 }],
          tolerance: 100,
          vehicle_id: selectedVehicleId || null
        });
        if (res && res.success) {
          created = true;
        }
      } catch (e) {
        console.warn('createOrgTrack API error, trying createRoute fallback:', e.message);
      }

      // 2. Fallback to createRoute
      if (!created) {
        const routeRes = await adminApi.createRoute({
          org_id: id,
          name: trackName.trim(),
          coordinates: [{ lat: 17.3850, lng: 78.4867 }, { lat: 17.3900, lng: 78.4900 }],
          tolerance: 100,
          vehicle_id: selectedVehicleId || null
        });
        if (routeRes && routeRes.success) {
          created = true;
          const createdRouteId = routeRes.data?.id;
          if (createdRouteId && selectedVehicleId) {
            try {
              await adminApi.assignRoute(createdRouteId, [selectedVehicleId]);
            } catch (_) {}
          }
        }
      }

      // 3. Dual-persist in org settings
      const currentSettings = org?.settings || {};
      const orgTracks = Array.isArray(currentSettings.organization_tracks)
        ? [...currentSettings.organization_tracks]
        : [];
      const newTrackEntry = {
        id: 'track_' + Date.now(),
        name: trackName.trim(),
        vehicle_id: selectedVehicleId || null,
        created_at: new Date().toISOString()
      };
      orgTracks.push(newTrackEntry);

      await adminApi.updateOrg(id, {
        settings: {
          ...currentSettings,
          organization_tracks: orgTracks
        }
      });

      setSuccess('Organization Track created and assigned successfully.');
      setTrackName('');
      setTimeout(() => setSuccess(null), 3500);

      // Refresh list
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to submit Organization Track.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Track
  const handleDeleteTrack = async (trackId) => {
    if (!window.confirm('Are you sure you want to delete this track?')) return;
    try {
      try {
        await adminApi.deleteOrgTrack(id, trackId);
      } catch (_) {
        await adminApi.deleteRoute(trackId);
      }

      // Clean from org settings
      const currentSettings = org?.settings || {};
      if (Array.isArray(currentSettings.organization_tracks)) {
        const updatedTracks = currentSettings.organization_tracks.filter(t => t.id !== trackId);
        await adminApi.updateOrg(id, {
          settings: { ...currentSettings, organization_tracks: updatedTracks }
        });
      }

      setTracks(prev => prev.filter(t => t.id !== trackId));
      setSuccess('Track deleted successfully.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to delete track.');
    }
  };

  const orgDisplayName = org?.phone || org?.name || 'Organization';

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '12px' }}>
        <Loader2 size={32} color="#f97316" className="animate-spin" />
        <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 500 }}>Loading Organization Track...</span>
      </div>
    );
  }

  return (
    <div className="pastel-page-bg" style={{ padding: '32px', minHeight: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '1150px', width: '100%', margin: '0 auto' }}>

        {/* Top Header & Breadcrumbs Bar (FuelTracks Themed) */}
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
            color: '#111827',
            letterSpacing: '-0.02em',
            margin: 0
          }}>
            Organization Track
          </h1>

          <div style={{ width: '1px', height: '22px', background: '#cbd5e1' }} />

          {/* Breadcrumb Line with FuelTracks brand accent */}
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
              onClick={() => navigate('/admin/organizations')}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#64748b', fontWeight: 500 }}
            >
              Organizations
            </button>
            <ChevronRight size={13} color="#94a3b8" />
            <span style={{ color: '#64748b' }}>Organization Track</span>
            <ChevronRight size={13} color="#94a3b8" />
            <span style={{ color: '#f97316', fontWeight: 700 }}>{orgDisplayName}</span>
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
            marginBottom: '20px'
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
            marginBottom: '20px'
          }}>
            <CheckCircle2 size={18} />
            <span>{success}</span>
          </div>
        )}

        {/* Main Card (FuelTracks Theme) */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03), 0 2px 4px -2px rgba(0,0,0,0.03)',
          overflow: 'hidden'
        }}>
          {/* Card Top Action Row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 28px',
            borderBottom: '1px solid #f1f5f9',
            background: '#ffffff'
          }}>
            {/* FuelTracks Orange Circular Back Arrow */}
            <button
              type="button"
              onClick={() => navigate('/admin/organizations')}
              title="Back to Organizations"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: '#f97316',
                color: '#ffffff',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(249,115,22,0.3)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#ea580c';
                e.currentTarget.style.transform = 'scale(1.06)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#f97316';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <ArrowLeft size={16} strokeWidth={2.5} />
            </button>

            {/* Top Right "View Organization Track" Button (FuelTracks Orange) */}
            <button
              type="button"
              onClick={() => setViewMode(prev => !prev)}
              style={{
                padding: '9px 20px',
                borderRadius: '10px',
                border: 'none',
                background: '#f97316',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(249,115,22,0.25)',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#ea580c';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#f97316';
                e.currentTarget.style.transform = 'none';
              }}
            >
              {viewMode ? (
                <>
                  <Plus size={15} />
                  <span>Add Organization Track</span>
                </>
              ) : (
                <>
                  <Eye size={15} />
                  <span>View Organization Track</span>
                </>
              )}
            </button>
          </div>

          {!viewMode ? (
            /* CREATE FORM */
            <form onSubmit={handleSubmit} style={{ padding: '40px 32px 52px 32px', maxWidth: '680px', margin: '0 auto' }}>
              {/* Row 1: Organization Name */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '180px 1fr',
                alignItems: 'center',
                gap: '24px',
                marginBottom: '26px'
              }}>
                <label style={{ fontSize: '14.5px', fontWeight: 600, color: '#334155' }}>
                  Organization Name
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={orgDisplayName}
                  style={{
                    width: '100%',
                    height: '42px',
                    padding: '0 16px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#64748b',
                    outline: 'none',
                    boxSizing: 'border-box',
                    cursor: 'not-allowed'
                  }}
                />
              </div>

              {/* Row 2: Vehicle ID */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '180px 1fr',
                alignItems: 'center',
                gap: '24px',
                marginBottom: '26px'
              }}>
                <label style={{ fontSize: '14.5px', fontWeight: 600, color: '#334155' }}>
                  Vehicle ID
                </label>
                <div>
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#FFFFFF',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: '#1e293b',
                      outline: 'none',
                      boxSizing: 'border-box',
                      cursor: 'pointer',
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
                  >
                    {vehicles.length === 0 ? (
                      <option value="">No vehicles found for this organization</option>
                    ) : (
                      vehicles.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.name || 'Vehicle'} {v.plate ? `(${v.plate})` : (v.imei ? `[${v.imei}]` : '')}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Row 3: Track Name */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '180px 1fr',
                alignItems: 'center',
                gap: '24px',
                marginBottom: '38px'
              }}>
                <label style={{ fontSize: '14.5px', fontWeight: 600, color: '#334155' }}>
                  Track Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Track Name"
                  value={trackName}
                  onChange={(e) => setTrackName(e.target.value)}
                  style={{
                    width: '100%',
                    height: '42px',
                    padding: '0 16px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#FFFFFF',
                    fontSize: '14px',
                    color: '#1e293b',
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

              {/* Centered FuelTracks Orange Submit Button */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '11px 44px',
                    borderRadius: '10px',
                    background: '#f97316',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: 700,
                    border: 'none',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(249, 115, 22, 0.3)',
                    transition: 'all 0.15s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    opacity: submitting ? 0.75 : 1
                  }}
                  onMouseEnter={e => {
                    if (!submitting) {
                      e.currentTarget.style.background = '#ea580c';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 6px 18px rgba(249, 115, 22, 0.4)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!submitting) {
                      e.currentTarget.style.background = '#f97316';
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = '0 4px 14px rgba(249, 115, 22, 0.3)';
                    }
                  }}
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                  <span>{submitting ? 'Submitting...' : 'Submit'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* VIEW MODE: List of Organization Tracks (FuelTracks Deep Navy Table) */
            <div style={{ padding: '24px 28px' }}>
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
                  Registered Organization Tracks ({tracks.length})
                </h3>
                <p style={{ fontSize: '13.5px', color: '#64748b', margin: 0 }}>
                  Active vehicle routes and tracking corridors assigned to <span style={{ color: '#f97316', fontWeight: 700 }}>{orgDisplayName}</span>.
                </p>
              </div>

              <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#1e1b4b', borderBottom: '1px solid #E2E8F0' }}>
                      <th style={{ padding: '14px 20px', fontSize: '12px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', width: '8%', textAlign: 'center', letterSpacing: '0.05em' }}>
                        #
                      </th>
                      <th style={{ padding: '14px 24px', fontSize: '12px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', width: '36%', letterSpacing: '0.05em' }}>
                        Track Name
                      </th>
                      <th style={{ padding: '14px 24px', fontSize: '12px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', width: '36%', letterSpacing: '0.05em' }}>
                        Assigned Vehicle
                      </th>
                      <th style={{ padding: '14px 20px', fontSize: '12px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', width: '10%', textAlign: 'center', letterSpacing: '0.05em' }}>
                        Status
                      </th>
                      <th style={{ padding: '14px 20px', fontSize: '12px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', width: '10%', textAlign: 'center', letterSpacing: '0.05em' }}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tracks.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '44px 20px', textAlign: 'center', fontSize: '14px', color: '#64748b', fontWeight: 500 }}>
                          No Organization Tracks found. Switch back and click "Submit" to configure your first track.
                        </td>
                      </tr>
                    ) : (
                      tracks.map((t, idx) => {
                        const vehMatch = vehicles.find(v => v.id === (t.vehicle_id || t.vehicle?.id));
                        const vehDisplay = vehMatch
                          ? `${vehMatch.name} ${vehMatch.plate ? `(${vehMatch.plate})` : ''}`
                          : (t.vehicle?.name || t.vehicle_id || 'All Fleet');

                        return (
                          <tr
                            key={t.id || idx}
                            style={{
                              background: idx % 2 === 1 ? '#F8FAFC' : '#ffffff',
                              borderBottom: '1px solid #F1F5F9',
                              transition: 'background 0.15s ease'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#FFF7ED'}
                            onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 1 ? '#F8FAFC' : '#ffffff'}
                          >
                            <td style={{ padding: '14px 20px', textAlign: 'center', fontSize: '13.5px', fontWeight: 600, color: '#475569' }}>
                              {idx + 1}
                            </td>
                            <td style={{ padding: '14px 24px', fontSize: '13.5px', fontWeight: 700, color: '#111827' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '7px',
                                  background: '#FFF7ED',
                                  color: '#F97316',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  border: '1px solid #FED7AA',
                                  flexShrink: 0
                                }}>
                                  <MapPin size={15} />
                                </div>
                                <span>{t.name}</span>
                              </div>
                            </td>
                            <td style={{ padding: '14px 24px', fontSize: '13.5px', color: '#334155', fontWeight: 600 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Truck size={15} color="#64748b" />
                                <span>{vehDisplay}</span>
                              </div>
                            </td>
                            <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                              <span style={{
                                fontSize: '12px',
                                fontWeight: 600,
                                padding: '3px 10px',
                                borderRadius: '12px',
                                background: '#fff7ed',
                                color: '#ea580c',
                                border: '1px solid #fed7aa'
                              }}>
                                Active
                              </span>
                            </td>
                            <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleDeleteTrack(t.id)}
                                title="Delete Track"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  padding: '5px',
                                  borderRadius: '6px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'background 0.15s ease'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
