import React, { useState, useEffect } from 'react';
import CustomDatePicker from '../../components/ui/CustomDatePicker';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Search, Loader2, Users, Filter, FileText, Calendar, Info } from 'lucide-react';
import axiosInstance from '../../api/axios';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';
import AddressText from '../../components/ui/AddressText';

const ConsolidatedReportPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Filters
  const [filters, setFilters] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

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
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    'Vehicle Name', 'Total Distance (km)', 
    'Running Time', 'Idle Time', 'Stopped Time', 'Engine On (hrs)',
    'Start Fuel (L)', 'End Fuel (L)', 'Consumption (L)', 
    'Filling (L)', 'Theft / Drain (L)', 'KMPL', 'LPH',
    'From Location', 'To Location'
  ];

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

  const getExportData = () => {
    return data.map(row => ({
      'Vehicle Name': row.vehicle_name || '-',
      'Total Distance (km)': row.distance_travelled || 0,
      'Running Time': formatDuration(row.running_seconds),
      'Idle Time': formatDuration(row.idle_seconds),
      'Stopped Time': formatDuration(row.stopped_seconds),
      'Engine On (hrs)': row.engine_on_seconds ? (row.engine_on_seconds / 3600).toFixed(1) : '0.0',
      'Start Fuel (L)': row.start_fuel !== null && row.start_fuel !== undefined ? parseFloat(row.start_fuel).toFixed(1) : '-',
      'End Fuel (L)': row.end_fuel !== null && row.end_fuel !== undefined ? parseFloat(row.end_fuel).toFixed(1) : '-',
      'Consumption (L)': row.consumption !== null && row.consumption !== undefined ? parseFloat(row.consumption).toFixed(1) : '-',
      'Filling (L)': row.total_refill !== null && row.total_refill !== undefined ? parseFloat(row.total_refill).toFixed(1) : '-',
      'Theft / Drain (L)': row.total_theft !== null && row.total_theft !== undefined ? parseFloat(row.total_theft).toFixed(1) : '-',
      'KMPL': row.kmpl !== null && row.kmpl !== undefined ? parseFloat(row.kmpl).toFixed(2) : '-',
      'LPH': row.lph !== null && row.lph !== undefined ? parseFloat(row.lph).toFixed(2) : '-',
      'From Latitude': row.start_lat || '-',
      'From Longitude': row.start_lng || '-',
      'To Latitude': row.end_lat || '-',
      'To Longitude': row.end_lng || '-'
    }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', boxSizing: 'border-box', color: '#0F172A', padding: '16px' }}>

      {/* Filters Bar */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px', padding: '10px 16px', background: '#fff', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={14} color="#2563EB" />
          </div>
          <CustomDatePicker value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #E2E8F0', outline: 'none', background: '#FAFAFA', color: '#0F172A', fontSize: '13px', fontWeight: 500, width: '140px', boxSizing: 'border-box' }} />
          <span style={{ color: '#94A3B8', fontSize: '12px', fontWeight: 700 }}>→</span>
          <CustomDatePicker value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #E2E8F0', outline: 'none', background: '#FAFAFA', color: '#0F172A', fontSize: '13px', fontWeight: 500, width: '140px', boxSizing: 'border-box' }} />
        </div>
        <button onClick={handleGenerate} disabled={loading} style={{ padding: '8px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#FFF', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', boxShadow: '0 2px 8px rgba(22,163,74,0.3)', marginLeft: 'auto' }}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Generate
        </button>
      </div>

      {/* Helper text for desktop table scroll */}
      {!isMobile && data.length > 0 && (
        <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', background: '#F8FAFC', padding: '8px 12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
          <Info size={14} color="#3B82F6" />
          <span>Swipe left/right on table to view all columns</span>
        </div>
      )}

      {/* Results Header */}
      <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>Report Results <span style={{ color: '#64748B', fontWeight: 500, fontSize: '13px', marginLeft: '8px' }}>({data.length} records)</span></div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => exportToPDF(columns.map(c => c.replace(' (L)', '').replace(' (km)', '').replace(' (hrs)', '')), getExportData(), 'Consolidated Report', 'consolidated_report')} disabled={data.length === 0} style={{ padding: '8px 16px', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: data.length ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px', opacity: data.length ? 1 : 0.5 }}>
              <FileText size={16} color="#DC2626" /> PDF
            </button>
            <button onClick={() => exportToExcel(getExportData(), 'consolidated_report')} disabled={data.length === 0} style={{ padding: '8px 16px', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: data.length ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px', opacity: data.length ? 1 : 0.5 }}>
              <Download size={16} color="#10B981" /> Excel
            </button>
          </div>
        </div>

        {/* Dynamic Responsive Rendering */}
        <div style={{ flex: 1, padding: isMobile ? '16px' : '0' }}>
          {data.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#94A3B8', fontSize: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <Filter size={32} style={{ opacity: 0.5 }} />
              No data found for the selected criteria.
            </div>
          ) : isMobile ? (
            /* Cards layout for Mobile */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px', background: '#F8FAFC', padding: '8px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '8px' }}>
                <Info size={14} color="#3B82F6" />
                <span>Swipe left/right on table to view all columns</span>
              </div>
              {data.map((row, idx) => (
                <div key={idx} style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  
                  {/* Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>{row.vehicle_name || '-'}</div>
                    </div>
                    <span style={{ background: '#EFF6FF', color: '#2563EB', fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '6px' }}>Consolidated</span>
                  </div>

                  {/* Period */}
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '-4px' }}>
                    Period: {formatPeriodDate(filters.startDate)} 12:00 AM → {formatPeriodDate(filters.endDate)} 11:59 PM
                  </div>

                  {/* Operational Summary Section */}
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

                  {/* Fuel & Efficiency Section */}
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

                  {/* Location Bounds Section */}
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

                </div>
              ))}
            </div>
          ) : (
            /* Table layout for Desktop */
            <div style={{ overflowX: 'auto', flex: 1 }}>
              <table className="report-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1600px' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    {columns.map(c => <th key={c} style={{ padding: '14px 24px', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '14px 24px', fontSize: '13px', fontWeight: 600, color: '#111827' }}>{row.vehicle_name || '-'}</td>
                      <td style={{ padding: '14px 24px', fontSize: '13px', color: '#475569', fontWeight: 600 }}>{row.distance_travelled || 0} km</td>
                      <td style={{ padding: '14px 24px', fontSize: '13px', color: '#10B981' }}>{formatDuration(row.running_seconds)}</td>
                      <td style={{ padding: '14px 24px', fontSize: '13px', color: '#F59E0B' }}>{formatDuration(row.idle_seconds)}</td>
                      <td style={{ padding: '14px 24px', fontSize: '13px', color: '#64748B' }}>{formatDuration(row.stopped_seconds)}</td>
                      <td style={{ padding: '14px 24px', fontSize: '13px', color: '#3B82F6', fontWeight: 600 }}>{formatEngineOn(row.engine_on_seconds)}</td>
                      <td style={{ padding: '14px 24px', fontSize: '13px', color: '#475569' }}>{row.start_fuel !== null && row.start_fuel !== undefined ? `${parseFloat(row.start_fuel).toFixed(1)} L` : '-'}</td>
                      <td style={{ padding: '14px 24px', fontSize: '13px', color: '#475569' }}>{row.end_fuel !== null && row.end_fuel !== undefined ? `${parseFloat(row.end_fuel).toFixed(1)} L` : '-'}</td>
                      <td style={{ padding: '14px 24px', fontSize: '13px', color: '#EF4444', fontWeight: 600 }}>{row.consumption !== null && row.consumption !== undefined ? `${parseFloat(row.consumption).toFixed(1)} L` : '-'}</td>
                      <td style={{ padding: '14px 24px', fontSize: '13px', color: '#10B981' }}>{row.total_refill !== null && row.total_refill !== undefined ? `${parseFloat(row.total_refill).toFixed(1)} L` : '-'}</td>
                      <td style={{ padding: '14px 24px', fontSize: '13px', color: '#EF4444' }}>{row.total_theft !== null && row.total_theft !== undefined ? `${parseFloat(row.total_theft).toFixed(1)} L` : '-'}</td>
                      <td style={{ padding: '14px 24px', fontSize: '13px', color: '#6366F1', fontWeight: 600 }}>{row.kmpl !== null && row.kmpl !== undefined ? `${parseFloat(row.kmpl).toFixed(2)}` : '-'}</td>
                      <td style={{ padding: '14px 24px', fontSize: '13px', color: '#EC4899', fontWeight: 600 }}>{row.lph !== null && row.lph !== undefined ? `${parseFloat(row.lph).toFixed(2)}` : '-'}</td>
                      <td style={{ padding: '14px 24px', fontSize: '12px', color: '#64748B', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.start_lat && row.start_lng ? <AddressText lat={row.start_lat} lng={row.start_lng} /> : 'Location unavailable'}
                      </td>
                      <td style={{ padding: '14px 24px', fontSize: '12px', color: '#64748B', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.end_lat && row.end_lng ? <AddressText lat={row.end_lat} lng={row.end_lng} /> : 'Location unavailable'}
                      </td>
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
