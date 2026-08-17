import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Play, Square, Trash2, MapPin, Route, Truck, Clock,
  Gauge, Navigation, Loader2, AlertCircle, CheckCircle, RefreshCw, FileText
} from 'lucide-react';
import { tripApi } from '../../api/tripApi';
import * as vehicleApi from '../../api/vehicleApi';
import axiosInstance from '../../api/axios';
import { formatLocalTime } from '../../utils/dateUtils';

const STATUS_COLORS = {
  planned:     { bg: '#EFF6FF', text: '#2563EB', dot: '#3B82F6' },
  in_progress: { bg: '#ECFDF5', text: '#059669', dot: '#10B981' },
  completed:   { bg: '#F8FAFC', text: '#64748B', dot: '#94A3B8' },
  cancelled:   { bg: '#FEF2F2', text: '#DC2626', dot: '#EF4444' },
};

const formatDuration = (secs) => {
  if (!secs) return '–';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const StatusBadge = ({ status }) => {
  const c = STATUS_COLORS[status] || STATUS_COLORS.planned;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      background: c.bg, color: c.text,
      padding: '3px 10px', borderRadius: '999px',
      fontSize: '12px', fontWeight: 700
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.dot,
        ...(status === 'in_progress' ? { animation: 'pulse 1.5s infinite' } : {}) }} />
      {status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

// ── Create Trip Modal ─────────────────────────────────────────────────────────

const CreateTripModal = ({ vehicles, routes, onClose, onCreate }) => {
  const [form, setForm] = useState({
    vehicleId: vehicles[0]?.id || '',
    name: '',
    origin: '',
    destination: '',
    routeId: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [startNow, setStartNow] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!form.vehicleId || !form.name.trim()) {
      setError('Vehicle and trip name are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const trip = await tripApi.create(form);
      if (startNow) {
        await tripApi.start(trip.id, {});
      }
      onCreate();
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to create trip');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: '8px',
    border: '1px solid #E2E8F0', outline: 'none',
    fontSize: '13px', color: '#0F172A', background: '#FAFAFA',
    boxSizing: 'border-box'
  };
  const labelStyle = { fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '5px', display: 'block' };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
    }}>
      <div style={{
        background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '520px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.18)', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 800, color: '#0F172A' }}>Create New Trip</div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>Track a journey from start to finish</div>
          </div>
          <button onClick={onClose} style={{ background: '#F1F5F9', border: 'none', borderRadius: '8px', width: 32, height: 32, cursor: 'pointer', fontSize: '16px', color: '#64748B' }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', color: '#DC2626', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <AlertCircle size={15} /> {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Vehicle *</label>
              <select value={form.vehicleId} onChange={e => setForm({ ...form, vehicleId: e.target.value })} style={inputStyle}>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} – {v.plate}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Trip Name *</label>
              <input
                placeholder="e.g. Hyderabad → Vijayawada"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}><MapPin size={11} style={{ marginRight: 4 }} />From (Origin)</label>
              <input placeholder="Hyderabad" value={form.origin} onChange={e => setForm({ ...form, origin: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}><Navigation size={11} style={{ marginRight: 4 }} />To (Destination)</label>
              <input placeholder="Vijayawada" value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}><Route size={11} style={{ marginRight: 4 }} />Route (Optional — use a pre-drawn route or skip)</label>
            <select value={form.routeId} onChange={e => setForm({ ...form, routeId: e.target.value })} style={inputStyle}>
              <option value="">No route (track distance only)</option>
              {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
              If a route is linked, deviation alerts will fire if the vehicle goes off-route.
            </div>
          </div>

          <div>
            <label style={labelStyle}>Notes</label>
            <textarea
              placeholder="Optional notes about this trip..."
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          {/* Start Now toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '12px', background: startNow ? '#ECFDF5' : '#F8FAFC', borderRadius: '10px', border: `1px solid ${startNow ? '#BBF7D0' : '#E2E8F0'}`, transition: 'all 0.2s' }}>
            <input type="checkbox" checked={startNow} onChange={e => setStartNow(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#10B981' }} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: startNow ? '#059669' : '#334155' }}>Start trip immediately</div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>Distance accumulation begins now. Uncheck to save and start later.</div>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: '8px', background: '#F1F5F9', border: 'none', fontSize: '13px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving} style={{
            padding: '9px 22px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
            background: startNow ? 'linear-gradient(135deg, #10B981, #059669)' : 'linear-gradient(135deg, #3B82F6, #2563EB)',
            color: '#fff', display: 'flex', alignItems: 'center', gap: '7px',
            boxShadow: startNow ? '0 4px 12px rgba(16,185,129,0.3)' : '0 4px 12px rgba(59,130,246,0.3)',
          }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : startNow ? <Play size={14} /> : <Plus size={14} />}
            {startNow ? 'Save & Start Trip' : 'Save Trip'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const TripManagerPage = () => {
  const [trips, setTrips] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tripsData, vehiclesRes] = await Promise.all([
        tripApi.list(),
        vehicleApi.getVehicles({ t: Date.now() }),
      ]);
      setTrips(tripsData || []);
      if (vehiclesRes.success) setVehicles(vehiclesRes.data);

      // Load routes for dropdown
      const routesRes = await axiosInstance.get('/admin/routes');
      if (routesRes.data?.success) setRoutes(routesRes.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStart = async (trip) => {
    setActionLoading(p => ({ ...p, [trip.id]: 'starting' }));
    try {
      await tripApi.start(trip.id, {});
      await load();
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to start trip');
    } finally {
      setActionLoading(p => ({ ...p, [trip.id]: null }));
    }
  };

  const handleEnd = async (trip) => {
    if (!window.confirm(`End trip "${trip.name}"? This will finalize the distance and duration.`)) return;
    setActionLoading(p => ({ ...p, [trip.id]: 'ending' }));
    try {
      await tripApi.end(trip.id, {});
      await load();
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to end trip');
    } finally {
      setActionLoading(p => ({ ...p, [trip.id]: null }));
    }
  };

  const handleCancel = async (trip) => {
    if (!window.confirm(`Cancel trip "${trip.name}"?`)) return;
    setActionLoading(p => ({ ...p, [trip.id]: 'cancelling' }));
    try {
      await tripApi.cancel(trip.id);
      await load();
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to cancel trip');
    } finally {
      setActionLoading(p => ({ ...p, [trip.id]: null }));
    }
  };

  const filteredTrips = filter === 'all' ? trips : trips.filter(t => t.status === filter);
  const activeTrips = trips.filter(t => t.status === 'in_progress');

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .trip-row:hover { background: #F8FAFC !important; }
        .action-btn { transition: all 0.15s; }
        .action-btn:hover { transform: scale(1.04); }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', margin: 0 }}>Trip Manager</h1>
          <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0' }}>
            Create and track journeys — distance accumulates until you end the trip, regardless of how many days it takes.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={load} style={{ padding: '9px 14px', borderRadius: '9px', background: '#F1F5F9', border: '1px solid #E2E8F0', cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => setShowCreate(true)} style={{
            padding: '9px 18px', borderRadius: '9px', border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            color: '#fff', fontWeight: 700, fontSize: '13px',
            display: 'flex', alignItems: 'center', gap: '7px',
            boxShadow: '0 4px 16px rgba(102,126,234,0.35)'
          }}>
            <Plus size={15} /> New Trip
          </button>
        </div>
      </div>

      {/* Active Trips Banner */}
      {activeTrips.length > 0 && (
        <div style={{ background: 'linear-gradient(135deg, #ECFDF5, #D1FAE5)', border: '1px solid #A7F3D0', borderRadius: '14px', padding: '16px 20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#10B981', animation: 'pulse 1.5s infinite' }} />
            <span style={{ fontSize: '14px', fontWeight: 800, color: '#065F46' }}>{activeTrips.length} Trip{activeTrips.length > 1 ? 's' : ''} In Progress</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {activeTrips.map(trip => (
              <div key={trip.id} style={{ background: '#fff', borderRadius: '12px', padding: '14px 18px', border: '1px solid #6EE7B7', flex: '1 1 300px', minWidth: '260px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>{trip.name}</div>
                    <div style={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>{trip.vehicle_name} · {trip.plate}</div>
                  </div>
                  <button onClick={() => handleEnd(trip)} disabled={!!actionLoading[trip.id]} className="action-btn" style={{
                    padding: '7px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(135deg, #EF4444, #DC2626)', color: '#fff',
                    fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px'
                  }}>
                    {actionLoading[trip.id] === 'ending' ? <Loader2 size={12} className="animate-spin" /> : <Square size={12} />}
                    End Trip
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '20px' }}>
                  <div><div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Distance</div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>{parseFloat(trip.distance_km || 0).toFixed(1)} km</div></div>
                  <div><div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Started</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>{formatLocalTime(trip.start_time)}</div></div>
                  {trip.origin && trip.destination && (
                    <div><div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Route</div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>{trip.origin} → {trip.destination}</div></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: '#F1F5F9', padding: '4px', borderRadius: '10px', width: 'fit-content' }}>
        {[['all', 'All'], ['planned', 'Planned'], ['in_progress', 'In Progress'], ['completed', 'Completed'], ['cancelled', 'Cancelled']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)} style={{
            padding: '7px 16px', borderRadius: '7px', border: 'none', cursor: 'pointer',
            fontSize: '13px', fontWeight: filter === val ? 700 : 500,
            background: filter === val ? '#fff' : 'transparent',
            color: filter === val ? '#0F172A' : '#64748B',
            boxShadow: filter === val ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.15s'
          }}>{label}</button>
        ))}
      </div>

      {/* Trips Table */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#94A3B8' }}>
            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
            <div style={{ fontSize: '14px' }}>Loading trips...</div>
          </div>
        ) : filteredTrips.length === 0 ? (
          <div style={{ padding: '80px', textAlign: 'center', color: '#94A3B8' }}>
            <Route size={40} style={{ margin: '0 auto 16px', opacity: 0.4 }} />
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#334155' }}>No trips found</div>
            <div style={{ fontSize: '13px', marginTop: '6px' }}>Create a trip to start tracking journeys.</div>
            <button onClick={() => setShowCreate(true)} style={{ marginTop: '20px', padding: '10px 20px', borderRadius: '9px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}>
              Create First Trip
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  {['Trip Name', 'Vehicle', 'Route/Origin', 'Status', 'Started', 'Ended', 'Duration', 'Distance', 'Max Speed', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '11px 16px', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTrips.map(trip => (
                  <tr key={trip.id} className="trip-row" style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{trip.name}</div>
                      {trip.notes && <div style={{ fontSize: '11px', color: '#94A3B8' }}>{trip.notes.slice(0, 40)}</div>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Truck size={13} color="#94A3B8" /> {trip.vehicle_name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94A3B8' }}>{trip.plate}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {trip.route_name ? (
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#4F46E5', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Route size={11} /> {trip.route_name}
                        </div>
                      ) : (trip.origin && trip.destination) ? (
                        <div style={{ fontSize: '12px', color: '#475569' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MapPin size={10} color="#10B981" /> {trip.origin}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                            <Navigation size={10} color="#EF4444" /> {trip.destination}
                          </div>
                        </div>
                      ) : <span style={{ fontSize: '12px', color: '#CBD5E1' }}>–</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}><StatusBadge status={trip.status} /></td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#475569' }}>{trip.start_time ? formatLocalTime(trip.start_time) : '–'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#475569' }}>{trip.end_time ? formatLocalTime(trip.end_time) : trip.status === 'in_progress' ? <span style={{ color: '#10B981', fontWeight: 700 }}>Live ●</span> : '–'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} color="#94A3B8" /> {formatDuration(trip.duration_secs)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>{parseFloat(trip.distance_km || 0).toFixed(1)}</span>
                      <span style={{ fontSize: '11px', color: '#94A3B8' }}> km</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {trip.max_speed ? <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}><Gauge size={12} color="#94A3B8" />{trip.max_speed} km/h</span> : '–'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {trip.status === 'planned' && (
                          <button onClick={() => handleStart(trip)} disabled={!!actionLoading[trip.id]} className="action-btn"
                            style={{ padding: '6px 12px', borderRadius: '7px', background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#059669', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {actionLoading[trip.id] === 'starting' ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />} Start
                          </button>
                        )}
                        {trip.status === 'in_progress' && (
                          <button onClick={() => handleEnd(trip)} disabled={!!actionLoading[trip.id]} className="action-btn"
                            style={{ padding: '6px 12px', borderRadius: '7px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {actionLoading[trip.id] === 'ending' ? <Loader2 size={11} className="animate-spin" /> : <Square size={11} />} End
                          </button>
                        )}
                        {['planned', 'in_progress'].includes(trip.status) && (
                          <button onClick={() => handleCancel(trip)} disabled={!!actionLoading[trip.id]} className="action-btn"
                            style={{ padding: '6px 10px', borderRadius: '7px', background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#94A3B8', fontSize: '12px', cursor: 'pointer' }}>
                            <Trash2 size={12} />
                          </button>
                        )}
                        {trip.status === 'completed' && (
                          <span style={{ fontSize: '12px', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle size={13} color="#10B981" /> Done
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateTripModal
          vehicles={vehicles}
          routes={routes}
          onClose={() => setShowCreate(false)}
          onCreate={load}
        />
      )}
    </div>
  );
};

export default TripManagerPage;
