import React, { useState, useEffect } from 'react';
import CustomDatePicker from '../../components/ui/CustomDatePicker';
import { formatLocalTime } from '../../utils/dateUtils';
import { getAddressFromCoordinates } from '../../utils/geocodeUtils';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Search, Loader2, PauseCircle, Filter, FileText } from 'lucide-react';
import axiosInstance from '../../api/axios';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';
import * as vehicleApi from '../../api/vehicleApi';

const formatDuration = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const StoppageReportPage = () => {
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
      .then(res => { if(res.success) setVehicles(res.data); })
      .catch(console.error);
  }, []);

  const handleGenerate = async () => {
    if(!filters.startDate || !filters.endDate) return;
    setLoading(true);
    try {
      const start = new Date(filters.startDate);
      start.setHours(0,0,0,0);
      const end = new Date(filters.endDate);
      end.setHours(23,59,59,999);

      const params = new URLSearchParams();
      params.append('startDate', start.toISOString());
      params.append('endDate', end.toISOString());
      if(filters.vehicleId) params.append('vehicleId', filters.vehicleId);

      const res = await axiosInstance.get(`/api/reports/stoppages?${params.toString()}`);
      if(res.data.success) {
        const reportData = res.data.data;
        // Fetch addresses only for Idle and Parked
        const dataWithAddresses = await Promise.all(reportData.map(async (row) => {
          if (row.status === 'Moving') return { ...row, address: '-' };
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
        events: [] // only Idle and Parked events will go here
      };
    }
    
    if (row.status === 'Moving') {
        acc[row.vehicle_id].moving_seconds += parseFloat(row.duration_seconds || 0);
    } else if (row.status === 'Idle') {
        acc[row.vehicle_id].idle_seconds += parseFloat(row.duration_seconds || 0);
        acc[row.vehicle_id].events.push(row);
    } else if (row.status === 'Parked') {
        acc[row.vehicle_id].parked_seconds += parseFloat(row.duration_seconds || 0);
        acc[row.vehicle_id].events.push(row);
    }
    
    return acc;
  }, {});

  const tableColumns = ['Status', 'Start Time', 'End Time', 'Duration (HH:MM:SS)', 'Location Details'];

  return (
    <div style={{ padding: '32px', background: 'linear-gradient(to bottom, #f5efe4 0%, #f5efe4 50%, #f5efe4 50%, #f5efe4 100%)', minHeight: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', color: '#000000' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
        <button onClick={() => navigate('/admin/reports')} style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569' }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PauseCircle size={24} color="#F59E0B" /> Idle / Stoppage Wastage Report
          </h1>
          <p style={{ fontSize: '14px', color: '#64748B', margin: '4px 0 0 0' }}>Log of all vehicle stoppages, including location and duration.</p>
        </div>
      </div>

      {/* Filters Panel */}
      <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', marginBottom: '24px', display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Select Vehicle (Optional)</label>
          <select value={filters.vehicleId} onChange={e => setFilters({...filters, vehicleId: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', outline: 'none', background: '#F8FAFC', color: '#000000' }}>
            <option value="">All Vehicles</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.plate})</option>)}
          </select>
        </div>
        <div style={{ width: '150px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Start Date</label>
          <CustomDatePicker value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', outline: 'none', boxSizing: 'border-box', color: '#000000' }} />
        </div>
        <div style={{ width: '150px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>End Date</label>
          <CustomDatePicker value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', outline: 'none', boxSizing: 'border-box', color: '#000000' }} />
        </div>
        <button onClick={handleGenerate} disabled={loading} style={{ padding: '12px 24px', borderRadius: '10px', background: '#8ba0b5', color: '#FFF', border: 'none', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(139,160,181,0.2)' }}>
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
          Generate Report
        </button>
      </div>

      {/* Results */}
      <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '16px' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA', borderRadius: '12px 12px 0 0' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>Report Results <span style={{ color: '#64748B', fontWeight: 500, fontSize: '13px', marginLeft: '8px' }}>({data.filter(d => d.status !== 'Moving').length} records)</span></div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => exportToPDF(columns, getExportData(), 'Stoppage Report', 'stoppage_report')} disabled={data.length === 0} style={{ padding: '8px 16px', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: data.length ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px', opacity: data.length ? 1 : 0.5 }}>
              <FileText size={16} color="#DC2626" /> PDF
            </button>
            <button onClick={() => exportToExcel(getExportData(), 'stoppage_report')} disabled={data.length === 0} style={{ padding: '8px 16px', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: data.length ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px', opacity: data.length ? 1 : 0.5 }}>
              <Download size={16} color="#10B981" /> Excel
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto', flex: 1, padding: '16px' }}>
          {Object.keys(groupedData).length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#94A3B8', fontSize: '14px' }}>
              <Filter size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              No data found for the selected criteria.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {Object.values(groupedData).map((group, gIdx) => (
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
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                    <thead>
                      <tr style={{ background: '#F1F5F9', borderBottom: '1px solid #E2E8F0' }}>
                        {tableColumns.map(c => <th key={c} style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>{c}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {group.events.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9', background: '#FFFFFF' }}>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#111827', fontWeight: 600 }}>{row.status}</td>
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

export default StoppageReportPage;
