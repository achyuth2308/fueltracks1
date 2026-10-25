import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Download, Search, Loader2, Filter,
  FileSpreadsheet, FileText, Truck, Calendar, Shield,
  ArrowRight, MapPin, Clock, Navigation, CheckCircle2,
  LogIn, LogOut, ArrowDownRight, ArrowUpRight, Compass,
  Layers, RefreshCw, AlertCircle
} from 'lucide-react';
import axiosInstance from '../../api/axios';
import * as vehicleApi from '../../api/vehicleApi';
import CustomDatePicker from '../../components/ui/CustomDatePicker';
import { exportToExcel, exportToPDF, exportToCSV } from '../../utils/exportUtils';
import { formatLocalTime, formatLocalDate } from '../../utils/dateUtils';
import { formatRadius, isPointInPolygon } from '../../utils/geofenceUtils';

// Helper Haversine formula
function getHaversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function checkInsideGeofence(lat, lng, geo) {
  if (!geo || lat == null || lng == null) return false;
  if (geo.type === 'circle') {
    const cLat = Number(geo.center_lat);
    const cLng = Number(geo.center_lng);
    const radius = Number(geo.radius) || 200;
    if (isNaN(cLat) || isNaN(cLng)) return false;
    return getHaversineDistanceMeters(lat, lng, cLat, cLng) <= radius;
  }
  // Polygon
  let coords = geo.coordinates;
  if (typeof coords === 'string') {
    try { coords = JSON.parse(coords); } catch (_) { coords = []; }
  }
  return isPointInPolygon(lat, lng, coords || []);
}

function formatDurationHuman(seconds) {
  const s = Math.round(seconds || 0);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

const GeofenceSinglePlaceReportPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const qVehicleId = searchParams.get('vehicleId');
  const qGeofenceId = searchParams.get('geofenceId');

  const [vehicles, setVehicles] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const allGeofencesRef = useRef([]);
  const isInitialVehicleFetch = useRef(true);

  // Filters
  const [selectedVehicleId, setSelectedVehicleId] = useState(qVehicleId || '');
  const [selectedGeofenceId, setSelectedGeofenceId] = useState(qGeofenceId || '');

  // Defaults: Today 00:00 to 23:59
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0);
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59);

  const formatDateForPicker = (d) => {
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    const hr = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${yr}-${mo}-${da}T${hr}:${mi}`;
  };

  const [startDate, setStartDate] = useState(formatDateForPicker(startOfDay));
  const [endDate, setEndDate] = useState(formatDateForPicker(endOfDay));

  const [tableSearch, setTableSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState([]);
  const [summary, setSummary] = useState({
    total_entries: 0,
    total_exits: 0,
    currently_inside: 0,
    total_stay_seconds: 0,
    total_stay_formatted: '0s',
  });
  const [hasGenerated, setHasGenerated] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Initial load
  useEffect(() => {
    let mounted = true;
    const initData = async () => {
      setLoadingInitial(true);
      try {
        const [vRes, gRes] = await Promise.all([
          vehicleApi.getVehicles({ t: Date.now() }),
          axiosInstance.get('/api/admin/geofences').catch(() => axiosInstance.get('/api/geofences')),
        ]);

        if (mounted) {
          if (vRes?.success) {
            setVehicles(vRes.data || []);
          } else if (Array.isArray(vRes)) {
            setVehicles(vRes);
          }
          const rawG = gRes?.data?.data || gRes?.data || [];
          const list = Array.isArray(rawG) ? rawG : [];
          allGeofencesRef.current = list;

          if (selectedVehicleId) {
            try {
              const vgRes = await axiosInstance.get(`/api/vehicles/${selectedVehicleId}/geofences`);
              const vListG = vgRes.data?.data || [];
              setGeofences(vListG);
              if (vListG.length > 0) {
                setSelectedGeofenceId((prev) => vListG.some((g) => String(g.id) === String(prev)) ? prev : String(vListG[0].id));
              } else {
                setSelectedGeofenceId('');
              }
            } catch (vErr) {
              console.warn('Failed to load initial vehicle geofences:', vErr);
              setGeofences([]);
              setSelectedGeofenceId('');
            }
          } else {
            setGeofences(list);
            if (list.length > 0 && !selectedGeofenceId && !qGeofenceId) {
              setSelectedGeofenceId(String(list[0].id));
            }
          }
        }
      } catch (err) {
        console.error('Failed to load initial prerequisites:', err);
      } finally {
        if (mounted) setLoadingInitial(false);
      }
    };
    initData();
    return () => { mounted = false; };
  }, []);

  // Update geofences whenever user changes selected vehicle
  useEffect(() => {
    if (isInitialVehicleFetch.current) {
      isInitialVehicleFetch.current = false;
      return;
    }
    let active = true;
    const fetchForVehicle = async () => {
      if (selectedVehicleId) {
        try {
          const res = await axiosInstance.get(`/api/vehicles/${selectedVehicleId}/geofences`);
          if (!active) return;
          const assignedList = res.data?.data || [];
          setGeofences(assignedList);
          setSelectedGeofenceId((prev) => {
            if (assignedList.some((g) => String(g.id) === String(prev))) return prev;
            return assignedList.length > 0 ? String(assignedList[0].id) : '';
          });
        } catch (err) {
          console.warn('Failed to load vehicle geofences:', err);
          if (active) {
            setGeofences([]);
            setSelectedGeofenceId('');
          }
        }
      } else {
        let orgList = allGeofencesRef.current || [];
        if (orgList.length === 0) {
          try {
            const res = await axiosInstance.get('/api/admin/geofences').catch(() => axiosInstance.get('/api/geofences'));
            orgList = res?.data?.data || res?.data || [];
            allGeofencesRef.current = orgList;
          } catch (_) {}
        }
        if (!active) return;
        setGeofences(orgList);
        setSelectedGeofenceId((prev) => {
          if (orgList.some((g) => String(g.id) === String(prev))) return prev;
          return orgList.length > 0 ? String(orgList[0].id) : '';
        });
      }
    };
    fetchForVehicle();
    return () => { active = false; };
  }, [selectedVehicleId]);

  // Generate Report
  const handleGenerate = async () => {
    if (!startDate || !endDate) {
      setErrorMsg('Please select both Start Date and End Date.');
      return;
    }
    setErrorMsg('');
    setLoading(true);
    setHasGenerated(true);

    try {
      const params = new URLSearchParams();
      params.append('startDate', new Date(startDate).toISOString());
      params.append('endDate', new Date(endDate).toISOString());
      if (selectedVehicleId) params.append('vehicleId', selectedVehicleId);
      if (selectedGeofenceId) params.append('geofenceId', selectedGeofenceId);

      let fetchedData = null;
      let fetchedSummary = null;

      try {
        const res = await axiosInstance.get(`/api/reports/geofence-single-place?${params.toString()}`);
        if (res.data?.success) {
          fetchedData = res.data.data || [];
          fetchedSummary = res.data.summary || null;
        }
      } catch (reqErr) {
        // Fallback if backend route not restarted yet
        if (reqErr.response?.status !== 404) {
          throw reqErr;
        }
      }

      // Client-side computation fallback if needed
      if (!fetchedData) {
        const targetGeos = selectedGeofenceId
          ? geofences.filter((g) => String(g.id) === String(selectedGeofenceId))
          : geofences;

        const targetVehs = selectedVehicleId
          ? vehicles.filter((v) => String(v.id) === String(selectedVehicleId))
          : vehicles;

        const allRows = [];
        let totalEntries = 0;
        let totalExits = 0;
        let currentlyInside = 0;
        let totalStaySeconds = 0;

        for (const v of targetVehs) {
          try {
            const hRes = await axiosInstance.get(
              `/api/vehicles/${v.id}/history?startDate=${new Date(startDate).toISOString()}&endDate=${new Date(endDate).toISOString()}`
            );
            const points = hRes.data?.data || [];
            if (!Array.isArray(points) || points.length === 0) continue;

            for (const g of targetGeos) {
              let inside = false;
              let entryPt = null;

              for (let i = 0; i < points.length; i++) {
                const pt = points[i];
                const isPtIn = checkInsideGeofence(pt.lat, pt.lng, g);

                if (!inside && isPtIn) {
                  inside = true;
                  entryPt = pt;
                  totalEntries++;
                } else if (inside && !isPtIn) {
                  inside = false;
                  totalExits++;
                  const exitPt = pt;
                  const durSec = Math.max(0, (new Date(exitPt.device_time) - new Date(entryPt.device_time)) / 1000);
                  totalStaySeconds += durSec;

                  allRows.push({
                    vehicle_id: v.id,
                    vehicle_name: v.name || v.plate || 'Vehicle',
                    plate: v.plate || '-',
                    geofence_id: g.id,
                    geofence_name: g.name,
                    entry_time: entryPt.device_time,
                    exit_time: exitPt.device_time,
                    duration_seconds: Math.round(durSec),
                    duration_formatted: formatDurationHuman(durSec),
                    status: 'exited',
                    status_label: 'Exited',
                  });
                  entryPt = null;
                }
              }

              if (inside && entryPt) {
                currentlyInside++;
                const lastPt = points[points.length - 1];
                const durSec = Math.max(0, (new Date(lastPt.device_time) - new Date(entryPt.device_time)) / 1000);
                totalStaySeconds += durSec;

                allRows.push({
                  vehicle_id: v.id,
                  vehicle_name: v.name || v.plate || 'Vehicle',
                  plate: v.plate || '-',
                  geofence_id: g.id,
                  geofence_name: g.name,
                  entry_time: entryPt.device_time,
                  exit_time: null,
                  duration_seconds: Math.round(durSec),
                  duration_formatted: `${formatDurationHuman(durSec)} (Ongoing)`,
                  status: 'inside',
                  status_label: 'Currently Inside',
                });
              }
            }
          } catch (_) {}
        }

        allRows.sort((a, b) => new Date(b.entry_time) - new Date(a.entry_time));
        fetchedData = allRows;
        fetchedSummary = {
          total_entries: totalEntries,
          total_exits: totalExits,
          currently_inside: currentlyInside,
          total_stay_seconds: Math.round(totalStaySeconds),
          total_stay_formatted: formatDurationHuman(totalStaySeconds),
        };
      }

      setReportData(fetchedData || []);
      setSummary(
        fetchedSummary || {
          total_entries: 0,
          total_exits: 0,
          currently_inside: 0,
          total_stay_seconds: 0,
          total_stay_formatted: '0s',
        }
      );
    } catch (err) {
      console.error('Single place geofence report query error:', err);
      setErrorMsg(err.response?.data?.error || 'Failed to generate report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Filtered rows for client-side search
  const filteredRows = useMemo(() => {
    if (!tableSearch.trim()) return reportData;
    const q = tableSearch.toLowerCase();
    return reportData.filter(
      (r) =>
        r.vehicle_name?.toLowerCase().includes(q) ||
        r.plate?.toLowerCase().includes(q) ||
        r.geofence_name?.toLowerCase().includes(q)
    );
  }, [reportData, tableSearch]);

  // Export handlers
  const exportColumns = [
    'S.No',
    'Vehicle Name',
    'Plate',
    'Geofence (Place) Name',
    'Entry Date & Time',
    'Exit Date & Time',
    'Stay Duration',
    'Status',
  ];

  const getExportData = () => {
    return filteredRows.map((row, idx) => ({
      'S.No': idx + 1,
      'Vehicle Name': row.vehicle_name || '-',
      'Plate': row.plate || '-',
      'Geofence (Place) Name': row.geofence_name || '-',
      'Entry Date & Time': formatLocalTime(row.entry_time),
      'Exit Date & Time': row.exit_time ? formatLocalTime(row.exit_time) : 'Still Inside',
      'Stay Duration': row.duration_formatted || '-',
      'Status': row.status_label || (row.status === 'inside' ? 'Currently Inside' : 'Exited'),
    }));
  };

  return (
    <div
      style={{
        padding: '24px',
        background: '#F8FAFC',
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            type="button"
            onClick={() => navigate('/admin/reports/daily-trip')}
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              padding: '8px',
              borderRadius: '8px',
              cursor: 'pointer',
              color: '#64748B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
            title="Back to Reports"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1
                style={{
                  fontSize: '20px',
                  fontWeight: 800,
                  color: '#0F172A',
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}
              >
                Single Place Geofence In/Out Report
              </h1>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  background: '#CCFBF1',
                  color: '#0D9488',
                  padding: '3px 8px',
                  borderRadius: '99px',
                }}
              >
                Entry / Exit Analytics
              </span>
            </div>
            <p style={{ fontSize: '13px', color: '#64748B', margin: '2px 0 0 0' }}>
              Track exact entry timestamp, exit timestamp, stay duration, and total entry/exit counts for any specific place.
            </p>
          </div>
        </div>

        {/* Export Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => exportToCSV(getExportData(), 'geofence_single_place_report')}
            disabled={reportData.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#334155',
              cursor: reportData.length === 0 ? 'not-allowed' : 'pointer',
              opacity: reportData.length === 0 ? 0.6 : 1,
            }}
          >
            <FileText size={14} color="#64748B" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={() => exportToExcel(getExportData(), 'geofence_single_place_report', 'Geofence In Out')}
            disabled={reportData.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#16A34A',
              cursor: reportData.length === 0 ? 'not-allowed' : 'pointer',
              opacity: reportData.length === 0 ? 0.6 : 1,
            }}
          >
            <FileSpreadsheet size={14} color="#16A34A" />
            <span>Excel</span>
          </button>

          <button
            type="button"
            onClick={() =>
              exportToPDF(
                exportColumns,
                getExportData(),
                'geofence_single_place_report',
                'Single Place Geofence Entry/Exit Report'
              )
            }
            disabled={reportData.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#DC2626',
              cursor: reportData.length === 0 ? 'not-allowed' : 'pointer',
              opacity: reportData.length === 0 ? 0.6 : 1,
            }}
          >
            <Download size={14} color="#DC2626" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        {/* Total Entries */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#16A34A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Times Entered
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>
              {summary.total_entries || 0}
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
              Entry events in selected range
            </div>
          </div>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: '#DCFCE7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#16A34A',
            }}
          >
            <ArrowDownRight size={22} />
          </div>
        </div>

        {/* Total Exits */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Times Exited
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>
              {summary.total_exits || 0}
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
              Exit events in selected range
            </div>
          </div>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: '#FEF3C7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#D97706',
            }}
          >
            <ArrowUpRight size={22} />
          </div>
        </div>

        {/* Currently Inside */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#0284C7', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Currently Inside Place
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>
              {summary.currently_inside || 0}
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
              Entered and not yet exited
            </div>
          </div>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: '#E0F2FE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0284C7',
            }}
          >
            <MapPin size={22} />
          </div>
        </div>

        {/* Total Stay Duration */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Stay Duration
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', marginTop: '6px' }}>
              {summary.total_stay_formatted || '0s'}
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
              Total time parked / inside place
            </div>
          </div>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: '#EDE9FE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#7C3AED',
            }}
          >
            <Clock size={22} />
          </div>
        </div>
      </div>

      {/* Filter Control Card */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid #E2E8F0',
          padding: '18px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          gap: '16px',
        }}
      >
        {/* Single Geofence (Place) Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '220px', flex: 1 }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
            Select Single Geofence (Place)
          </label>
          <select
            value={selectedGeofenceId}
            onChange={(e) => setSelectedGeofenceId(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#0F172A',
              fontSize: '13px',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            {geofences.length === 0 ? (
              <option value="">
                {selectedVehicleId ? '-- No Geofences Assigned to This Vehicle --' : '-- No Geofences Found --'}
              </option>
            ) : (
              <>
                <option value="">{selectedVehicleId ? 'All Assigned Geofences' : 'All Geofences'}</option>
                {geofences.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.type === 'circle' ? `Circle • ${formatRadius(g.radius)}` : 'Polygon'})
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

        {/* Vehicle Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '200px', flex: 1 }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
            Select Vehicle
          </label>
          <select
            value={selectedVehicleId}
            onChange={(e) => setSelectedVehicleId(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#0F172A',
              fontSize: '13px',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            <option value="">All Vehicles</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name || 'Vehicle'}
              </option>
            ))}
          </select>
        </div>

        {/* Start Date & Time */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '170px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
            Start Date & Time
          </label>
          <CustomDatePicker
            showTime
            value={startDate}
            onChange={(e) => setStartDate(e?.target ? e.target.value : e)}
          />
        </div>

        {/* End Date & Time */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '170px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
            End Date & Time
          </label>
          <CustomDatePicker
            showTime
            value={endDate}
            onChange={(e) => setEndDate(e?.target ? e.target.value : e)}
          />
        </div>

        {/* Generate Button */}
        <div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#0D9488',
              color: '#FFFFFF',
              border: 'none',
              padding: '9px 20px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 6px rgba(13, 148, 136, 0.25)',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#0F766E')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#0D9488')}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            <span>Generate Report</span>
          </button>
        </div>
      </div>

      {/* Error alert */}
      {errorMsg && (
        <div
          style={{
            padding: '12px 16px',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '10px',
            color: '#DC2626',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px',
          }}
        >
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Table Section */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        {/* Table Search bar */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid #F1F5F9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ position: 'relative', maxWidth: '320px', width: '100%' }}>
            <input
              type="text"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Filter by vehicle, plate, or place..."
              style={{
                width: '100%',
                padding: '7px 10px 7px 32px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '12px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          </div>

          <div style={{ fontSize: '12px', color: '#64748B' }}>
            Showing <strong>{filteredRows.length}</strong> records
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748B' }}>
            <Loader2 size={32} color="#0D9488" className="animate-spin" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: '13px', fontWeight: 600 }}>Analyzing vehicle GPS trajectories for geofence entry/exit events...</div>
          </div>
        ) : filteredRows.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748B' }}>
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: '#F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
              }}
            >
              <Compass size={28} color="#94A3B8" />
            </div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
              {hasGenerated ? 'No Entry/Exit Events Found' : 'Ready to Generate Report'}
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748B', maxWidth: '420px', margin: '0 auto' }}>
              {hasGenerated
                ? 'No vehicle was recorded entering or exiting the selected geofence in this date/time range.'
                : 'Select your single place, vehicle, and date range above, then click "Generate Report".'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', width: '60px' }}>S.No</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>Vehicle Name</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>Geofence (Place) Name</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>Entry Timestamp (Date & Time)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>Exit Timestamp (Date & Time)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>Stay Duration Inside</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => {
                  const isInside = row.status === 'inside';
                  return (
                    <tr
                      key={`${row.vehicle_id}-${row.entry_time}-${idx}`}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        transition: 'background 0.1s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* S.No */}
                      <td style={{ padding: '14px 16px', color: '#64748B', fontWeight: 600 }}>
                        {idx + 1}
                      </td>

                      {/* Vehicle Name */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '6px',
                              background: '#F1F5F9',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Truck size={14} color="#0284C7" />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#0F172A' }}>{row.vehicle_name}</div>
                          </div>
                        </div>
                      </td>

                      {/* Geofence Name */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: '#0D9488',
                            }}
                          />
                          <span style={{ fontWeight: 600, color: '#0F172A' }}>{row.geofence_name}</span>
                        </div>
                      </td>

                      {/* Entry Timestamp */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#166534' }}>
                          <LogIn size={14} color="#16A34A" />
                          <span style={{ fontWeight: 700, color: '#0F172A' }}>{formatLocalTime(row.entry_time)}</span>
                        </div>
                      </td>

                      {/* Exit Timestamp */}
                      <td style={{ padding: '14px 16px' }}>
                        {row.exit_time ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#92400E' }}>
                            <LogOut size={14} color="#D97706" />
                            <span style={{ fontWeight: 700, color: '#0F172A' }}>{formatLocalTime(row.exit_time)}</span>
                          </div>
                        ) : (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              background: '#DCFCE7',
                              color: '#15803D',
                              padding: '3px 8px',
                              borderRadius: '6px',
                            }}
                          >
                            Still Inside Place
                          </span>
                        )}
                      </td>

                      {/* Stay Duration Inside */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={14} color="#7C3AED" />
                          <span style={{ fontWeight: 600, color: '#0F172A' }}>
                            {row.duration_formatted}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 16px' }}>
                        {isInside ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: '#ECFDF5',
                              color: '#059669',
                              border: '1px solid #A7F3D0',
                              padding: '3px 8px',
                              borderRadius: '99px',
                            }}
                          >
                            <span
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: '#10B981',
                              }}
                            />
                            Currently Inside
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              background: '#F1F5F9',
                              color: '#475569',
                              padding: '3px 8px',
                              borderRadius: '99px',
                            }}
                          >
                            <CheckCircle2 size={12} color="#64748B" />
                            Exited
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default GeofenceSinglePlaceReportPage;
