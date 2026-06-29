import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Play, Pause, Square, ChevronRight, ChevronLeft, Info, Link as LinkIcon, Download } from 'lucide-react';
import * as vehicleApi from '../../api/vehicleApi';
import RouteMap from '../../components/map/RouteMap';
import { getAddressFromCoordinates } from '../../utils/geocodeUtils';

const AddressCell = ({ lat, lng }) => {
  const [address, setAddress] = useState('Fetching...');
  useEffect(() => {
    let mounted = true;
    if (lat && lng) {
      getAddressFromCoordinates(lat, lng).then(addr => {
        if (mounted) setAddress(addr);
      });
    } else {
      setAddress('N/A');
    }
    return () => { mounted = false; };
  }, [lat, lng]);
  return <td style={{ padding: '8px', borderRight: '1px solid #E5E7EB', fontSize: '10px', color: '#000000', maxWidth: '140px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={address}>{address}</td>;
};

// Calculate distance between two coordinates in kilometers using Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

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

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 100;

  // Tabs state
  const [activeTab, setActiveTab] = useState('All');
  const tabs = ['All', 'Movement', 'OverSpeed', 'Parked', 'Idle', 'Ignition', 'Stoppage'];

  // Calculate filtered points for the table based on active tab
  const getFilteredPoints = () => {
    if (activeTab === 'All') return points;
    if (activeTab === 'Movement') return points.filter(p => p.speed > 5);
    if (activeTab === 'OverSpeed') return points.filter(p => p.speed > 60); // Mock overspeed
    if (activeTab === 'Parked') return points.filter(p => p.speed <= 5 && !p.ignition);
    if (activeTab === 'Idle') return points.filter(p => p.speed <= 5 && p.ignition);
    if (activeTab === 'Ignition') return points.filter(p => p.ignition);
    if (activeTab === 'Stoppage') return points.filter(p => p.speed <= 2);
    return points;
  };
  
  const filteredPoints = getFilteredPoints();

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredPoints.length, activeTab]);

  useEffect(() => {
    if (activeTab === 'All' && points.length > 0 && currentPointIndex >= 0) {
      const neededPage = Math.floor(currentPointIndex / rowsPerPage) + 1;
      if (currentPage !== neededPage) {
        setCurrentPage(neededPage);
      }
    }
  }, [currentPointIndex, points.length, rowsPerPage, currentPage, activeTab]);

  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = filteredPoints.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(filteredPoints.length / rowsPerPage) || 1;

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
        const processedPoints = routeRes.data.map(p => {
          const lat = parseFloat(p.lat);
          const lng = parseFloat(p.lng);
          if (!isNaN(lat) && !isNaN(lng)) {
            return p;
          } else {
            return { ...p, lat: 17.3411, lng: 78.5317 }; // Fallback
          }
        });

        // Ensure chronological
        const sorted = [...processedPoints].sort((a, b) => new Date(a.device_time) - new Date(b.device_time));
        
        let cumulativeDist = 0;
        const withDist = sorted.map((p, idx, arr) => {
          if (idx > 0) {
            cumulativeDist += calculateDistance(parseFloat(arr[idx-1].lat), parseFloat(arr[idx-1].lng), parseFloat(p.lat), parseFloat(p.lng));
          }
          return { ...p, cDist: cumulativeDist };
        });

        setPoints(withDist);
      }
    } catch (err) {
      console.error('Failed to load history logs:', err);
      setError('Failed to fetch history logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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
    if (filteredPoints.length === 0) return;
    const headers = ['Date & Time', 'Speed (kmph)', 'Address', 'Direction', 'C-Dist (KMS)', 'Odo (KMS)', 'Fuel (Ltrs)', 'Ignition Status'];
    const csvRows = [headers.join(',')];
    filteredPoints.forEach((p) => {
      const row = [
        new Date(p.device_time).toLocaleString().replace(',', ''),
        p.speed || 0,
        'Address not resolved',
        'N/A',
        '0',
        p.odometer || 0,
        p.fuel !== undefined && p.fuel !== null ? Number(p.fuel).toFixed(2) : '0.00',
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

  // Calculate total distance (mock for now, assume max odo - min odo)
  const totalDist = points.length > 0 ? (points[points.length-1].odometer - points[0].odometer) || 0 : 0;

  // --- Draw Semi-Circle Gauges ---
  const renderSemiCircle = (value, max, label, unit, colorRanges) => {
    const percentage = Math.min(Math.max(value / max, 0), 1);
    const angle = percentage * 180;
    
    // Determine color based on ranges (e.g. [{max: 33, color: 'green'}, {max: 66, color: 'yellow'}, {max: 100, color: 'red'}])
    let strokeColor = '#22c55e'; // default green
    for (let range of colorRanges) {
      if (percentage * 100 <= range.max) {
        strokeColor = range.color;
        break;
      }
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '140px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>{label} - {Math.round(value)} {unit}</div>
        <div style={{ position: 'relative', width: '120px', height: '60px', overflow: 'hidden' }}>
          {/* Background Track */}
          <svg width="120" height="120" viewBox="0 0 100 100" style={{ transform: 'rotate(180deg)' }}>
            <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#E2E8F0" strokeWidth="16" strokeLinecap="butt" />
          </svg>
          {/* Value Track */}
          <svg width="120" height="120" viewBox="0 0 100 100" style={{ transform: 'rotate(180deg)', position: 'absolute', top: 0, left: 0 }}>
            <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke={strokeColor} strokeWidth="16" strokeLinecap="butt" strokeDasharray="125.6" strokeDashoffset={125.6 - (percentage * 125.6)} style={{ transition: 'stroke-dashoffset 0.4s ease' }} />
          </svg>
          {/* Needle (optional, omitting for clean look, just using the bar) */}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: 'calc(100vh - 56px)', background: '#F3F4F6', overflow: 'hidden', fontFamily: "'Inter', sans-serif" }}>

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

        {/* Right Panel Toggle Button (On Map) */}
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

        {/* Floating Gauges (Legacy UI Style: Unified white box at bottom left) */}
        {points.length > 0 && activePoint && (
          <div style={{ position: 'absolute', bottom: '24px', left: '24px', zIndex: 999, background: 'rgba(255, 255, 255, 0.85)', borderRadius: '8px', padding: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', display: 'flex', gap: '32px', border: '1px solid #D1D5DB' }}>
            {/* Speed Gauge: 0-200 km/h, Green (0-60), Yellow (60-80), Red (80+) */}
            {renderSemiCircle(activePoint.speed || 0, 200, 'Speed', 'Km/h', [
              { max: 30, color: '#22c55e' },
              { max: 40, color: '#eab308' },
              { max: 100, color: '#ef4444' }
            ])}
            {/* Fuel Gauge: Assuming max tank size 400 Ltrs for display, Green */}
            {renderSemiCircle(activePoint.fuel || 97, 400, 'Tank Size 364 Ltr', '', [
              { max: 100, color: '#84cc16' }
            ])}
          </div>
        )}
      </div>

      {/* ═══════════ RIGHT PANEL: CONTROLS & TABLE ═══════════ */}
      <div style={{ 
        width: isRightPanelOpen ? '600px' : '0px', 
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
        background: '#FFFFFF', 
        borderLeft: isRightPanelOpen ? '1px solid #E2E8F0' : 'none', 
        display: 'flex', 
        flexDirection: 'column', 
        boxShadow: isRightPanelOpen ? '-2px 0 12px rgba(0,0,0,0.04)' : 'none', 
        flexShrink: 0, 
        overflow: 'hidden' 
      }}>
        <div style={{ width: '600px', display: 'flex', flexDirection: 'column', height: '100%' }}>

          {/* Top Header Row */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F9FAFB' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#000000' }}>Vehicle Group</span>
                <select style={{ padding: '6px', border: '1px solid #D1D5DB', borderRadius: '4px', fontSize: '12px', width: '140px' }}>
                  <option>Select Group</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#000000' }}>Vehicle Name</span>
                <select value={id || ''} onChange={(e) => navigate(`/vehicles/${e.target.value}/history`)} style={{ padding: '6px', border: '1px solid #D1D5DB', borderRadius: '4px', fontSize: '12px', width: '160px' }}>
                  <option value={id}>{vehicle?.name || 'Select Vehicle'}</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div style={{ fontWeight: 600, color: '#000000' }}>Total Dist</div>
              <div style={{ fontWeight: 800, color: '#111827' }}>{Math.max(0, totalDist).toFixed(2)} Kms</div>
            </div>
          </div>

          {/* Date & Range Controls */}
          <div style={{ padding: '16px', borderBottom: '1px solid #E5E7EB', background: '#FFFFFF' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
              <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ flex: 1, padding: '8px', border: '1px solid #D1D5DB', borderRadius: '4px', fontSize: '12px' }} />
              <input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ flex: 1, padding: '8px', border: '1px solid #D1D5DB', borderRadius: '4px', fontSize: '12px' }} />
              <button onClick={fetchRouteHistory} disabled={loading} style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', fontWeight: 700, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Plot
              </button>
              <button style={{ background: '#F3F4F6', border: '1px solid #D1D5DB', padding: '8px', borderRadius: '4px', cursor: 'pointer', color: '#0369a1' }}>
                <Info size={16} />
              </button>
            </div>
            
            {/* Quick Range Buttons (Legacy Neon Colors) */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setQuickRange('6h')} style={{ flex: 1, padding: '8px 0', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>6 Hours</button>
              <button onClick={() => setQuickRange('12h')} style={{ flex: 1, padding: '8px 0', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>12 Hours</button>
              <button onClick={() => setQuickRange('today')} style={{ flex: 1, padding: '8px 0', background: '#f97316', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Today</button>
              <button onClick={() => setQuickRange('yesterday')} style={{ flex: 1, padding: '8px 0', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Yesterday</button>
            </div>
          </div>

          {/* Table Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #D1D5DB', background: '#F9FAFB' }}>
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '10px 14px',
                  background: activeTab === tab ? '#FFFFFF' : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid #3B82F6' : '2px solid transparent',
                  borderRight: '1px solid #E5E7EB',
                  fontSize: '12px',
                  fontWeight: activeTab === tab ? 700 : 600,
                  color: activeTab === tab ? '#111827' : '#6B7280',
                  cursor: 'pointer',
                  flex: 1
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Data Table */}
          <div style={{ flex: 1, overflowY: 'auto', position: 'relative', background: '#FFFFFF' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '11px' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#F9FAFB', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', zIndex: 10 }}>
                <tr>
                  <th style={{ padding: '8px', color: '#000000', fontWeight: 700, borderBottom: '1px solid #D1D5DB', borderRight: '1px solid #E5E7EB' }}>Date & Time</th>
                  <th style={{ padding: '8px', color: '#000000', fontWeight: 700, borderBottom: '1px solid #D1D5DB', borderRight: '1px solid #E5E7EB' }}>Max (kmph)</th>
                  <th style={{ padding: '8px', color: '#000000', fontWeight: 700, borderBottom: '1px solid #D1D5DB', borderRight: '1px solid #E5E7EB' }}>Out</th>
                  <th style={{ padding: '8px', color: '#000000', fontWeight: 700, borderBottom: '1px solid #D1D5DB', borderRight: '1px solid #E5E7EB', width: '120px' }}>Address</th>
                  <th style={{ padding: '8px', color: '#000000', fontWeight: 700, borderBottom: '1px solid #D1D5DB', borderRight: '1px solid #E5E7EB' }}>Direction</th>
                  <th style={{ padding: '8px', color: '#000000', fontWeight: 700, borderBottom: '1px solid #D1D5DB', borderRight: '1px solid #E5E7EB' }}>G-Map</th>
                  <th style={{ padding: '8px', color: '#000000', fontWeight: 700, borderBottom: '1px solid #D1D5DB', borderRight: '1px solid #E5E7EB' }}>C-Dist (KMS)</th>
                  <th style={{ padding: '8px', color: '#000000', fontWeight: 700, borderBottom: '1px solid #D1D5DB', borderRight: '1px solid #E5E7EB' }}>Odo (KMS)</th>
                  <th style={{ padding: '8px', color: '#000000', fontWeight: 700, borderBottom: '1px solid #D1D5DB', borderRight: '1px solid #E5E7EB' }}>Fuel (ltrs)</th>
                  <th style={{ padding: '8px', color: '#000000', fontWeight: 700, borderBottom: '1px solid #D1D5DB' }}>Ignition Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredPoints.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF' }}>No data available for this period.</td>
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
                          background: idx === currentPointIndex ? '#E0F2FE' : (idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB'),
                          borderBottom: '1px solid #E5E7EB',
                          cursor: 'pointer'
                        }}
                      >
                        <td style={{ padding: '8px', borderRight: '1px solid #E5E7EB', color: '#000000' }}>
                          <div style={{ fontWeight: 600 }}>{new Date(p.device_time).toLocaleTimeString('en-GB')}</div>
                          <div style={{ fontSize: '10px' }}>{new Date(p.device_time).toLocaleDateString('en-GB')}</div>
                        </td>
                        <td style={{ padding: '8px', borderRight: '1px solid #E5E7EB', color: '#000000' }}>{Math.round(p.speed || 0)}</td>
                        <td style={{ padding: '8px', borderRight: '1px solid #E5E7EB', color: '#000000' }}>No</td>
                        <AddressCell lat={p.lat} lng={p.lng} />
                        <td style={{ padding: '8px', borderRight: '1px solid #E5E7EB', color: '#000000' }}>N/A</td>
                        <td style={{ padding: '8px', borderRight: '1px solid #E5E7EB' }}>
                          <a href={`https://www.google.com/maps?q=${p.lat},${p.lng}`} target="_blank" rel="noreferrer" style={{ color: '#3B82F6', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}><LinkIcon size={12} /> Link</a>
                        </td>
                        <td style={{ padding: '8px', borderRight: '1px solid #E5E7EB', color: '#000000' }}>{p.cDist !== undefined ? p.cDist.toFixed(2) : '0.00'}</td>
                        <td style={{ padding: '8px', borderRight: '1px solid #E5E7EB', color: '#000000' }}>{p.odometer ? Math.round(p.odometer) : '-'}</td>
                        <td style={{ padding: '8px', borderRight: '1px solid #E5E7EB', color: '#000000' }}>{p.fuel !== undefined && p.fuel !== null ? Number(p.fuel).toFixed(2) : '-'}</td>
                        <td style={{ padding: '8px' }}>
                          <span style={{ color: p.ignition ? '#10B981' : '#9CA3AF', fontWeight: 700 }}>{p.ignition ? 'ON' : 'OFF'}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F9FAFB', borderTop: '1px solid #D1D5DB' }}>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: '4px 12px', fontSize: '11px', border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', borderRadius: '4px', color: '#000000' }}>Prev</button>
              <span style={{ fontSize: '11px', color: '#000000', fontWeight: 600 }}>Page {currentPage} of {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ padding: '4px 12px', fontSize: '11px', border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', borderRadius: '4px', color: '#000000' }}>Next</button>
            </div>
          )}

          {/* Footer actions (Playback & Routes) */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid #D1D5DB', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setIsPlaying(!isPlaying)} style={{ background: '#F3F4F6', border: '1px solid #D1D5DB', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', color: '#000000' }}>
                  {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <button onClick={handleStop} style={{ background: '#F3F4F6', border: '1px solid #D1D5DB', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', color: '#000000' }}>
                  <Square size={16} />
                </button>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {['Slow', 'Normal', 'Fast'].map(spd => (
                  <label key={spd} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: '#000000', fontWeight: 600 }}>
                    <input type="radio" checked={playbackSpeed === spd} onChange={() => setPlaybackSpeed(spd)} style={{ margin: 0 }} />
                    {spd}
                  </label>
                ))}
              </div>
            </div>
            <button onClick={handleExportCSV} style={{ padding: '8px 24px', background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: '4px', fontSize: '13px', fontWeight: 700, color: '#000000', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Routes <Download size={14}/>
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
