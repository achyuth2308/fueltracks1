import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MapPin, Plus, Trash2, ShieldAlert, Loader2, CheckSquare, Square, Truck, Shield, BarChart2 } from 'lucide-react';
import axiosInstance from '../../api/axios';
import { getVehicles } from '../../api/vehicleApi';
import VehicleGeofenceManager from '../../components/geofence/VehicleGeofenceManager';
import { MapContainer, TileLayer, Circle, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet default icon issues
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

const MapClickHandler = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng);
    },
  });
  return null;
};

const MapUpdater = ({ lat, lng }) => {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) {
      map.flyTo([lat, lng], map.getZoom(), { animate: true, duration: 0.5 });
    }
  }, [lat, lng, map]);
  return null;
};

const ResizeMap = () => {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      if (map && map.getContainer()) {
        try {
          map.invalidateSize();
        } catch (e) {
          console.warn('Map resize adjustment failed:', e.message);
        }
      }
    });
    const container = map.getContainer();
    if (container) {
      observer.observe(container);
    }
    const timer = setTimeout(() => {
      if (map && map.getContainer()) {
        try {
          map.invalidateSize();
        } catch (e) {
          // ignore
        }
      }
    }, 200);

    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [map]);
  return null;
};

const GeofencesAdminPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('vehicle_geofences');
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [geofences, setGeofences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalError, setModalError] = useState('');
  const [editId, setEditId] = useState(null);

  // Geofence Form State
  const [geoName, setGeoName] = useState('');
  const [geoType, setGeoType] = useState('circle');
  const [geoLat, setGeoLat] = useState('17.207174');
  const [geoLng, setGeoLng] = useState('78.314323');
  const [geoRadius, setGeoRadius] = useState('100');
  const [geoCoords, setGeoCoords] = useState('[{"lat":17.207174,"lng":78.314323},{"lat":17.208174,"lng":78.315323},{"lat":17.209174,"lng":78.314323}]');
  const [selectedVehicles, setSelectedVehicles] = useState([]);

  // Address search
  const [addressQuery, setAddressQuery] = useState('');
  const [addressResults, setAddressResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Vehicles
      const vehRes = await getVehicles();
      if (vehRes.success) {
        const vList = vehRes.data || [];
        setVehicles(vList);
        if (vList.length > 0 && !selectedVehicleId) {
          setSelectedVehicleId(vList[0].id);
        }
      }

      // 2. Fetch Geofences
      const geoRes = await axiosInstance.get('/api/admin/geofences');
      if (geoRes.data.success) setGeofences(geoRes.data.data || []);
    } catch (err) {
      console.error('Error fetching admin geofences data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (addressQuery.length > 3) {
        setIsSearching(true);
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressQuery)}&limit=5&countrycodes=in`);
          const data = await res.json();
          setAddressResults(data || []);
        } catch (err) {
          console.error('Address search error:', err);
        } finally {
          setIsSearching(false);
        }
      } else {
        setAddressResults([]);
      }
    }, 600);

    return () => clearTimeout(delayDebounceFn);
  }, [addressQuery]);

  const handleSelectAddress = (result) => {
    setGeoLat(result.lat);
    setGeoLng(result.lon);
    setAddressQuery(result.display_name);
    setAddressResults([]);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeleteGeofence = async (id) => {
    if (!window.confirm('Are you sure you want to delete this geofence?')) return;
    try {
      await axiosInstance.delete(`/api/admin/geofences/${id}`);
      fetchData();
    } catch (err) {
      alert('Failed to delete geofence');
    }
  };

  const handleOpenModal = (editItem = null) => {
    setModalError('');
    setEditId(editItem ? editItem.id : null);

    if (editItem) {
      setGeoName(editItem.name || '');
      setGeoType(editItem.type || 'circle');
      setGeoLat(editItem.center_lat ? String(editItem.center_lat) : '17.207174');
      setGeoLng(editItem.center_lng ? String(editItem.center_lng) : '78.314323');
      setGeoRadius(editItem.radius ? String(editItem.radius) : '100');
      setGeoCoords(editItem.coordinates ? JSON.stringify(editItem.coordinates) : '[]');
      setSelectedVehicles([]);
    } else {
      setGeoName('');
      setGeoType('circle');
      setGeoLat('17.207174');
      setGeoLng('78.314323');
      setGeoRadius('100');
      setGeoCoords('[{"lat":17.207174,"lng":78.314323},{"lat":17.208174,"lng":78.315323},{"lat":17.209174,"lng":78.314323}]');
      setSelectedVehicles([]);
    }
    setModalOpen(true);
  };

  const toggleVehicleSelection = (vId) => {
    if (selectedVehicles.includes(vId)) {
      setSelectedVehicles(selectedVehicles.filter(id => id !== vId));
    } else {
      setSelectedVehicles([...selectedVehicles, vId]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError('');

    try {
      if (!geoName) return setModalError('Geofence name is required.');
      let parsedCoords = [];
      if (geoType === 'polygon') {
        try {
          parsedCoords = JSON.parse(geoCoords);
        } catch (e) {
          return setModalError('Invalid polygon coordinates format. Must be JSON array of points.');
        }
      }

      const payload = {
        name: geoName,
        type: geoType,
        coordinates: parsedCoords,
        radius: geoType === 'circle' ? parseFloat(geoRadius) : null,
        center_lat: geoType === 'circle' ? parseFloat(geoLat) : null,
        center_lng: geoType === 'circle' ? parseFloat(geoLng) : null
      };

      let res;
      if (editId) {
        res = await axiosInstance.put(`/api/admin/geofences/${editId}`, payload);
      } else {
        res = await axiosInstance.post('/api/admin/geofences', payload);
      }

      if (res.data.success && selectedVehicles.length > 0) {
        const newId = editId || res.data.data.id;
        await axiosInstance.post(`/api/admin/geofences/${newId}/assign`, { vehicleIds: selectedVehicles });
      }

      setModalOpen(false);
      fetchData();
    } catch (err) {
      setModalError(err.response?.data?.error || 'Failed to save geofence');
    }
  };

  return (
    <div style={{ padding: '24px 28px', background: '#F8FAFC', minHeight: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 shrink-0">
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>
            Geofence Management
          </h1>
          <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px', margin: 0 }}>
            Configure real-time virtual perimeters, safe zones, and vehicle entry/exit alerts.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => navigate('/admin/reports/geofence-transit')}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: '#FFFFFF', color: '#0284C7',
              padding: '9px 16px', borderRadius: '10px',
              fontSize: '13px', fontWeight: 700, border: '1px solid #BAE6FD',
              cursor: 'pointer', boxShadow: '0 2px 6px rgba(2, 132, 199, 0.08)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#F0F9FF')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
          >
            <BarChart2 size={16} color="#0284C7" />
            <span>Transit Reports</span>
          </button>

          <button
            onClick={() => handleOpenModal()}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: '#0284C7', color: '#FFFFFF',
              padding: '9px 18px', borderRadius: '10px',
              fontSize: '13px', fontWeight: 700, border: 'none',
              cursor: 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#0369A1')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#0284C7')}
          >
            <Plus size={16} />
            <span>New Geofence</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: '#E2E8F0', padding: '4px', borderRadius: '12px', width: 'fit-content' }}>
        <button
          onClick={() => setActiveTab('vehicle_geofences')}
          style={{
            padding: '8px 16px', background: activeTab === 'vehicle_geofences' ? '#FFFFFF' : 'transparent', border: 'none',
            borderRadius: '8px',
            fontSize: '13px', fontWeight: activeTab === 'vehicle_geofences' ? 700 : 500,
            color: activeTab === 'vehicle_geofences' ? '#0F172A' : '#64748B',
            boxShadow: activeTab === 'vehicle_geofences' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          <Truck size={15} color={activeTab === 'vehicle_geofences' ? '#0284C7' : '#64748B'} />
          <span>Per-Vehicle Geofences</span>
        </button>
        <button
          onClick={() => setActiveTab('geofences')}
          style={{
            padding: '8px 16px', background: activeTab === 'geofences' ? '#FFFFFF' : 'transparent', border: 'none',
            borderRadius: '8px',
            fontSize: '13px', fontWeight: activeTab === 'geofences' ? 700 : 500,
            color: activeTab === 'geofences' ? '#0F172A' : '#64748B',
            boxShadow: activeTab === 'geofences' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          <Shield size={15} color={activeTab === 'geofences' ? '#0284C7' : '#64748B'} />
          <span>Organization Geofences</span>
        </button>
      </div>

      {activeTab === 'vehicle_geofences' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Vehicle Selector Bar */}
          <div style={{ background: '#FFFFFF', padding: '14px 20px', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '280px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>
                Select Vehicle:
              </div>
              <select
                value={selectedVehicleId}
                onChange={e => setSelectedVehicleId(e.target.value)}
                style={{
                  padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1',
                  fontSize: '13px', fontWeight: 600, color: '#0F172A', background: '#F8FAFC',
                  maxWidth: '420px', width: '100%', cursor: 'pointer'
                }}
              >
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.plate || 'No Plate'}) {v.imei ? `— IMEI: ${v.imei}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {(() => {
              const currentV = vehicles.find(v => v.id === selectedVehicleId) || vehicles[0];
              if (!currentV) return null;
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#64748B' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: currentV.status === 'online' ? '#10B981' : '#94A3B8' }} />
                    <b style={{ color: '#0F172A' }}>{currentV.status ? currentV.status.toUpperCase() : 'UNKNOWN'}</b>
                  </span>
                  <span>•</span>
                  <span>Speed: <b style={{ color: '#0F172A' }}>{Number(currentV.speed || 0).toFixed(0)} km/h</b></span>
                  <span>•</span>
                  <span>Location: <b style={{ color: '#0F172A' }}>{Number(currentV.lat || 0).toFixed(4)}, {Number(currentV.lng || 0).toFixed(4)}</b></span>
                </div>
              );
            })()}
          </div>

          {/* Embedded VehicleGeofenceManager */}
          {selectedVehicleId ? (
            <VehicleGeofenceManager
              vehicleId={selectedVehicleId}
              vehicle={vehicles.find(v => v.id === selectedVehicleId) || vehicles[0]}
            />
          ) : (
            <div style={{ background: '#FFFFFF', padding: '40px', borderRadius: '12px', border: '1px solid #E2E8F0', textAlign: 'center', color: '#64748B' }}>
              No vehicles available. Register a vehicle first to manage geofences.
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '240px' }}>
              <Loader2 className="animate-spin" size={24} color="#0284C7" />
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f5efe4', borderBottom: '1px solid #E2E8F0' }}>
                    {['Name', 'Type', 'Coordinates / Center', 'Radius', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {geofences.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#6B7280', fontSize: '13px' }}>No organization geofences found. Click "New Geofence" to create one.</td>
                    </tr>
                  ) : geofences.map(geo => (
                    <tr key={geo.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#111827', fontSize: '13px' }}>{geo.name}</td>
                      <td style={{ padding: '12px 16px', textTransform: 'capitalize', color: '#475569', fontSize: '13px' }}>{geo.type}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#475569' }}>
                        {geo.type === 'circle' ? `${geo.center_lat}, ${geo.center_lng}` : `${geo.coordinates?.length || 0} polygon coordinates`}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#475569', fontSize: '13px' }}>{geo.type === 'circle' ? `${geo.radius} meters` : '—'}</td>
                      <td style={{ padding: '12px 16px', display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleOpenModal(geo)} style={{ padding: '4px 10px', background: '#F0F9FF', border: 'none', borderRadius: '6px', color: '#0284C7', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                          Edit
                        </button>
                        <button onClick={() => handleDeleteGeofence(geo.id)} style={{ padding: '4px 8px', background: '#FEF2F2', border: 'none', borderRadius: '6px', color: '#EF4444', cursor: 'pointer' }}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Creation Modal for Org Geofence */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(17,24,39,0.4)', backdropFilter: 'blur(4px)', overflowY: 'auto', padding: '40px 16px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '20px', width: '100%', maxWidth: geoType === 'circle' ? '900px' : '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 sm:px-6 border-b border-slate-200" style={{ flexShrink: 0 }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#111827' }}>
                {editId ? 'Edit Geofence' : 'Create New Geofence'}
              </h2>
              <button type="button" onClick={() => setModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '16px', fontWeight: 700 }}>✕</button>
            </div>
            <form onSubmit={handleSubmit} style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {modalError && (
                <div style={{ padding: '12px', background: '#FEF2F2', color: '#DC2626', borderRadius: '8px', fontSize: '13px', fontWeight: 500 }}>
                  {modalError}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: geoType === 'circle' ? 'minmax(0, 1fr) minmax(0, 1fr)' : '1fr', gap: '32px', alignItems: 'stretch' }}>
                {/* Left Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Geofence Name</label>
                    <input type="text" placeholder="e.g. Warehouse 1 Boundary" value={geoName} onChange={e => setGeoName(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', color: '#111827', boxSizing: 'border-box' }} />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Geofence Type</label>
                    <select value={geoType} onChange={e => setGeoType(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', color: '#111827', background: '#FFFFFF', boxSizing: 'border-box' }}>
                      <option value="circle">Circular Boundary (Center + Radius)</option>
                      <option value="polygon">Polygon Boundary (Vertices List)</option>
                    </select>
                  </div>

                  {geoType === 'circle' ? (
                    <>
                      <div style={{ position: 'relative' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Search Address / Landmark</label>
                        <input 
                          type="text" 
                          placeholder="Type an address to automatically fill coordinates..." 
                          value={addressQuery} 
                          onChange={(e) => setAddressQuery(e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', color: '#111827', boxSizing: 'border-box' }}
                        />
                        {isSearching && (
                          <div style={{ position: 'absolute', right: 12, top: 38 }}>
                            <Loader2 className="animate-spin" size={16} color="#64748B" />
                          </div>
                        )}
                        {addressResults.length > 0 && (
                          <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', zIndex: 1000, marginTop: '4px', maxHeight: '180px', overflowY: 'auto' }}>
                            {addressResults.map((r, i) => (
                              <div
                                key={i}
                                onClick={() => handleSelectAddress(r)}
                                style={{ padding: '8px 12px', fontSize: '12px', color: '#334155', borderBottom: '1px solid #F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                onMouseEnter={(e) => e.target.style.background = '#F8FAFC'}
                                onMouseLeave={(e) => e.target.style.background = '#FFFFFF'}
                              >
                                <MapPin size={12} color="#0284C7" className="shrink-0" />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.display_name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Center Latitude</label>
                          <input type="text" value={geoLat} onChange={e => setGeoLat(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', color: '#111827', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Center Longitude</label>
                          <input type="text" value={geoLng} onChange={e => setGeoLng(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', color: '#111827', boxSizing: 'border-box' }} />
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Radius (meters)</label>
                        <input type="number" value={geoRadius} onChange={e => setGeoRadius(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', color: '#111827', boxSizing: 'border-box' }} />
                      </div>
                    </>
                  ) : (
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Polygon Coordinates (JSON Array)</label>
                      <textarea value={geoCoords} onChange={e => setGeoCoords(e.target.value)} rows="5" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', color: '#111827', fontFamily: 'monospace', boxSizing: 'border-box' }} />
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Assign to Vehicles</label>
                    <div style={{ border: '1px solid #CBD5E1', borderRadius: '8px', padding: '10px', maxHeight: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', background: '#F8FAFC' }}>
                      {vehicles.length === 0 ? (
                        <div style={{ fontSize: '13px', color: '#94A3B8', padding: '4px' }}>No vehicles registered.</div>
                      ) : vehicles.map(v => {
                        const isChecked = selectedVehicles.includes(v.id);
                        return (
                          <div
                            key={v.id}
                            onClick={() => toggleVehicleSelection(v.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', color: '#475569', padding: '6px 8px', borderRadius: '6px', transition: 'background 0.2s', background: isChecked ? '#E0F2FE' : 'transparent' }}
                          >
                            {isChecked ? <CheckSquare size={16} color="#0284C7" /> : <Square size={16} color="#94A3B8" />}
                            <span style={{ fontWeight: isChecked ? 600 : 400, color: isChecked ? '#0369A1' : '#475569' }}>{v.name} ({v.plate})</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Column: Map Preview */}
                {geoType === 'circle' && (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '350px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Interactive Map Preview</label>
                    <div style={{ flex: 1, width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid #CBD5E1', position: 'relative', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
                      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 400, background: 'rgba(255,255,255,0.95)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, color: '#0F172A', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', pointerEvents: 'none', border: '1px solid #E2E8F0' }}>
                        📍 Click map to drop pin
                      </div>
                      <MapContainer key={location.pathname} center={[parseFloat(geoLat) || 17.207174, parseFloat(geoLng) || 78.314323]} zoom={15} style={{ height: '100%', width: '100%' }}>
                        <ResizeMap />
                        <TileLayer 
                          attribution='&copy; OpenStreetMap'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
                        />
                        <MapClickHandler onMapClick={(latlng) => { setGeoLat(latlng.lat.toFixed(6)); setGeoLng(latlng.lng.toFixed(6)); }} />
                        <MapUpdater lat={parseFloat(geoLat)} lng={parseFloat(geoLng)} />
                        {geoLat && geoLng && (
                          <>
                            <Marker position={[parseFloat(geoLat), parseFloat(geoLng)]} />
                            <Circle center={[parseFloat(geoLat), parseFloat(geoLng)]} radius={parseFloat(geoRadius) || 100} pathOptions={{ color: '#0EA5E9', fillColor: '#0EA5E9', fillOpacity: 0.2, weight: 2 }} />
                          </>
                        )}
                      </MapContainer>
                    </div>
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #E2E8F0' }}>
                <button type="button" onClick={() => setModalOpen(false)} style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: '#64748B', background: 'transparent', border: '1px solid #CBD5E1', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: '#FFFFFF', background: '#0284C7', border: 'none', cursor: 'pointer' }}>Save Geofence</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeofencesAdminPage;
