import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Loader2, Play, Pause, Square, ChevronRight, ChevronLeft } from 'lucide-react';
import * as vehicleApi from '../../api/vehicleApi';
import RouteMap from '../../components/map/RouteMap';
import { formatLocalTime } from '../../utils/dateUtils';
import { formatSpeed, formatOdometer } from '../../utils/formatUtils';

const HistoryPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [vehicle, setVehicle] = useState(null);
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);

  // Playback state
  const [currentPointIndex, setCurrentPointIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState('Normal');

  // Pagination state for table to prevent rendering thousands of rows
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 100;

  useEffect(() => {
    setCurrentPage(1);
  }, [points]);

  useEffect(() => {
    if (points.length > 0 && currentPointIndex >= 0) {
      const neededPage = Math.floor(currentPointIndex / rowsPerPage) + 1;
      if (currentPage !== neededPage) {
        setCurrentPage(neededPage);
      }
    }
  }, [currentPointIndex, points.length, rowsPerPage, currentPage]);

  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = points.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(points.length / rowsPerPage) || 1;

  // Date range defaults: Today
  const getTodayRange = () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    
    // Format to local ISO string YYYY-MM-DDThh:mm
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
    const fetchVehicle = async () => {
      try {
        const response = await vehicleApi.getVehicleById(id);
        if (response.success) {
          setVehicle(response.data);
        }
      } catch (err) {
        console.error('Failed to fetch vehicle:', err);
      }
    };
    fetchVehicle();
  }, [id]);

  const fetchRouteHistory = async () => {
    setLoading(true);
    setError(null);
    setIsPlaying(false);
    setCurrentPointIndex(0);
    try {
      const routeRes = await vehicleApi.getVehicleRoute(id, {
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString()
      });
      if (routeRes.success) {
        // Validate coordinate is within India's geographic bounds
        // Lat: 6.5 (southernmost tip) to 37.5 (northernmost Kashmir)
        // Lng: 68.0 (westernmost Gujarat) to 98.0 (easternmost Arunachal)
        const isValidCoord = (lat, lng) =>
          !isNaN(lat) && !isNaN(lng) &&
          lat > 6.5 && lat < 37.5 &&
          lng > 68.0 && lng < 98.0;

        // Default fallback to Hyderabad office if literally 0 valid coordinates exist in history
        let lastValidLat = 17.3411;
        let lastValidLng = 78.5317;

        // First pass: find the first valid coordinate to use as starting fallback
        for (const p of routeRes.data) {
          const lat = parseFloat(p.lat);
          const lng = parseFloat(p.lng);
          if (isValidCoord(lat, lng)) {
            lastValidLat = p.lat;
            lastValidLng = p.lng;
            break;
          }
        }

        // Second pass: map each point, substituting invalid coords with last known valid
        const processedPoints = routeRes.data.map(p => {
          const lat = parseFloat(p.lat);
          const lng = parseFloat(p.lng);

          if (isValidCoord(lat, lng)) {
            lastValidLat = p.lat;
            lastValidLng = p.lng;
            return p;
          } else {
            // Invalid coordinate: substitute last known good location
            return { ...p, lat: lastValidLat, lng: lastValidLng };
          }
        });

        setPoints(processedPoints);
      }
    } catch (err) {
      console.error('Failed to load history logs:', err);
      setError('Failed to fetch history logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Auto-fetch today's route when vehicle is loaded
    // so the map immediately zooms to where the vehicle actually is
    if (vehicle) fetchRouteHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, vehicle]);

  // Playback Timer logic
  useEffect(() => {
    let timer = null;
    if (isPlaying && points.length > 0) {
      const speedMs = {
        'Slow': 1000,
        'Normal': 400,
        'Fast': 80
      }[playbackSpeed] || 400;

      timer = setInterval(() => {
        setCurrentPointIndex((prev) => {
          if (prev >= points.length - 1) {
            setIsPlaying(false);
            clearInterval(timer);
            return prev;
          }
          return prev + 1;
        });
      }, speedMs);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, points, playbackSpeed]);

  // Scroll active table row into view
  useEffect(() => {
    if (points.length > 0) {
      const activeRow = document.getElementById(`row-${currentPointIndex}`);
      if (activeRow) {
        activeRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [currentPointIndex, points.length]);

  const handleQuerySubmit = () => {
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
    link.setAttribute('download', `${vehicle?.name || 'Vehicle'}_GPS_History.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleStop = () => {
    setIsPlaying(false);
    setCurrentPointIndex(0);
  };

  const activePoint = points.length > 0 ? points[currentPointIndex] : null;

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
        {/* Map Container */}
        <div style={{ position: 'absolute', inset: 0 }}>
          <RouteMap
            points={points}
            activePoint={activePoint}
            vehicleName={vehicle?.name || 'Vehicle'}
            vehicleLastKnownPosition={
              vehicle && vehicle.lat != null && vehicle.lng != null
                ? { lat: vehicle.lat, lng: vehicle.lng }
                : null
            }
          />
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
        {points.length > 0 && activePoint && (
          <div style={{ position: 'absolute', bottom: '24px', left: '24px', zIndex: 999, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', borderRadius: '12px', padding: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)', display: 'flex', gap: '32px', border: '1px solid #E2E8F0' }}>
            {/* Speed Gauge */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Speed - {Math.round(activePoint.speed || 0)} km/h</span>
              <div style={{ position: 'relative', width: '120px', height: '80px', overflow: 'hidden' }}>
                <svg width="120" height="120" viewBox="0 0 100 100">
                  <path d="M 10 90 A 40 40 0 0 1 90 90" fill="none" stroke="#E2E8F0" strokeWidth="12" strokeLinecap="round" />
                  <path d="M 10 90 A 40 40 0 0 1 90 90" fill="none" stroke={activePoint.speed > 65 ? '#ef4444' : activePoint.speed > 30 ? '#f59e0b' : '#22c55e'} strokeWidth="12" strokeLinecap="round" strokeDasharray="126" strokeDashoffset={126 - (Math.min(activePoint.speed || 0, 180) / 180) * 126} style={{ transition: 'stroke-dashoffset 0.4s ease' }} />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* Floating Playback Controls & Timeline (Bottom Right & Center Overlay) */}
        {points.length > 0 && (
          <div style={{
            position: 'absolute', bottom: '24px', right: '24px', left: points.length > 0 ? '190px' : '24px', zIndex: 999,
            background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(8px)', borderRadius: '12px', padding: '14px 20px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)', border: '1px solid #E2E8F0',
            display: 'flex', flexDirection: 'column', gap: '10px'
          }}>

            {/* Timeline Progress Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
              <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, minWidth: '55px' }}>
                {new Date(points[currentPointIndex]?.device_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>

              <input
                type="range"
                min={0}
                max={points.length - 1}
                value={currentPointIndex}
                onChange={(e) => setCurrentPointIndex(parseInt(e.target.value))}
                style={{
                  flex: 1,
                  height: '6px',
                  borderRadius: '3px',
                  outline: 'none',
                  cursor: 'pointer',
                  accentColor: '#0ea5e9'
                }}
              />

              <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, minWidth: '40px', textAlign: 'right' }}>
                {Math.round((currentPointIndex / (points.length - 1)) * 100)}%
              </span>
            </div>

            {/* Playback Buttons & Speeds */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  style={{
                    background: isPlaying ? '#0ea5e9' : '#F1F5F9',
                    border: '1px solid #CBD5E1',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    color: isPlaying ? '#ffffff' : '#1F2937',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 700,
                    fontSize: '12px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    transition: 'all 0.2s'
                  }}
                >
                  {isPlaying ? <Pause size={15} /> : <Play size={15} />}
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
                <button
                  onClick={handleStop}
                  style={{
                    background: '#F8FAFC',
                    border: '1px solid #CBD5E1',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    color: '#1F2937',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: 700,
                    fontSize: '12px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    transition: 'all 0.2s'
                  }}
                >
                  <Square size={14} /> Stop
                </button>
              </div>

              {/* Speeds selector */}
              <div style={{ display: 'flex', gap: '6px', background: '#F8FAFC', padding: '3px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                {['Slow', 'Normal', 'Fast'].map(spd => (
                  <button
                    key={spd}
                    onClick={() => setPlaybackSpeed(spd)}
                    style={{
                      border: 'none',
                      background: playbackSpeed === spd ? '#ffffff' : 'transparent',
                      color: playbackSpeed === spd ? '#0ea5e9' : '#64748b',
                      padding: '5px 12px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: playbackSpeed === spd ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                      transition: 'all 0.15s'
                    }}
                  >
                    {spd}
                  </button>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* ═══════════ RIGHT PANEL: CONTROLS & TABLE ═══════════ */}
      <div style={{ width: isRightPanelOpen ? '400px' : '0px', transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)', background: '#FFFFFF', borderLeft: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', boxShadow: '-2px 0 12px rgba(0,0,0,0.02)', flexShrink: 0, overflow: 'hidden' }}>
        <div style={{ width: '400px', display: 'flex', flexDirection: 'column', height: '100%' }}>

          {/* Header */}
          <div style={{ padding: '20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={() => navigate(`/vehicles/${id}`)} style={{ padding: '8px', background: '#EEF5F8', border: '1px solid #E2E8F0', borderRadius: '6px', cursor: 'pointer', color: '#64748B', display: 'flex', alignItems: 'center' }}>
              <ArrowLeft size={16} />
            </button>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#111827', margin: 0 }}>{vehicle?.name || 'Vehicle History'}</h2>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 500, marginTop: '2px' }}>{vehicle?.plate} • {points.length} logs found</div>
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
                Plot Route
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
                {points.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF' }}>No data available for this period.</td>
                  </tr>
                ) : (
                  currentRows.map((p, index) => {
                    const idx = indexOfFirstRow + index;
                    return (
                      <tr
                        key={idx}
                        id={`row-${idx}`}
                        onClick={() => setCurrentPointIndex(idx)}
                        style={{
                          background: idx === currentPointIndex ? '#e0f2fe' : (idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'),
                          borderBottom: '1px solid #F1F5F9',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s'
                        }}
                      >
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
                    );
                  })
                )}
              </tbody>
            </table>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', borderTop: '1px solid #CBD5E1', borderBottom: '1px solid #CBD5E1', position: 'sticky', bottom: 0, zIndex: 10 }}>
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                  disabled={currentPage === 1}
                  style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 600, color: '#475569', borderRadius: '4px', border: '1px solid #CBD5E1', background: currentPage === 1 ? '#F1F5F9' : '#fff', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                >
                  Previous
                </button>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Page {currentPage} of {totalPages}</span>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                  disabled={currentPage === totalPages}
                  style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 600, color: '#475569', borderRadius: '4px', border: '1px solid #CBD5E1', background: currentPage === totalPages ? '#F1F5F9' : '#fff', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div style={{ padding: '16px', borderTop: '1px solid #E2E8F0', background: '#EEF5F8' }}>
            <button onClick={handleExportCSV} disabled={points.length === 0} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', background: '#f97316', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', opacity: points.length === 0 ? 0.5 : 1 }}>
              <Download size={16} /> Export CSV
            </button>
          </div>

        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}} />
    </div>
  );
};

export default HistoryPage;
