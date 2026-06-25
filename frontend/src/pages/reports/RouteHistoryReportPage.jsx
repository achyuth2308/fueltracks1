import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Loader2, Play, Pause, Square, Search, ChevronRight, ChevronLeft } from 'lucide-react';
import * as vehicleApi from '../../api/vehicleApi';
import RouteMap from '../../components/map/RouteMap';

const RouteHistoryReportPage = () => {
  const navigate = useNavigate();

  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);

  // Playback state (mock for UI)
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState('Normal');

  // Date range defaults: Today
  const getTodayRange = () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    
    const toLocalISO = (d) => {
      const offsetMs = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16);
    };

    return {
      start: toLocalISO(start),
      end: toLocalISO(end)
    };
  };

  const [startDate, setStartDate] = useState(getTodayRange().start);
  const [endDate, setEndDate] = useState(getTodayRange().end);

  useEffect(() => {
    vehicleApi.getVehicles({ t: Date.now() })
      .then(res => {
        if (res.success) {
          setVehicles(res.data);
        }
      })
      .catch(console.error);
  }, []);

  const fetchRouteHistory = async () => {
    if (!selectedVehicleId) return;
    setLoading(true);
    try {
      const routeRes = await vehicleApi.getVehicleRoute(selectedVehicleId, {
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString()
      });
      if (routeRes.success) {
        let lastValidLat = null;
        let lastValidLng = null;
        
        const processedPoints = routeRes.data.map(p => {
          const lat = parseFloat(p.lat);
          const lng = parseFloat(p.lng);
          
          if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) > 1.0 && Math.abs(lng) > 1.0) {
            lastValidLat = p.lat;
            lastValidLng = p.lng;
            return p;
          } else {
            // Invalid coordinate: use last known good location
            return {
              ...p,
              lat: lastValidLat,
              lng: lastValidLng
            };
          }
        });
        
        setPoints(processedPoints);
      }
    } catch (err) {
      console.error('Failed to load history logs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch if vehicle changes
  useEffect(() => {
    if (selectedVehicleId) {
      fetchRouteHistory();
    } else {
      setPoints([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVehicleId]);

  const handleQuerySubmit = () => {
    if (!selectedVehicleId) {
      alert('Please select a vehicle first.');
      return;
    }
    fetchRouteHistory();
  };

  const setQuickRange = (rangeType) => {
    const now = new Date();
    let start, end;
    
    const toLocalISO = (d) => {
      const offsetMs = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16);
    };

    if (rangeType === '6h') {
      start = new Date(now.getTime() - 6 * 60 * 60 * 1000);
      end = now;
    } else if (rangeType === '12h') {
      start = new Date(now.getTime() - 12 * 60 * 60 * 1000);
      end = now;
    } else if (rangeType === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (rangeType === 'yesterday') {
      const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      start = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 0, 0, 0);
      end = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 23, 59, 59);
    }
    
    setStartDate(toLocalISO(start));
    setEndDate(toLocalISO(end));
  };

  const handleExportCSV = () => {
    if (points.length === 0) return;
    const headers = ['Timestamp', 'Latitude', 'Longitude', 'Speed (km/h)', 'Odometer', 'Ignition'];
    const csvRows = [headers.join(',')];
    points.forEach((p) => {
      const row = [
        new Date(p.device_time).toLocaleString(),
        p.lat, p.lng, p.speed || 0,
        p.odometer || 0,
        p.ignition ? 'ON' : 'OFF'
      ];
      csvRows.push(row.join(','));
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    const vName = vehicles.find(v => v.id === selectedVehicleId)?.name || 'Vehicle';
    link.setAttribute('download', `${vName}_GPS_History.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activePoint = points.length > 0 ? points[points.length - 1] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: 'calc(100vh - 56px)', background: '#EEF5F8', overflow: 'hidden', fontFamily: "'Inter', sans-serif" }}>
      
      {/* ═══════════ LEFT PANEL: MAP AREA ═══════════ */}
      <div style={{ flex: 1, position: 'relative', background: '#E2E8F0', display: 'flex', flexDirection: 'column' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(4px)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Loader2 size={32} color="#0EA5E9" className="animate-spin" style={{ marginBottom: '16px' }} />
            <span style={{ fontSize: '15px', fontWeight: 600, color: '#1F2937' }}>Loading route history...</span>
          </div>
        )}
        <div style={{ flex: 1 }}>
          <RouteMap points={points} vehicleName={vehicles.find(v => v.id === selectedVehicleId)?.name || 'Vehicle'} />
        </div>

        {/* Right Panel Toggle Button */}
        <button 
          onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
          style={{
            position: 'absolute', top: '24px', right: '16px', zIndex: 1000,
            width: '32px', height: '32px', borderRadius: '50%',
            background: '#fff', border: '1px solid #CBD5E1', boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            color: '#475569', transition: 'all 0.3s ease'
          }}
          title={isRightPanelOpen ? "Close panel" : "Open panel"}
        >
          {isRightPanelOpen ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>

        {/* Floating Gauges (Bottom Left) */}
        {selectedVehicleId && (
          <div style={{ position: 'absolute', bottom: '24px', left: '24px', zIndex: 999, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', borderRadius: '12px', padding: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)', display: 'flex', gap: '32px', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Speed - {Math.round(activePoint?.speed || 0)} km/h</span>
              <div style={{ position: 'relative', width: '120px', height: '80px', overflow: 'hidden' }}>
                <svg width="120" height="120" viewBox="0 0 100 100">
                  <path d="M 10 90 A 40 40 0 0 1 90 90" fill="none" stroke="#E2E8F0" strokeWidth="12" strokeLinecap="round" />
                  <path d="M 10 90 A 40 40 0 0 1 90 90" fill="none" stroke="#10B981" strokeWidth="12" strokeLinecap="round" strokeDasharray="126" strokeDashoffset={126 - (Math.min(activePoint?.speed || 0, 180) / 180) * 126} style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* Floating Playback Controls (Bottom Right) */}
        {selectedVehicleId && (
          <div style={{ position: 'absolute', bottom: '24px', right: '24px', zIndex: 999, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', borderRadius: '8px', padding: '12px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setIsPlaying(!isPlaying)} style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '8px', borderRadius: '4px', cursor: 'pointer', color: '#1F2937' }}>
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <button style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '8px', borderRadius: '4px', cursor: 'pointer', color: '#1F2937' }}>
                <Square size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {['Slow', 'Normal', 'Fast'].map(spd => (
                <label key={spd} style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input type="radio" checked={playbackSpeed === spd} onChange={() => setPlaybackSpeed(spd)} style={{ margin: 0 }} />
                  {spd}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════ RIGHT PANEL: CONTROLS & TABLE ═══════════ */}
      <div style={{ width: isRightPanelOpen ? '400px' : '0px', transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)', background: '#FFFFFF', borderLeft: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', boxShadow: '-2px 0 12px rgba(0,0,0,0.02)', flexShrink: 0, overflow: 'hidden' }}>
        <div style={{ width: '400px', display: 'flex', flexDirection: 'column', height: '100%' }}>
        
        {/* Header - Vehicle Selector */}
        <div style={{ padding: '20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: '16px', background: '#FAFAFA' }}>
          <button onClick={() => navigate('/admin/reports')} style={{ padding: '8px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', cursor: 'pointer', color: '#64748B', display: 'flex', alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <ArrowLeft size={18} />
          </button>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.05em' }}>Select Vehicle</label>
            <select 
              value={selectedVehicleId} 
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none', background: '#FFFFFF', fontSize: '14px', fontWeight: 600, color: '#0F172A', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}
            >
              <option value="">-- Choose a vehicle --</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.name} ({v.plate})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Filters Section */}
        <div style={{ padding: '20px', background: '#EEF5F8', borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px', textTransform: 'uppercase' }}>Start Time</label>
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '12px', color: '#111827', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px', textTransform: 'uppercase' }}>End Time</label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '12px', color: '#111827', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <button
              onClick={handleQuerySubmit}
              disabled={loading}
              style={{ width: '100%', background: '#f97316', color: '#fff', border: 'none', padding: '9px 20px', borderRadius: '6px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <Search size={16} /> Plot Route
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {['6 Hours', '12 Hours', 'Today', 'Yesterday'].map((label, i) => {
              const types = ['6h', '12h', 'today', 'yesterday'];
              const colors = ['#10B981', '#0EA5E9', '#F59E0B', '#EF4444'];
              return (
                <button
                  key={label}
                  onClick={() => setQuickRange(types[i])}
                  style={{ flex: 1, padding: '6px 0', background: colors[i], color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Data Table */}
        <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#F8FAFC', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', zIndex: 10 }}>
              <tr>
                <th style={{ padding: '10px 12px', color: '#475569', fontWeight: 700, borderBottom: '1px solid #CBD5E1' }}>Time</th>
                <th style={{ padding: '10px 12px', color: '#475569', fontWeight: 700, borderBottom: '1px solid #CBD5E1', textAlign: 'right' }}>Speed</th>
                <th style={{ padding: '10px 12px', color: '#475569', fontWeight: 700, borderBottom: '1px solid #CBD5E1', textAlign: 'right' }}>Odo</th>
                <th style={{ padding: '10px 12px', color: '#475569', fontWeight: 700, borderBottom: '1px solid #CBD5E1', textAlign: 'center' }}>Ign</th>
              </tr>
            </thead>
            <tbody>
              {!selectedVehicleId ? (
                <tr>
                  <td colSpan="5" style={{ padding: '60px', textAlign: 'center', color: '#9CA3AF', fontSize: '14px' }}>
                    Please select a vehicle above to view its route history.
                  </td>
                </tr>
              ) : points.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF' }}>No data available for this period.</td>
                </tr>
              ) : (
                points.map((p, idx) => (
                  <tr key={idx} style={{ background: idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '8px 12px', color: '#1E293B', whiteSpace: 'nowrap' }}>
                      {new Date(p.device_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      <div style={{ fontSize: '10px', color: '#9CA3AF' }}>{new Date(p.device_time).toLocaleDateString('en-GB')}</div>
                    </td>
                    <td style={{ padding: '8px 12px', color: '#374151', textAlign: 'right', fontWeight: 600 }}>{Math.round(p.speed || 0)}</td>
                    <td style={{ padding: '8px 12px', color: '#374151', textAlign: 'right' }}>{Math.round(p.odometer || 0)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <span style={{ color: p.ignition ? '#10B981' : '#9CA3AF', fontWeight: 700, fontSize: '11px' }}>{p.ignition ? 'ON' : 'OFF'}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer actions */}
        <div style={{ padding: '16px', borderTop: '1px solid #E2E8F0', background: '#EEF5F8' }}>
          <button onClick={handleExportCSV} disabled={points.length === 0} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', background: '#f97316', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', opacity: points.length === 0 ? 0.5 : 1 }}>
            <Download size={16} /> Export CSV
          </button>
        </div>

      </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}} />
    </div>
  );
};

export default RouteHistoryReportPage;
