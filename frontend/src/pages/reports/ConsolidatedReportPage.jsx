import React, { useState, useEffect, useMemo } from 'react';
import CustomDatePicker from '../../components/ui/CustomDatePicker';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Download, Search, Loader2, Users, Filter, FileText,
  Calendar, Info, Truck, Fuel, BarChart3, Navigation, Clock,
  PauseCircle, PlayCircle, Zap, Droplet, AlertTriangle
} from 'lucide-react';
import axiosInstance from '../../api/axios';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';
import AddressText from '../../components/ui/AddressText';
import { getLocalDateString } from '../../utils/dateUtils';

const formatDuration = (seconds) => {
  if (!seconds) return '0m';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins}m`;
};

const formatEngineOn = (seconds) => {
  if (!seconds) return '0.0 h';
  return `${(seconds / 3600).toFixed(1)} h`;
};

const formatPeriodDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
};

const VEHICLE_COLUMNS = [
  'Vehicle Name', 'Total Distance (km)', 'Running Time',
  'Idle Time', 'Stopped Time', 'Engine On (hrs)',
  'From Location', 'To Location'
];

const FUEL_COLUMNS = [
  'Vehicle Name', 'Total Distance (km)', 'Engine On (hrs)',
  'Start Fuel (L)', 'End Fuel (L)', 'Consumption (L)',
  'Filling (L)', 'Theft / Drain (L)', 'KMPL', 'LPH'
];

const ALL_COLUMNS = [
  'Vehicle Name', 'Total Distance (km)', 
  'Running Time', 'Idle Time', 'Stopped Time', 'Engine On (hrs)',
  'Start Fuel (L)', 'End Fuel (L)', 'Consumption (L)', 
  'Filling (L)', 'Theft / Drain (L)', 'KMPL', 'LPH',
  'From Location', 'To Location'
];

const ConsolidatedReportPage = ({ defaultMode }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine initial mode based on route or prop
  const initialMode = useMemo(() => {
    if (defaultMode) return defaultMode;
    if (location.pathname.includes('/fuel-consolidated')) return 'fuel';
    return 'vehicle';
  }, [defaultMode, location.pathname]);

  const [mode, setMode] = useState(initialMode);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Keep mode in sync with route changes
  useEffect(() => {
    if (location.pathname.includes('/fuel-consolidated')) {
      setMode('fuel');
    } else if (location.pathname.includes('/consolidated')) {
      setMode(defaultMode || 'vehicle');
    }
  }, [location.pathname, defaultMode]);

  // Filters default to today local date
  const [filters, setFilters] = useState(() => ({
    startDate: getLocalDateString(new Date()),
    endDate: getLocalDateString(new Date())
  }));

  // Track mobile layout
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleGenerate = async () => {
    if (!filters.startDate || !filters.endDate) return;
    setLoading(true);
    try {
      const start = new Date(filters.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);

      const params = new URLSearchParams();
      params.append('startDate', start.toISOString());
      params.append('endDate', end.toISOString());

      const res = await axiosInstance.get(`/api/reports/consolidated?${params.toString()}`);
      if (res.data?.success) {
        setData(res.data.data || []);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  // Metrics summary based on mode
  const metrics = useMemo(() => {
    let totalDist = 0;
    let totalRunningSec = 0;
    let totalIdleSec = 0;
    let totalStoppedSec = 0;
    let totalEngineOnSec = 0;
    let totalConsumption = 0;
    let totalRefill = 0;
    let totalTheft = 0;
    let validKmplCount = 0;
    let sumKmpl = 0;

    data.forEach(row => {
      totalDist += parseFloat(row.distance_travelled || 0);
      totalRunningSec += parseFloat(row.running_seconds || 0);
      totalIdleSec += parseFloat(row.idle_seconds || 0);
      totalStoppedSec += parseFloat(row.stopped_seconds || 0);
      totalEngineOnSec += parseFloat(row.engine_on_seconds || 0);
      totalConsumption += parseFloat(row.consumption || 0);
      totalRefill += parseFloat(row.total_refill || 0);
      totalTheft += parseFloat(row.total_theft || 0);
      if (row.kmpl && !isNaN(parseFloat(row.kmpl)) && parseFloat(row.kmpl) > 0) {
        sumKmpl += parseFloat(row.kmpl);
        validKmplCount++;
      }
    });

    return {
      distance: totalDist.toFixed(1),
      running: formatDuration(totalRunningSec),
      idle: formatDuration(totalIdleSec),
      stopped: formatDuration(totalStoppedSec),
      engineOn: formatEngineOn(totalEngineOnSec),
      consumption: totalConsumption.toFixed(1),
      refill: totalRefill.toFixed(1),
      theft: totalTheft.toFixed(1),
      avgKmpl: validKmplCount > 0 ? (sumKmpl / validKmplCount).toFixed(2) : '-'
    };
  }, [data]);

  const activeColumns = useMemo(() => {
    if (mode === 'vehicle') return VEHICLE_COLUMNS;
    if (mode === 'fuel') return FUEL_COLUMNS;
    return ALL_COLUMNS;
  }, [mode]);

  const getExportData = () => {
    return data.map(row => {
      const base = {
        'Vehicle Name': row.vehicle_name || '-'
      };

      if (mode === 'vehicle' || mode === 'all') {
        base['Total Distance (km)'] = row.distance_travelled || 0;
        base['Running Time'] = formatDuration(row.running_seconds);
        base['Idle Time'] = formatDuration(row.idle_seconds);
        base['Stopped Time'] = formatDuration(row.stopped_seconds);
        base['Engine On (hrs)'] = row.engine_on_seconds ? (row.engine_on_seconds / 3600).toFixed(1) : '0.0';
      }

      if (mode === 'fuel' || mode === 'all') {
        if (mode === 'fuel') {
          base['Total Distance (km)'] = row.distance_travelled || 0;
          base['Engine On (hrs)'] = row.engine_on_seconds ? (row.engine_on_seconds / 3600).toFixed(1) : '0.0';
        }
        base['Start Fuel (L)'] = row.start_fuel !== null && row.start_fuel !== undefined ? parseFloat(row.start_fuel).toFixed(1) : '-';
        base['End Fuel (L)'] = row.end_fuel !== null && row.end_fuel !== undefined ? parseFloat(row.end_fuel).toFixed(1) : '-';
        base['Consumption (L)'] = row.consumption !== null && row.consumption !== undefined ? parseFloat(row.consumption).toFixed(1) : '-';
        base['Filling (L)'] = row.total_refill !== null && row.total_refill !== undefined ? parseFloat(row.total_refill).toFixed(1) : '-';
        base['Theft / Drain (L)'] = row.total_theft !== null && row.total_theft !== undefined ? parseFloat(row.total_theft).toFixed(1) : '-';
        base['KMPL'] = row.kmpl !== null && row.kmpl !== undefined ? parseFloat(row.kmpl).toFixed(2) : '-';
        base['LPH'] = row.lph !== null && row.lph !== undefined ? parseFloat(row.lph).toFixed(2) : '-';
      }

      if (mode === 'vehicle' || mode === 'all') {
        base['From Latitude'] = row.start_lat || '-';
        base['From Longitude'] = row.start_lng || '-';
        base['To Latitude'] = row.end_lat || '-';
        base['To Longitude'] = row.end_lng || '-';
      }

      return base;
    });
  };

  const reportTitle = mode === 'vehicle' 
    ? 'Vehicle Consolidated Report' 
    : (mode === 'fuel' ? 'Fuel Consolidated Report' : 'Consolidated Fleet Report');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', boxSizing: 'border-box', color: '#0F172A', padding: '16px' }}>

      {/* Top Switcher Bar between Vehicle & Fuel Consolidated */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '16px'
      }}>
        {/* Segmented Control */}
        <div style={{
          display: 'flex',
          background: '#E2E8F0',
          padding: '4px',
          borderRadius: '10px',
          gap: '4px'
        }}>
          <button
            type="button"
            onClick={() => setMode('vehicle')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: mode === 'vehicle' ? '#10B981' : 'transparent',
              color: mode === 'vehicle' ? '#FFFFFF' : '#475569',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: mode === 'vehicle' ? '0 2px 6px rgba(16, 185, 129, 0.3)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Truck size={15} />
            Vehicle Consolidated
          </button>

          <button
            type="button"
            onClick={() => setMode('fuel')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: mode === 'fuel' ? '#EA580C' : 'transparent',
              color: mode === 'fuel' ? '#FFFFFF' : '#475569',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: mode === 'fuel' ? '0 2px 6px rgba(234, 88, 12, 0.3)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Fuel size={15} />
            Fuel Consolidated
          </button>

          <button
            type="button"
            onClick={() => setMode('all')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              background: mode === 'all' ? '#0F172A' : 'transparent',
              color: mode === 'all' ? '#FFFFFF' : '#475569',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: mode === 'all' ? '0 2px 6px rgba(15, 23, 42, 0.3)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <BarChart3 size={15} />
            Combined View
          </button>
        </div>

        {/* Informative Mode Badge */}
        <div style={{
          fontSize: '12px',
          fontWeight: 600,
          color: mode === 'vehicle' ? '#065F46' : (mode === 'fuel' ? '#9A3412' : '#334155'),
          background: mode === 'vehicle' ? '#ECFDF5' : (mode === 'fuel' ? '#FFF7ED' : '#F1F5F9'),
          padding: '6px 12px',
          borderRadius: '8px',
          border: `1px solid ${mode === 'vehicle' ? '#A7F3D0' : (mode === 'fuel' ? '#FED7AA' : '#CBD5E1')}`
        }}>
          {mode === 'vehicle' && 'Showing vehicle activity: distance, running, idle, stoppage & locations'}
          {mode === 'fuel' && 'Showing fuel analytics: start/end fuel, consumption, filling, theft, KMPL & LPH'}
          {mode === 'all' && 'Showing combined telemetry with all vehicle activity and fuel columns'}
        </div>
      </div>

      {/* KPI Cards when data loaded */}
      {data.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: '12px',
          marginBottom: '16px'
        }}>
          {mode === 'vehicle' && (
            <>
              <div style={{ background: '#ECFDF5', padding: '14px 18px', borderRadius: '10px', border: '1px solid #A7F3D0' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>Total Distance</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#065F46', marginTop: '2px' }}>{metrics.distance} km</div>
              </div>
              <div style={{ background: '#F0FDF4', padding: '14px 18px', borderRadius: '10px', border: '1px solid #BBF7D0' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#16A34A', textTransform: 'uppercase' }}>Running Time</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#15803D', marginTop: '2px' }}>{metrics.running}</div>
              </div>
              <div style={{ background: '#FEF3C7', padding: '14px 18px', borderRadius: '10px', border: '1px solid #FDE68A' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#D97706', textTransform: 'uppercase' }}>Idle Time</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#B45309', marginTop: '2px' }}>{metrics.idle}</div>
              </div>
              <div style={{ background: '#FFF7ED', padding: '14px 18px', borderRadius: '10px', border: '1px solid #FFEDD5' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#EA580C', textTransform: 'uppercase' }}>Stopped Time</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#C2410C', marginTop: '2px' }}>{metrics.stopped}</div>
              </div>
            </>
          )}

          {mode === 'fuel' && (
            <>
              <div style={{ background: '#FFF1F2', padding: '14px 18px', borderRadius: '10px', border: '1px solid #FECDD3' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#E11D48', textTransform: 'uppercase' }}>Total Consumption</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#BE123C', marginTop: '2px' }}>{metrics.consumption} L</div>
              </div>
              <div style={{ background: '#ECFDF5', padding: '14px 18px', borderRadius: '10px', border: '1px solid #A7F3D0' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>Total Refill</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#065F46', marginTop: '2px' }}>{metrics.refill} L</div>
              </div>
              <div style={{ background: '#FEF2F2', padding: '14px 18px', borderRadius: '10px', border: '1px solid #FCA5A5' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#DC2626', textTransform: 'uppercase' }}>Total Theft / Drain</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#991B1B', marginTop: '2px' }}>{metrics.theft} L</div>
              </div>
              <div style={{ background: '#EEF2FF', padding: '14px 18px', borderRadius: '10px', border: '1px solid #C7D2FE' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#4F46E5', textTransform: 'uppercase' }}>Avg Mileage (KMPL)</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#3730A3', marginTop: '2px' }}>{metrics.avgKmpl}</div>
              </div>
            </>
          )}

          {mode === 'all' && (
            <>
              <div style={{ background: '#ECFDF5', padding: '14px 18px', borderRadius: '10px', border: '1px solid #A7F3D0' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>Distance</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#065F46', marginTop: '2px' }}>{metrics.distance} km</div>
              </div>
              <div style={{ background: '#F0FDF4', padding: '14px 18px', borderRadius: '10px', border: '1px solid #BBF7D0' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#16A34A', textTransform: 'uppercase' }}>Running</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#15803D', marginTop: '2px' }}>{metrics.running}</div>
              </div>
              <div style={{ background: '#FFF1F2', padding: '14px 18px', borderRadius: '10px', border: '1px solid #FECDD3' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#E11D48', textTransform: 'uppercase' }}>Consumption</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#BE123C', marginTop: '2px' }}>{metrics.consumption} L</div>
              </div>
              <div style={{ background: '#EEF2FF', padding: '14px 18px', borderRadius: '10px', border: '1px solid #C7D2FE' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#4F46E5', textTransform: 'uppercase' }}>Avg Mileage</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#3730A3', marginTop: '2px' }}>{metrics.avgKmpl}</div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Filters Bar */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px', padding: '10px 16px', background: '#fff', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={14} color="#2563EB" />
          </div>
          <CustomDatePicker
            value={filters.startDate}
            onChange={e => setFilters({ ...filters, startDate: e.target.value })}
            style={{ width: '150px' }}
          />
          <span style={{ color: '#94A3B8', fontSize: '12px', fontWeight: 700 }}>→</span>
          <CustomDatePicker
            value={filters.endDate}
            onChange={e => setFilters({ ...filters, endDate: e.target.value })}
            style={{ width: '150px' }}
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          style={{
            padding: '8px 20px',
            borderRadius: '8px',
            background: mode === 'fuel' 
              ? 'linear-gradient(135deg, #ea580c, #c2410c)' 
              : 'linear-gradient(135deg, #22c55e, #16a34a)',
            color: '#FFF',
            border: 'none',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            boxShadow: mode === 'fuel' ? '0 2px 8px rgba(234, 88, 12, 0.3)' : '0 2px 8px rgba(22, 163, 74, 0.3)',
            marginLeft: 'auto'
          }}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Generate
        </button>
      </div>

      {/* Helper text for desktop table scroll */}
      {!isMobile && data.length > 0 && mode === 'all' && (
        <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', background: '#F8FAFC', padding: '8px 12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
          <Info size={14} color="#3B82F6" />
          <span>Swipe left/right on table to view all columns</span>
        </div>
      )}

      {/* Results Header */}
      <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>
            {reportTitle} <span style={{ color: '#64748B', fontWeight: 500, fontSize: '13px', marginLeft: '8px' }}>({data.length} records)</span>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => exportToPDF(activeColumns.map(c => c.replace(' (L)', '').replace(' (km)', '').replace(' (hrs)', '')), getExportData(), reportTitle, reportTitle.toLowerCase().replace(/\s+/g, '_'))}
              disabled={data.length === 0}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                color: '#475569',
                fontSize: '13px',
                fontWeight: 600,
                cursor: data.length ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: data.length ? 1 : 0.5
              }}
            >
              <FileText size={16} color="#DC2626" /> PDF
            </button>
            <button
              onClick={() => exportToExcel(getExportData(), reportTitle.toLowerCase().replace(/\s+/g, '_'))}
              disabled={data.length === 0}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                color: '#475569',
                fontSize: '13px',
                fontWeight: 600,
                cursor: data.length ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: data.length ? 1 : 0.5
              }}
            >
              <Download size={16} color="#10B981" /> Excel
            </button>
          </div>
        </div>

        {/* Dynamic Responsive Rendering */}
        <div style={{ flex: 1, padding: isMobile ? '16px' : '0' }}>
          {data.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#94A3B8', fontSize: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <Filter size={32} style={{ opacity: 0.5 }} />
              No data found for the selected criteria. Click "Generate" to fetch records.
            </div>
          ) : isMobile ? (
            /* Cards layout for Mobile */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {data.map((row, idx) => (
                <div key={idx} style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  
                  {/* Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>{row.vehicle_name || '-'}</div>
                      {row.plate && <div style={{ fontSize: '12px', color: '#64748B' }}>{row.plate}</div>}
                    </div>
                    <span style={{
                      background: mode === 'fuel' ? '#FFF7ED' : '#EFF6FF',
                      color: mode === 'fuel' ? '#EA580C' : '#2563EB',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '4px 8px',
                      borderRadius: '6px'
                    }}>
                      {mode === 'fuel' ? 'Fuel' : (mode === 'vehicle' ? 'Vehicle' : 'Consolidated')}
                    </span>
                  </div>

                  {/* Period */}
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '-4px' }}>
                    Period: {formatPeriodDate(filters.startDate)} → {formatPeriodDate(filters.endDate)}
                  </div>

                  {/* Operational Summary (shown in vehicle or all mode) */}
                  {(mode === 'vehicle' || mode === 'all') && (
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.05em', borderBottom: '1px solid #F1F5F9', paddingBottom: '4px', marginBottom: '10px' }}>OPERATIONAL SUMMARY</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                        <div>
                          <div style={{ fontSize: '9px', fontWeight: 700, color: '#94A3B8' }}>DISTANCE</div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{row.distance_travelled || 0} km</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '9px', fontWeight: 700, color: '#94A3B8' }}>RUNNING TIME</div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#10B981' }}>{formatDuration(row.running_seconds)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '9px', fontWeight: 700, color: '#94A3B8' }}>STOPPING TIME</div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748B' }}>{formatDuration(row.stopped_seconds)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '9px', fontWeight: 700, color: '#94A3B8' }}>IDLE TIME</div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#F59E0B' }}>{formatDuration(row.idle_seconds)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '9px', fontWeight: 700, color: '#94A3B8' }}>ENGINE ON</div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#3B82F6' }}>{formatEngineOn(row.engine_on_seconds)}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Fuel Section (shown in fuel or all mode) */}
                  {(mode === 'fuel' || mode === 'all') && (
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.05em', borderBottom: '1px solid #F1F5F9', paddingBottom: '4px', marginBottom: '10px' }}>FUEL & EFFICIENCY</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                        <div>
                          <div style={{ fontSize: '9px', fontWeight: 700, color: '#94A3B8' }}>START FUEL</div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{row.start_fuel !== null && row.start_fuel !== undefined ? `${parseFloat(row.start_fuel).toFixed(1)} L` : '-'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '9px', fontWeight: 700, color: '#94A3B8' }}>END FUEL</div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{row.end_fuel !== null && row.end_fuel !== undefined ? `${parseFloat(row.end_fuel).toFixed(1)} L` : '-'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '9px', fontWeight: 700, color: '#94A3B8' }}>CONSUMPTION</div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#EF4444' }}>{row.consumption !== null && row.consumption !== undefined ? `${parseFloat(row.consumption).toFixed(1)} L` : '-'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '9px', fontWeight: 700, color: '#94A3B8' }}>FILLING</div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#10B981' }}>{row.total_refill !== null && row.total_refill !== undefined ? `${parseFloat(row.total_refill).toFixed(1)} L` : '-'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '9px', fontWeight: 700, color: '#94A3B8' }}>THEFT / DRAIN</div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#EF4444' }}>{row.total_theft !== null && row.total_theft !== undefined ? `${parseFloat(row.total_theft).toFixed(1)} L` : '-'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '9px', fontWeight: 700, color: '#94A3B8' }}>KMPL</div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#6366F1' }}>{row.kmpl !== null && row.kmpl !== undefined ? `${parseFloat(row.kmpl).toFixed(2)}` : '-'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '9px', fontWeight: 700, color: '#94A3B8' }}>LPH</div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#EC4899' }}>{row.lph !== null && row.lph !== undefined ? `${parseFloat(row.lph).toFixed(2)}` : '-'}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Location Bounds Section (shown in vehicle or all mode) */}
                  {(mode === 'vehicle' || mode === 'all') && (
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.05em', borderBottom: '1px solid #F1F5F9', paddingBottom: '4px', marginBottom: '10px' }}>LOCATION BOUNDS</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '12px', color: '#475569', display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600 }}>From Location:</span>
                          {row.start_lat && row.start_lng ? <AddressText lat={row.start_lat} lng={row.start_lng} /> : <span style={{ color: '#94A3B8', fontStyle: 'italic', fontSize: '11px' }}>Location unavailable</span>}
                        </div>
                        <div style={{ fontSize: '12px', color: '#475569', display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600 }}>To Location:</span>
                          {row.end_lat && row.end_lng ? <AddressText lat={row.end_lat} lng={row.end_lng} /> : <span style={{ color: '#94A3B8', fontStyle: 'italic', fontSize: '11px' }}>Location unavailable</span>}
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              ))}
            </div>
          ) : (
            /* Table layout for Desktop */
            <div style={{ overflowX: 'auto', flex: 1 }}>
              <table
                className="report-table"
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                  minWidth: mode === 'all' ? '1600px' : (mode === 'vehicle' ? '1100px' : '1050px')
                }}
              >
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    {activeColumns.map(c => (
                      <th
                        key={c}
                        style={{
                          padding: '14px 20px',
                          fontSize: '12px',
                          fontWeight: 700,
                          color: '#64748B',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.15s' }}>
                      {/* Vehicle Name */}
                      <td style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap' }}>
                        {row.vehicle_name || '-'}
                      </td>

                      {/* Total Distance (Vehicle & All) */}
                      {(mode === 'vehicle' || mode === 'all') && (
                        <td style={{ padding: '14px 20px', fontSize: '13px', color: '#0F172A', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {row.distance_travelled || 0} km
                        </td>
                      )}

                      {/* Running Time (Vehicle & All) */}
                      {(mode === 'vehicle' || mode === 'all') && (
                        <td style={{ padding: '14px 20px', fontSize: '13px', color: '#10B981', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {formatDuration(row.running_seconds)}
                        </td>
                      )}

                      {/* Idle Time (Vehicle & All) */}
                      {(mode === 'vehicle' || mode === 'all') && (
                        <td style={{ padding: '14px 20px', fontSize: '13px', color: '#F59E0B', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {formatDuration(row.idle_seconds)}
                        </td>
                      )}

                      {/* Stopped Time (Vehicle & All) */}
                      {(mode === 'vehicle' || mode === 'all') && (
                        <td style={{ padding: '14px 20px', fontSize: '13px', color: '#64748B', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {formatDuration(row.stopped_seconds)}
                        </td>
                      )}

                      {/* Engine On (Vehicle & All) */}
                      {(mode === 'vehicle' || mode === 'all') && (
                        <td style={{ padding: '14px 20px', fontSize: '13px', color: '#3B82F6', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {formatEngineOn(row.engine_on_seconds)}
                        </td>
                      )}

                      {/* Total Distance & Engine On for Fuel Mode */}
                      {mode === 'fuel' && (
                        <>
                          <td style={{ padding: '14px 20px', fontSize: '13px', color: '#0F172A', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {row.distance_travelled || 0} km
                          </td>
                          <td style={{ padding: '14px 20px', fontSize: '13px', color: '#3B82F6', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {formatEngineOn(row.engine_on_seconds)}
                          </td>
                        </>
                      )}

                      {/* Fuel Columns (Fuel & All) */}
                      {(mode === 'fuel' || mode === 'all') && (
                        <>
                          <td style={{ padding: '14px 20px', fontSize: '13px', color: '#475569', whiteSpace: 'nowrap' }}>
                            {row.start_fuel !== null && row.start_fuel !== undefined ? `${parseFloat(row.start_fuel).toFixed(1)} L` : '-'}
                          </td>
                          <td style={{ padding: '14px 20px', fontSize: '13px', color: '#475569', whiteSpace: 'nowrap' }}>
                            {row.end_fuel !== null && row.end_fuel !== undefined ? `${parseFloat(row.end_fuel).toFixed(1)} L` : '-'}
                          </td>
                          <td style={{ padding: '14px 20px', fontSize: '13px', color: '#EF4444', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {row.consumption !== null && row.consumption !== undefined ? `${parseFloat(row.consumption).toFixed(1)} L` : '-'}
                          </td>
                          <td style={{ padding: '14px 20px', fontSize: '13px', color: '#10B981', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {row.total_refill !== null && row.total_refill !== undefined ? `${parseFloat(row.total_refill).toFixed(1)} L` : '-'}
                          </td>
                          <td style={{ padding: '14px 20px', fontSize: '13px', color: '#DC2626', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {row.total_theft !== null && row.total_theft !== undefined ? `${parseFloat(row.total_theft).toFixed(1)} L` : '-'}
                          </td>
                          <td style={{ padding: '14px 20px', fontSize: '13px', color: '#6366F1', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {row.kmpl !== null && row.kmpl !== undefined ? `${parseFloat(row.kmpl).toFixed(2)}` : '-'}
                          </td>
                          <td style={{ padding: '14px 20px', fontSize: '13px', color: '#EC4899', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {row.lph !== null && row.lph !== undefined ? `${parseFloat(row.lph).toFixed(2)}` : '-'}
                          </td>
                        </>
                      )}

                      {/* Location Columns (Vehicle & All) */}
                      {(mode === 'vehicle' || mode === 'all') && (
                        <>
                          <td style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.start_lat && row.start_lng ? <AddressText lat={row.start_lat} lng={row.start_lng} /> : 'Location unavailable'}
                          </td>
                          <td style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.end_lat && row.end_lng ? <AddressText lat={row.end_lat} lng={row.end_lng} /> : 'Location unavailable'}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default ConsolidatedReportPage;
