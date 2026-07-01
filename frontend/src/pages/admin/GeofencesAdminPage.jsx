import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Trash2, ShieldAlert, Loader2, Navigation, CheckSquare, Square } from 'lucide-react';
import axiosInstance from '../../api/axios';
import { getVehicles } from '../../api/vehicleApi';

const GeofencesAdminPage = () => {
  const [activeTab, setActiveTab] = useState('geofences');
  const [vehicles, setVehicles] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState('geofence'); // 'geofence' or 'route'
  const [modalError, setModalError] = useState('');

  // Geofence Form State
  const [geoName, setGeoName] = useState('');
  const [geoType, setGeoType] = useState('circle');
  const [geoLat, setGeoLat] = useState('17.207174');
  const [geoLng, setGeoLng] = useState('78.314323');
  const [geoRadius, setGeoRadius] = useState('100');
  const [geoCoords, setGeoCoords] = useState('[{"lat":17.207174,"lng":78.314323},{"lat":17.208174,"lng":78.315323},{"lat":17.209174,"lng":78.314323}]');
  const [selectedVehicles, setSelectedVehicles] = useState([]);

  // Route Form State
  const [routeName, setRouteName] = useState('');
  const [routeTolerance, setRouteTolerance] = useState('100');
  const [routeCoords, setRouteCoords] = useState('[{"lat":17.207174,"lng":78.314323},{"lat":17.208174,"lng":78.315323},{"lat":17.209174,"lng":78.316323}]');

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Vehicles
      const vehRes = await getVehicles();
      if (vehRes.success) setVehicles(vehRes.data || []);

      // 2. Fetch Geofences
      const geoRes = await axiosInstance.get('/api/admin/geofences');
      if (geoRes.data.success) setGeofences(geoRes.data.data || []);

      // 3. Fetch Routes
      const routeRes = await axiosInstance.get('/api/admin/routes');
      if (routeRes.data.success) setRoutes(routeRes.data.data || []);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
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

  const handleDeleteRoute = async (id) => {
    if (!window.confirm('Are you sure you want to delete this route?')) return;
    try {
      await axiosInstance.delete(`/api/admin/routes/${id}`);
      fetchData();
    } catch (err) {
      alert('Failed to delete route');
    }
  };

  const handleOpenModal = (type) => {
    setModalType(type);
    setModalError('');
    setSelectedVehicles([]);
    if (type === 'geofence') {
      setGeoName('');
      setGeoType('circle');
      setGeoLat('17.207174');
      setGeoLng('78.314323');
      setGeoRadius('100');
    } else {
      setRouteName('');
      setRouteTolerance('100');
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
      if (modalType === 'geofence') {
        if (!geoName) return setModalError('Geofence name is required.');
        let parsedCoords = [];
        if (geoType === 'polygon') {
          try {
            parsedCoords = JSON.parse(geoCoords);
          } catch(e) {
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

        const res = await axiosInstance.post('/api/admin/geofences', payload);
        if (res.data.success && selectedVehicles.length > 0) {
          const newId = res.data.data.id;
          await axiosInstance.post(`/api/admin/geofences/${newId}/assign`, { vehicleIds: selectedVehicles });
        }
      } else {
        if (!routeName) return setModalError('Route name is required.');
        let parsedCoords = [];
        try {
          parsedCoords = JSON.parse(routeCoords);
        } catch(e) {
          return setModalError('Invalid route coordinates format. Must be JSON array of points.');
        }

        const payload = {
          name: routeName,
          coordinates: parsedCoords,
          tolerance: parseInt(routeTolerance)
        };

        const res = await axiosInstance.post('/api/admin/routes', payload);
        if (res.data.success && selectedVehicles.length > 0) {
          const newId = res.data.data.id;
          await axiosInstance.post(`/api/admin/routes/${newId}/assign`, { vehicleIds: selectedVehicles });
        }
      }

      setModalOpen(false);
      fetchData();
    } catch (err) {
      setModalError(err.response?.data?.error || 'Failed to save configuration');
    }
  };

  return (
    <div style={{ padding: '32px', background: 'linear-gradient(to bottom, #f5efe4 0%, #f5efe4 50%, #f5efe4 50%, #f5efe4 100%)', minHeight: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      
      {/* Header */}
 
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em' }}>Geofence & Route Settings</h1>
          <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>Define virtual boundaries and paths to trigger route-deviation and boundary alerts.</p>
        </div>
        <button
          onClick={() => handleOpenModal(activeTab === 'geofences' ? 'geofence' : 'route')}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: '#8ba0b5', color: '#FFFFFF',
            padding: '10px 20px', borderRadius: '10px',
            fontSize: '14px', fontWeight: 600, border: 'none',
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(139,160,181,0.2)',
            transition: 'all 0.2s ease'
          }}
        >
          <Plus size={18} />
          <span>New {activeTab === 'geofences' ? 'Geofence' : 'Route'}</span>
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', borderBottom: '1px solid #dfd0bf', paddingBottom: '8px' }}>
        <button
          onClick={() => setActiveTab('geofences')}
          style={{
            padding: '8px 16px', background: 'none', border: 'none',
            fontSize: '15px', fontWeight: activeTab === 'geofences' ? 700 : 500,
            color: activeTab === 'geofences' ? '#8ba0b5' : '#64748B',
            borderBottom: activeTab === 'geofences' ? '3px solid #8ba0b5' : 'none',
            cursor: 'pointer'
          }}
        >
          Geofences (Virtual Boundaries)
        </button>
        <button
          onClick={() => setActiveTab('routes')}
          style={{
            padding: '8px 16px', background: 'none', border: 'none',
            fontSize: '15px', fontWeight: activeTab === 'routes' ? 700 : 500,
            color: activeTab === 'routes' ? '#8ba0b5' : '#64748B',
            borderBottom: activeTab === 'routes' ? '3px solid #8ba0b5' : 'none',
            cursor: 'pointer'
          }}
        >
          Routes (Path Tolerances)
        </button>
      </div>

      {/* Roster lists */}
      <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', flex: 1, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px' }}>
            <Loader2 size={32} color="#8ba0b5" className="animate-spin" />
            <span style={{ fontSize: '14px', color: '#6B7280', marginTop: '12px' }}>Loading configurations...</span>
          </div>
        ) : (
          <div>
            {activeTab === 'geofences' ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f5efe4', borderBottom: '1px solid #E2E8F0' }}>
                      {['Name', 'Type', 'Center Coords / Boundary Count', 'Radius', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {geofences.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: '#6B7280' }}>No geofences created yet. Click "New Geofence" to add one.</td>
                      </tr>
                    ) : geofences.map(geo => (
                      <tr key={geo.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '16px 20px', fontWeight: 700, color: '#111827' }}>{geo.name}</td>
                        <td style={{ padding: '16px 20px', textTransform: 'capitalize', color: '#475569' }}>{geo.type}</td>
                        <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>
                          {geo.type === 'circle' ? `${geo.center_lat}, ${geo.center_lng}` : `${geo.coordinates?.length || 0} polygon coordinates`}
                        </td>
                        <td style={{ padding: '16px 20px', color: '#475569' }}>{geo.type === 'circle' ? `${geo.radius} meters` : '—'}</td>
                        <td style={{ padding: '16px 20px' }}>
                          <button onClick={() => handleDeleteGeofence(geo.id)} style={{ padding: '6px', background: '#FEF2F2', border: 'none', borderRadius: '6px', color: '#EF4444', cursor: 'pointer' }}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f5efe4', borderBottom: '1px solid #E2E8F0' }}>
                      {['Name', 'Checkpoints Count', 'Allowed Tolerance', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {routes.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: '#6B7280' }}>No routes created yet. Click "New Route" to add one.</td>
                      </tr>
                    ) : routes.map(route => (
                      <tr key={route.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '16px 20px', fontWeight: 700, color: '#111827' }}>{route.name}</td>
                        <td style={{ padding: '16px 20px', color: '#475569' }}>{route.coordinates?.length || 0} path points</td>
                        <td style={{ padding: '16px 20px', color: '#475569' }}>{route.tolerance} meters</td>
                        <td style={{ padding: '16px 20px' }}>
                          <button onClick={() => handleDeleteRoute(route.id)} style={{ padding: '6px', background: '#FEF2F2', border: 'none', borderRadius: '6px', color: '#EF4444', cursor: 'pointer' }}>
                            <Trash2 size={16} />
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
      </div>

      {/* Creation Modal */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(17,24,39,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '20px', width: '100%', maxWidth: '650px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 sm:px-6 border-b border-slate-200">
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#111827' }}>
                {modalType === 'geofence' ? 'Create New Geofence' : 'Create New Predefined Route'}
              </h2>
              <button onClick={() => setModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '16px', fontWeight: 700 }}>X</button>
            </div>

            <form onSubmit={handleSubmit} style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {modalError && (
                <div style={{ padding: '12px', background: '#FEF2F2', color: '#DC2626', borderRadius: '8px', fontSize: '13px', fontWeight: 500 }}>
                  {modalError}
                </div>
              )}

              {modalType === 'geofence' ? (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Geofence Name</label>
                    <input type="text" placeholder="e.g. Warehouse 1 Boundary" value={geoName} onChange={e => setGeoName(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', boxSizing: 'border-box' }} />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Geofence Type</label>
                    <select value={geoType} onChange={e => setGeoType(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', background: '#FFFFFF', boxSizing: 'border-box' }}>
                      <option value="circle">Circular Boundary (Center + Radius)</option>
                      <option value="polygon">Polygon Boundary (Vertices List)</option>
                    </select>
                  </div>

                  {geoType === 'circle' ? (
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Center Latitude</label>
                        <input type="text" value={geoLat} onChange={e => setGeoLat(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', boxSizing: 'border-box' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Center Longitude</label>
                        <input type="text" value={geoLng} onChange={e => setGeoLng(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', boxSizing: 'border-box' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Radius (meters)</label>
                        <input type="number" value={geoRadius} onChange={e => setGeoRadius(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Polygon Coordinates (JSON Array)</label>
                      <textarea value={geoCoords} onChange={e => setGeoCoords(e.target.value)} rows="3" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', fontFamily: 'monospace', boxSizing: 'border-box' }} />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Route Name</label>
                    <input type="text" placeholder="e.g. Delivery Route A" value={routeName} onChange={e => setRouteName(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', boxSizing: 'border-box' }} />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Allowed Tolerance (meters)</label>
                    <input type="number" value={routeTolerance} onChange={e => setRouteTolerance(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', boxSizing: 'border-box' }} />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Route Checkpoints Path (JSON Array)</label>
                    <textarea value={routeCoords} onChange={e => setRouteCoords(e.target.value)} rows="4" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', fontFamily: 'monospace', boxSizing: 'border-box' }} />
                  </div>
                </>
              )}

              {/* Vehicle Assignment checkboxes */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Assign to Vehicles</label>
                <div style={{ border: '1px solid #CBD5E1', borderRadius: '8px', padding: '12px', maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {vehicles.length === 0 ? (
                    <div style={{ fontSize: '13px', color: '#94A3B8' }}>No vehicles registered.</div>
                  ) : vehicles.map(v => {
                    const isChecked = selectedVehicles.includes(v.id);
                    return (
                      <div
                        key={v.id}
                        onClick={() => toggleVehicleSelection(v.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', color: '#475569', padding: '6px 8px', borderRadius: '6px', transition: 'background 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        {isChecked ? (
                          <CheckSquare size={16} color="#8ba0b5" />
                        ) : (
                          <Square size={16} color="#94A3B8" />
                        )}
                        <span>{v.name} ({v.plate})</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Form Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={() => setModalOpen(false)} style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: '#64748B', background: 'transparent', border: '1px solid #CBD5E1', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: '#FFFFFF', background: '#8ba0b5', border: 'none', cursor: 'pointer' }}>Save Settings</button>
              </div>
            </form>
          </div>

        </div>
      )}
    </div>
  );
};

export default GeofencesAdminPage;
