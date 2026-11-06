import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Navigation, ArrowLeft, Plus, Trash2, Edit3, Search, Truck, AlertCircle,
  Loader2, CheckSquare, Square, Undo2, MapPin, Check, ArrowRight
} from 'lucide-react';
import { MapContainer, TileLayer, Polyline, Marker, useMapEvents, useMap, Tooltip, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axiosInstance from '../../api/axios';
import { getVehicles } from '../../api/vehicleApi';
import { calculateHaversineDistanceMeters, formatRadius } from '../../utils/geofenceUtils';

// Numbered Waypoint Marker
const createWaypointIcon = (index, total, isStart, isEnd) => {
  let bg = '#0284C7';
  let label = String(index + 1);

  if (isStart) {
    bg = '#10B981';
    label = '🟢 ' + (index + 1);
  } else if (isEnd) {
    bg = '#EF4444';
    label = '🏁 ' + (index + 1);
  }

  return L.divIcon({
    className: 'route-waypoint-icon',
    html: `
      <div style="
        background: ${bg};
        color: #FFFFFF;
        font-weight: 800;
        font-size: 11px;
        padding: 3px 8px;
        border-radius: 12px;
        border: 2px solid #FFFFFF;
        box-shadow: 0 3px 8px rgba(0,0,0,0.3);
        white-space: nowrap;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      ">${label}</div>
    `,
    iconSize: [44, 24],
    iconAnchor: [22, 12],
  });
};

const MapClickInterceptor = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng);
    },
  });
  return null;
};

const MapController = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center && center.lat && center.lng) {
      map.flyTo([center.lat, center.lng], map.getZoom(), { animate: true, duration: 0.5 });
    }
  }, [center, map]);
  return null;
};

const ResizeMap = () => {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      if (map && map.getContainer()) {
        try {
          map.invalidateSize();
        } catch (_) {}
      }
    });
    const container = map.getContainer();
    if (container) observer.observe(container);
    const timer = setTimeout(() => {
      if (map && map.getContainer()) {
        try {
          map.invalidateSize();
        } catch (_) {}
      }
    }, 200);

    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [map]);
  return null;
};

const RoutesAdminPage = () => {
  const navigate = useNavigate();
  const [routes, setRoutes] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Editor Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalError, setModalError] = useState('');
  const [editId, setEditId] = useState(null);
  const [routeName, setRouteName] = useState('');
  const [direction, setDirection] = useState('two_way'); // 'two_way' | 'one_way'
  const [tolerance, setTolerance] = useState(100); // corridor buffer in meters
  const [waypoints, setWaypoints] = useState([]); // [{lat, lng}]
  const [selectedVehicles, setSelectedVehicles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search State for Map
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [mapCenter, setMapCenter] = useState({ lat: 17.385044, lng: 78.486671 });

  // Vehicle Assignment Quick Modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assigningRoute, setAssigningRoute] = useState(null);
  const [assignVehicleIds, setAssignVehicleIds] = useState([]);
  const [isSavingAssign, setIsSavingAssign] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vehRes, routeRes] = await Promise.all([
        getVehicles(),
        axiosInstance.get('/api/admin/routes'),
      ]);

      if (vehRes.success) setVehicles(vehRes.data || []);
      if (routeRes.data?.success) setRoutes(routeRes.data.data || []);
    } catch (err) {
      console.error('Error fetching routes or vehicles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Debounced Place Search
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      if (trimmed.length > 2) {
        setIsSearching(true);
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
              trimmed
            )}&limit=5&countrycodes=in`
          );
          const data = await res.json();
          setSearchResults(data || []);
        } catch (_) {
        } finally {
          setIsSearching(false);
        }
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectSearchResult = (result) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    if (!isNaN(lat) && !isNaN(lng)) {
      setMapCenter({ lat, lng });
      setWaypoints((prev) => [...prev, { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) }]);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleMapClick = (latlng) => {
    setWaypoints((prev) => [
      ...prev,
      { lat: Number(latlng.lat.toFixed(6)), lng: Number(latlng.lng.toFixed(6)) },
    ]);
  };

  const handleOpenCreateModal = () => {
    setEditId(null);
    setRouteName('');
    setDirection('two_way');
    setTolerance(100);
    setWaypoints([]);
    setSelectedVehicles([]);
    setModalError('');
    if (vehicles.length > 0 && vehicles[0].lat && vehicles[0].lng) {
      setMapCenter({ lat: Number(vehicles[0].lat), lng: Number(vehicles[0].lng) });
    }
    setModalOpen(true);
  };

  const handleOpenEditModal = async (route) => {
    setEditId(route.id);
    setRouteName(route.name || '');
    setDirection(route.direction || 'two_way');
    setTolerance(Number(route.tolerance) || 100);

    const pts = Array.isArray(route.coordinates) ? route.coordinates : [];
    setWaypoints(pts);
    setModalError('');

    if (pts.length > 0) {
      setMapCenter({ lat: pts[0].lat, lng: pts[0].lng });
    }

    // Fetch assigned vehicles for this route
    try {
      const vRes = await axiosInstance.get(`/api/admin/routes/${route.id}/vehicles`);
      if (vRes.data?.success && Array.isArray(vRes.data.data)) {
        setSelectedVehicles(vRes.data.data.map((v) => v.id));
      } else {
        setSelectedVehicles([]);
      }
    } catch (_) {
      setSelectedVehicles([]);
    }

    setModalOpen(true);
  };

  const handleDeleteRoute = async (id) => {
    if (!window.confirm('Are you sure you want to delete this route? Vehicles following it will no longer have deviation alerts.')) return;
    try {
      await axiosInstance.delete(`/api/admin/routes/${id}`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete route.');
    }
  };

  const handleOpenAssignModal = async (route) => {
    setAssigningRoute(route);
    setAssignModalOpen(true);
    try {
      const vRes = await axiosInstance.get(`/api/admin/routes/${route.id}/vehicles`);
      if (vRes.data?.success && Array.isArray(vRes.data.data)) {
        setAssignVehicleIds(vRes.data.data.map((v) => v.id));
      } else {
        setAssignVehicleIds([]);
      }
    } catch (_) {
      setAssignVehicleIds([]);
    }
  };

  const handleSaveVehicleAssignment = async () => {
    if (!assigningRoute) return;
    setIsSavingAssign(true);
    try {
      await axiosInstance.post(`/api/admin/routes/${assigningRoute.id}/assign`, {
        vehicleIds: assignVehicleIds,
      });
      setAssignModalOpen(false);
      setAssigningRoute(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update assigned vehicles.');
    } finally {
      setIsSavingAssign(false);
    }
  };

  // Calculate total path distance
  const totalDistanceMeters = useMemo(() => {
    if (waypoints.length < 2) return 0;
    let dist = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      dist += calculateHaversineDistanceMeters(
        waypoints[i].lat,
        waypoints[i].lng,
        waypoints[i + 1].lat,
        waypoints[i + 1].lng
      );
    }
    return dist;
  }, [waypoints]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError('');

    if (!routeName.trim()) {
      setModalError('Please enter a name for this route.');
      return;
    }

    if (waypoints.length < 2) {
      setModalError('A route requires at least 2 points (Start and Destination). Tap on the map to add checkpoints.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: routeName.trim(),
        tolerance: Number(tolerance) || 100,
        direction,
        coordinates: waypoints,
      };

      let res;
      if (editId) {
        res = await axiosInstance.put(`/api/admin/routes/${editId}`, payload);
      } else {
        res = await axiosInstance.post('/api/admin/routes', payload);
      }

      if (res.data?.success) {
        const routeId = editId || res.data.data?.id;
        if (routeId && selectedVehicles.length >= 0) {
          await axiosInstance.post(`/api/admin/routes/${routeId}/assign`, {
            vehicleIds: selectedVehicles,
          });
        }
        setModalOpen(false);
        fetchData();
      } else {
        setModalError(res.data?.error || 'Failed to save route.');
      }
    } catch (err) {
      setModalError(err.response?.data?.error || 'Failed to save route.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '24px 28px', background: '#F8FAFC', minHeight: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={() => navigate(-1)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                cursor: 'pointer',
                color: '#334155',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                transition: 'all 0.15s ease',
                flexShrink: 0
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#94A3B8'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#CBD5E1'; }}
              title="Go Back"
            >
              <ArrowLeft size={18} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>
                Routes & Transit Corridors
              </h1>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  background: '#E0F2FE',
                  color: '#0284C7',
                  padding: '3px 10px',
                  borderRadius: '99px',
                }}
              >
                {routes.length} Active Route{routes.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px', margin: 0 }}>
            Define designated vehicle transit corridors, allowable GPS deviation tolerance buffers, and sequence checkpoints.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
            color: '#FFFFFF',
            padding: '10px 18px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
            transition: 'all 0.15s ease',
          }}
        >
          <Plus size={16} />
          <span>New Route Corridor</span>
        </button>
      </div>

      {/* Routes List Card */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
        }}
      >
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '240px' }}>
            <Loader2 className="animate-spin" size={24} color="#0284C7" />
          </div>
        ) : routes.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center' }}>
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '16px',
                background: '#F0F9FF',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <Navigation size={28} color="#0284C7" />
            </div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
              No Routes Created Yet
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748B' }}>
              Create predefined paths for your vehicles to monitor route adherence and detect route deviations automatically.
            </p>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              style={{
                background: '#0284C7',
                color: '#FFFFFF',
                border: 'none',
                padding: '9px 18px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              + Create First Route
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  {['Route Name', 'Transit Mode', 'Waypoints / Path', 'Corridor Tolerance', 'Deviation Buffer', 'Actions'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '12px 18px',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#64748B',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {routes.map((route) => {
                  const pts = Array.isArray(route.coordinates) ? route.coordinates : [];
                  let dist = 0;
                  for (let i = 0; i < pts.length - 1; i++) {
                    dist += calculateHaversineDistanceMeters(pts[i].lat, pts[i].lng, pts[i + 1].lat, pts[i + 1].lng);
                  }
                  return (
                    <tr
                      key={route.id}
                      style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.15s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
                    >
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '14px' }}>{route.name}</div>
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                          ID: #{route.id}
                        </div>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 800,
                            background: route.direction === 'one_way' ? '#FEF3C7' : '#EFF6FF',
                            color: route.direction === 'one_way' ? '#B45309' : '#1D4ED8',
                            border: `1px solid ${route.direction === 'one_way' ? '#FCD34D' : '#BFDBFE'}`,
                          }}
                        >
                          <span>{route.direction === 'one_way' ? '➔' : '⇄'}</span>
                          <span>{route.direction === 'one_way' ? 'One-Way' : 'Two-Way (Round-Trip)'}</span>
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              background: '#F1F5F9',
                              color: '#334155',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 700,
                            }}
                          >
                            {pts.length} checkpoint{pts.length === 1 ? '' : 's'}
                          </span>
                          {dist > 0 && (
                            <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>
                              ({formatRadius(dist)})
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            background: '#ECFDF5',
                            color: '#065F46',
                            border: '1px solid #A7F3D0',
                            padding: '3px 9px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 700,
                          }}
                        >
                          ± {route.tolerance || 100} meters
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', color: '#64748B', fontSize: '12px' }}>
                        Triggers alert if vehicle deviates &gt; {route.tolerance || 100}m
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenAssignModal(route)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: '1px solid #BAE6FD',
                              background: '#F0F9FF',
                              color: '#0284C7',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            title="Assign to vehicles"
                          >
                            <Truck size={13} />
                            <span>Vehicles</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(route)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              background: '#FFFFFF',
                              color: '#334155',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Edit3 size={13} />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRoute(route.id)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: '1px solid #FCA5A5',
                              background: '#FEF2F2',
                              color: '#DC2626',
                              cursor: 'pointer',
                            }}
                            title="Delete route"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT ROUTE MODAL */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100050,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '1160px',
              height: 'min(92vh, 840px)',
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.4)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                flexShrink: 0,
                padding: '16px 24px',
                background: '#0F172A',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: '#0284C7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Navigation size={20} color="#FFFFFF" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>
                    {editId ? 'Edit Route Corridor' : 'Create Route Corridor'}
                  </h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>
                    Click sequentially on the map to add checkpoints from start to finish.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{
                  background: '#1E293B',
                  border: '1px solid #334155',
                  color: '#94A3B8',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 800,
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form
              onSubmit={handleSubmit}
              style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}
            >
              {modalError && (
                <div
                  style={{
                    flexShrink: 0,
                    margin: '12px 20px 0 20px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: '#FEF2F2',
                    border: '1px solid #FCA5A5',
                    color: '#DC2626',
                    fontSize: '13px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertCircle size={16} />
                  <span>{modalError}</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                {/* Left Route Config Panel */}
                <div
                  style={{
                    padding: '20px',
                    borderRight: '1px solid #E2E8F0',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    background: '#F8FAFC',
                  }}
                >
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Route Name:
                    </label>
                    <input
                      type="text"
                      value={routeName}
                      onChange={(e) => setRouteName(e.target.value)}
                      placeholder="e.g. Hyderabad Depot to Shamshabad Hub"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#0F172A',
                        background: '#FFFFFF',
                        boxSizing: 'border-box',
                      }}
                      required
                    />
                  </div>

                  {/* Transit Direction Mode: Two-Way vs One-Way */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Transit Direction Mode:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setDirection('two_way')}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: direction === 'two_way' ? '2px solid #0284C7' : '1px solid #CBD5E1',
                          background: direction === 'two_way' ? '#F0F9FF' : '#FFFFFF',
                          color: direction === 'two_way' ? '#0369A1' : '#475569',
                          fontWeight: 800,
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span>⇄</span>
                        <span>Two-Way (Round-Trip)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDirection('one_way')}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: direction === 'one_way' ? '2px solid #0284C7' : '1px solid #CBD5E1',
                          background: direction === 'one_way' ? '#F0F9FF' : '#FFFFFF',
                          color: direction === 'one_way' ? '#0369A1' : '#475569',
                          fontWeight: 800,
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span>➔</span>
                        <span>One-Way Leg</span>
                      </button>
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                      {direction === 'two_way'
                        ? '⇄ Two-Way: Vehicle travels back and forth along the corridor (Outbound & Return).'
                        : '➔ One-Way: Vehicle travels strictly forward from Start to Destination.'}
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase' }}>
                        Deviation Tolerance:
                      </label>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#0284C7', background: '#E0F2FE', padding: '2px 8px', borderRadius: '6px' }}>
                        ± {tolerance} meters
                      </span>
                    </div>
                    <input
                      type="range"
                      min={30}
                      max={1500}
                      step={10}
                      value={tolerance}
                      onChange={(e) => setTolerance(Number(e.target.value))}
                      style={{ width: '100%', accentColor: '#0284C7', cursor: 'pointer' }}
                    />
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                      Vehicles straying more than {tolerance}m off the designated route line trigger a deviation alert.
                    </div>
                  </div>

                  {/* Waypoint Sequence Stats */}
                  <div
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '12px',
                      border: '1px solid #E2E8F0',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A' }}>
                        Route Checkpoints ({waypoints.length})
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#0284C7' }}>
                        {formatRadius(totalDistanceMeters)}
                      </span>
                    </div>

                    <div style={{ fontSize: '11px', color: '#64748B' }}>
                      💡 Click on the map in sequence to set checkpoints along highways or transit corridors.
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '4px' }}>
                      <button
                        type="button"
                        disabled={waypoints.length === 0}
                        onClick={() => setWaypoints((prev) => prev.slice(0, -1))}
                        style={{
                          padding: '6px 8px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          background: '#FFFFFF',
                          color: '#475569',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: waypoints.length === 0 ? 'not-allowed' : 'pointer',
                          opacity: waypoints.length === 0 ? 0.5 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                        }}
                      >
                        <Undo2 size={13} />
                        <span>Undo Point</span>
                      </button>
                      <button
                        type="button"
                        disabled={waypoints.length === 0}
                        onClick={() => setWaypoints([])}
                        style={{
                          padding: '6px 8px',
                          borderRadius: '6px',
                          border: '1px solid #FCA5A5',
                          background: '#FEF2F2',
                          color: '#DC2626',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: waypoints.length === 0 ? 'not-allowed' : 'pointer',
                          opacity: waypoints.length === 0 ? 0.5 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                        }}
                      >
                        <Trash2 size={13} />
                        <span>Clear All</span>
                      </button>
                    </div>
                  </div>

                  {/* Assign to Vehicles Checklist */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Assign Route to Vehicles:
                    </label>
                    <div
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: '10px',
                        padding: '8px',
                        maxHeight: '140px',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      {vehicles.length === 0 ? (
                        <div style={{ fontSize: '12px', color: '#94A3B8', padding: '6px' }}>No vehicles registered.</div>
                      ) : (
                        vehicles.map((v) => {
                          const isChecked = selectedVehicles.includes(v.id);
                          return (
                            <div
                              key={v.id}
                              onClick={() => {
                                if (isChecked) {
                                  setSelectedVehicles(selectedVehicles.filter((id) => id !== v.id));
                                } else {
                                  setSelectedVehicles([...selectedVehicles, v.id]);
                                }
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '6px 8px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                background: isChecked ? '#F0F9FF' : 'transparent',
                                fontSize: '12px',
                              }}
                            >
                              {isChecked ? <CheckSquare size={15} color="#0284C7" /> : <Square size={15} color="#94A3B8" />}
                              <span style={{ fontWeight: isChecked ? 700 : 500, color: isChecked ? '#0369A1' : '#334155' }}>
                                {v.name} ({v.plate || 'No Plate'})
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Interactive Map */}
                <div style={{ position: 'relative', height: '100%', minHeight: 0, flex: 1, overflow: 'hidden' }}>
                  {/* Floating Top Search Bar */}
                  <div style={{ position: 'absolute', top: '12px', left: '12px', right: '12px', zIndex: 1000 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: 'rgba(255,255,255,0.98)',
                        backdropFilter: 'blur(8px)',
                        borderRadius: '10px',
                        padding: '0 12px',
                        border: '1.5px solid #CBD5E1',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        height: '40px',
                      }}
                    >
                      <Search size={16} color="#64748B" style={{ marginRight: '8px' }} />
                      <input
                        type="text"
                        placeholder="Search landmark, warehouse, or city to center map..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          outline: 'none',
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#0F172A',
                          width: '100%',
                        }}
                      />
                      {isSearching && <span style={{ fontSize: '11px', color: '#94A3B8' }}>Searching...</span>}
                    </div>

                    {searchResults.length > 0 && (
                      <div
                        style={{
                          background: '#FFFFFF',
                          borderRadius: '10px',
                          border: '1px solid #CBD5E1',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                          marginTop: '6px',
                          maxHeight: '180px',
                          overflowY: 'auto',
                        }}
                      >
                        {searchResults.map((r, i) => (
                          <div
                            key={i}
                            onClick={() => handleSelectSearchResult(r)}
                            style={{
                              padding: '8px 12px',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: '#1E293B',
                              cursor: 'pointer',
                              borderBottom: i < searchResults.length - 1 ? '1px solid #F1F5F9' : 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#F0F9FF')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
                          >
                            <MapPin size={13} color="#0284C7" />
                            <span>{r.display_name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Leaflet Map */}
                  <MapContainer
                    center={[mapCenter.lat, mapCenter.lng]}
                    zoom={13}
                    style={{ width: '100%', height: '100%' }}
                  >
                    <ResizeMap />
                    <MapController center={mapCenter} />
                    <MapClickInterceptor onMapClick={handleMapClick} />

                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {/* Polyline Path */}
                    {waypoints.length >= 2 && (
                      <>
                        {/* Corridor Outer Deviation Boundary Glow */}
                        <Polyline
                          positions={waypoints.map((p) => [p.lat, p.lng])}
                          pathOptions={{
                            color: '#38BDF8',
                            weight: 12,
                            opacity: 0.35,
                          }}
                        />
                        {/* Solid Route Line */}
                        <Polyline
                          positions={waypoints.map((p) => [p.lat, p.lng])}
                          pathOptions={{
                            color: '#0284C7',
                            weight: 4,
                            opacity: 0.95,
                          }}
                        />
                      </>
                    )}

                    {/* Numbered Waypoint Markers */}
                    {waypoints.map((pt, idx) => (
                      <Marker
                        key={`pt-${idx}`}
                        position={[pt.lat, pt.lng]}
                        icon={createWaypointIcon(
                          idx,
                          waypoints.length,
                          idx === 0,
                          idx === waypoints.length - 1 && waypoints.length > 1
                        )}
                      >
                        <Tooltip permanent direction="top" offset={[0, -12]}>
                          <span style={{ fontSize: '11px', fontWeight: 800 }}>
                            {idx === 0
                              ? '🟢 Start'
                              : idx === waypoints.length - 1
                              ? '🏁 End Destination'
                              : `Point #${idx + 1}`}
                          </span>
                        </Tooltip>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
              </div>

              {/* Modal Bottom Actions */}
              <div
                style={{
                  flexShrink: 0,
                  padding: '12px 24px',
                  borderTop: '1px solid #E2E8F0',
                  background: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ fontSize: '13px', color: '#334155', fontWeight: 600 }}>
                  {waypoints.length === 0 ? (
                    <span style={{ color: '#64748B' }}>Tap on the map to place the starting point.</span>
                  ) : (
                    <span>
                      {waypoints.length} checkpoints • <b>{formatRadius(totalDistanceMeters)}</b> total distance
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    style={{
                      padding: '9px 18px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      color: '#475569',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{
                      padding: '9px 24px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      opacity: isSubmitting ? 0.7 : 1,
                      boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
                    }}
                  >
                    {isSubmitting ? 'Saving Route...' : '✅ Save Route'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK ASSIGN VEHICLES MODAL */}
      {assignModalOpen && assigningRoute && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100060,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '480px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                  Assign Vehicles to Route
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                  Route: <b>{assigningRoute.name}</b>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: '16px', fontWeight: 700, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '16px 20px', maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {vehicles.length === 0 ? (
                <div style={{ color: '#94A3B8', fontSize: '13px' }}>No vehicles registered in system.</div>
              ) : (
                vehicles.map((v) => {
                  const isChecked = assignVehicleIds.includes(v.id);
                  return (
                    <div
                      key={v.id}
                      onClick={() => {
                        if (isChecked) {
                          setAssignVehicleIds(assignVehicleIds.filter((id) => id !== v.id));
                        } else {
                          setAssignVehicleIds([...assignVehicleIds, v.id]);
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: isChecked ? '#F0F9FF' : '#F8FAFC',
                        border: isChecked ? '1px solid #BAE6FD' : '1px solid #E2E8F0',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {isChecked ? <CheckSquare size={16} color="#0284C7" /> : <Square size={16} color="#94A3B8" />}
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{v.name}</div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>{v.plate || 'No Plate'}</div>
                        </div>
                      </div>
                      {isChecked && (
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284C7' }}>ASSIGNED</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div
              style={{
                padding: '14px 20px',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                background: '#F8FAFC',
              }}
            >
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingAssign}
                onClick={handleSaveVehicleAssignment}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#0284C7',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: isSavingAssign ? 'not-allowed' : 'pointer',
                  opacity: isSavingAssign ? 0.7 : 1,
                }}
              >
                {isSavingAssign ? 'Saving...' : 'Save Assignments'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoutesAdminPage;
