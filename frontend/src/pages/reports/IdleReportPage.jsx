import React, { useState, useEffect } from 'react';
import CustomDatePicker from '../../components/ui/CustomDatePicker';
import { formatLocalTime } from '../../utils/dateUtils';
import { getAddressFromCoordinates } from '../../utils/geocodeUtils';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Search, Loader2, Clock, Filter, FileText, Truck, Calendar } from 'lucide-react';
import axiosInstance from '../../api/axios';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';
import * as vehicleApi from '../../api/vehicleApi';

const formatDuration = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const IdleReportPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);

  // Filters
  const [vehicles, setVehicles] = useState([]);
  const [filters, setFilters] = useState({
    vehicleId: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    vehicleApi.getVehicles({ t: Date.now() })
      .then(res => { if (res.success) setVehicles(res.data); })
      .catch(console.error);
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
      if (filters.vehicleId) params.append('vehicleId', filters.vehicleId);

      const res = await axiosInstance.get(`/api/reports/stoppages?${params.toString()}`);
      if (res.data.success) {
        const reportData = res.data.data;
        // Fetch addresses only for Idle events
        const dataWithAddresses = await Promise.all(reportData.map(async (row) => {
          if (row.status !== 'Idle') return { ...row, address: '-' };
          const address = await getAddressFromCoordinates(row.lat, row.lng);
          return { ...row, address };
        }));

        setData(dataWithAddresses);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const columns = ['Vehicle Name', 'Status', 'Start Time', 'End Time', 'Duration (HH:MM:SS)', 'Location Details'];

  const getExportData = () => {
    const exportRows = [];
    Object.values(groupedData).forEach(group => {
      group.events.forEach(row => {
        exportRows.push({
          'Vehicle Name': row.vehicle_name || '-',
          'Status': row.status || '-',
          'Start Time': formatLocalTime(row.start_time),
          'End Time': formatLocalTime(row.end_time),
          'Duration (HH:MM:SS)': formatDuration(row.duration_seconds || 0),
          'Location Details': row.address || 'Unknown Location'
        });
      });
    });
    return exportRows;
  };

  // Group data by vehicle and calculate summaries
  const groupedData = data.reduce((acc, row) => {
    if (!acc[row.vehicle_id]) {
      acc[row.vehicle_id] = {
        vehicle_name: row.vehicle_name,
        plate: row.plate,
        moving_seconds: 0,
        idle_seconds: 0,
        parked_seconds: 0,
        events: [] // only Idle events will go here
      };
    }

    if (row.status === 'Moving') {
      acc[row.vehicle_id].moving_seconds += parseFloat(row.duration_seconds || 0);
    } else if (row.status === 'Idle') {
      acc[row.vehicle_id].idle_seconds += parseFloat(row.duration_seconds || 0);
      acc[row.vehicle_id].events.push(row);
    } else if (row.status === 'Parked') {
      acc[row.vehicle_id].parked_seconds += parseFloat(row.duration_seconds || 0);
    }

    return acc;
  }, {});

  const activeGroups = Object.values(groupedData).filter(group => group.events.length > 0);
  const idleRecordCount = data.filter(d => d.status === 'Idle').length;
  const tableColumns = ['Status', 'Start Time', 'End Time', 'Duration (HH:MM:SS)', 'Location Details'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', boxSizing: 'border-box', color: '#0F172A' }}>

      {/* Filters Bar */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px', padding: '10px 16px', background: '#fff', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Truck size={14} color="#D97706" />
          </div>
          <select value={filters.vehicleId} onChange={e => setFilters({ ...filters, vehicleId: e.target.value })} style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #E2E8F0', outline: 'none', background: '#FAFAFA', color: '#0F172A', fontSize: '13px', fontWeight: 500, minWidth: '180px' }}>
            <option value="">All Vehicles</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div style={{ width: '1px', height: '28px', background: '#E2E8F0' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={14} color="#2563EB" />
          </div>
          <CustomDatePicker value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #E2E8F0', outline: 'none', background: '#FAFAFA', color: '#0F172A', fontSize: '13px', fontWeight: 500, width: '140px', boxSizing: 'border-box' }} />
          <span style={{ color: '#94A3B8', fontSize: '12px', fontWeight: 700 }}>→</span>
          <CustomDatePicker value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #E2E8F0', outline: 'none', background: '#FAFAFA', color: '#0F172A', fontSize: '13px', fontWeight: 500, width: '140px', boxSizing: 'border-box' }} />
        </div>
        <button onClick={handleGenerate} disabled={loading} style={{ padding: '8px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#FFF', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', boxShadow: '0 2px 8px rgba(217,119,6,0.3)', marginLeft: 'auto' }}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Generate
        </button>
      </div>

      {/* Results */}
      <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '16px' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA', borderRadius: '12px 12px 0 0' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>Report Results <span style={{ color: '#64748B', fontWeight: 500, fontSize: '13px', marginLeft: '8px' }}>({idleRecordCount} records)</span></div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => exportToPDF(columns, getExportData(), 'Idle Report', 'idle_report')} disabled={idleRecordCount === 0} style={{ padding: '8px 16px', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: idleRecordCount ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px', opacity: idleRecordCount ? 1 : 0.5 }}>
              <FileText size={16} color="#DC2626" /> PDF
            </button>
            <button onClick={() => exportToExcel(getExportData(), 'idle_report')} disabled={idleRecordCount === 0} style={{ padding: '8px 16px', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: idleRecordCount ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px', opacity: idleRecordCount ? 1 : 0.5 }}>
              <Download size={16} color="#10B981" /> Excel
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto', flex: 1, padding: '16px' }}>
          {activeGroups.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#94A3B8', fontSize: '14px' }}>
              <Filter size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              No idle data found for the selected criteria.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {activeGroups.map((group, gIdx) => (
                <div key={gIdx} style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>

                  {/* Top Bar - Vehicle Info */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', background: '#DCE4EF', padding: '12px 16px', fontWeight: 700, fontSize: '13px', color: '#1E293B', borderBottom: '1px solid #CBD5E1' }}>
                    <div>Vehicle Name : {group.vehicle_name}</div>
                    <div>From : {formatLocalTime(filters.startDate + 'T00:00:00')} - To : {formatLocalTime(filters.endDate + 'T23:59:59')}</div>
                  </div>

                  {/* Summary Bar - Durations */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', background: '#F8FAFC', padding: '12px 16px', fontWeight: 600, fontSize: '13px', color: '#475569', borderBottom: '1px solid #CBD5E1', textAlign: 'center' }}>
                    <div>Moving : {formatDuration(group.moving_seconds)}</div>
                    <div>Parked : {formatDuration(group.parked_seconds)}</div>
                    <div>Idle : {formatDuration(group.idle_seconds)}</div>
                  </div>

                  {/* Events Table */}
                  <table className="report-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                    <thead>
                      <tr style={{ background: '#F1F5F9', borderBottom: '1px solid #E2E8F0' }}>
                        {tableColumns.map(c => <th key={c} style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>{c}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {group.events.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9', background: '#FFFFFF' }}>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#D97706', fontWeight: 700 }}>{row.status}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#475569' }}>{formatLocalTime(row.start_time)}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#475569' }}>{formatLocalTime(row.end_time)}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#475569' }}>{formatDuration(row.duration_seconds || 0)}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#475569', minWidth: '200px' }}>{row.address || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IdleReportPage;
