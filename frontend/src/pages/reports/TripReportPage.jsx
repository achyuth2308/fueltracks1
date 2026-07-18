import React, { useState, useEffect } from 'react';
import CustomDatePicker from '../../components/ui/CustomDatePicker';
import { formatLocalTime } from '../../utils/dateUtils';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Search, Loader2, Map, Filter, FileText, Truck, Calendar } from 'lucide-react';
import axiosInstance from '../../api/axios';
import { exportToExcel, exportToPDF, exportToCSV } from '../../utils/exportUtils';
import * as vehicleApi from '../../api/vehicleApi';
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
  return <td style={{ padding: '10px 16px', fontSize: '13px', color: '#475569', maxWidth: '250px', whiteSpace: 'normal', wordWrap: 'break-word' }}>{address}</td>;
};

const formatDuration = (seconds) => {
  if (!seconds) return '00:00:00';
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
};

const TripReportPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);

  // Filters
  const [vehicles, setVehicles] = useState([]);
  const [filters, setFilters] = useState({
    vehicleId: '',
    startDate: new Date(new Date().setHours(0, 0, 0, 0)).toISOString().slice(0, 16),
    endDate: new Date(new Date().setHours(23, 59, 59, 999)).toISOString().slice(0, 16)
  });

  useEffect(() => {
    vehicleApi.getVehicles({ t: Date.now() })
      .then(res => {
        if (res.success) {
          setVehicles(res.data);
          if (res.data.length > 0) {
            setFilters(prev => ({ ...prev, vehicleId: res.data[0].id }));
          }
        }
      })
      .catch(console.error);
  }, []);

  const handleGenerate = async () => {
    if (!filters.startDate || !filters.endDate) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const start = new Date(filters.startDate);
      const end = new Date(filters.endDate);

      const params = new URLSearchParams();
      params.append('startDate', start.toISOString());
      params.append('endDate', end.toISOString());
      if (filters.vehicleId) params.append('vehicleId', filters.vehicleId);

      const res = await axiosInstance.get('/api/reports/trip?' + params.toString());
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

  const columns = ['Start Time', 'Start Address', 'End Time', 'End Address', 'Duration (hh:mm:ss)', 'Distance', 'Max Speed', 'Avg Speed'];

  const getExportData = () => {
    return data.map(row => ({
      'Start Time': formatLocalTime(row.start_time),
      'Start Address': (row.start_lat && row.start_lng) ? `Lat: ${row.start_lat}, Lng: ${row.start_lng}` : 'N/A',
      'End Time': formatLocalTime(row.end_time),
      'End Address': (row.end_lat && row.end_lng) ? `Lat: ${row.end_lat}, Lng: ${row.end_lng}` : 'N/A',
      'Duration (hh:mm:ss)': formatDuration(row.duration_seconds),
      'Distance': row.distance || 0,
      'Max Speed': row.max_speed || 0,
      'Avg Speed': row.avg_speed ? Math.round(row.avg_speed) : 0
    }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', boxSizing: 'border-box', color: '#0F172A' }}>



      {/* Filters Bar */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px', padding: '10px 16px', background: '#fff', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#F3E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Truck size={14} color="#9333EA" />
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
          <CustomDatePicker showTime value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #E2E8F0', outline: 'none', background: '#FAFAFA', color: '#0F172A', fontSize: '13px', fontWeight: 500, width: '260px', boxSizing: 'border-box' }} />
          <span style={{ color: '#94A3B8', fontSize: '12px', fontWeight: 700 }}>→</span>
          <CustomDatePicker showTime value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #E2E8F0', outline: 'none', background: '#FAFAFA', color: '#0F172A', fontSize: '13px', fontWeight: 500, width: '260px', boxSizing: 'border-box' }} />
        </div>
        <button onClick={handleGenerate} disabled={loading} style={{ padding: '8px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #a855f7, #9333ea)', color: '#FFF', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', boxShadow: '0 2px 8px rgba(147,51,234,0.3)', marginLeft: 'auto' }}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Generate
        </button>
      </div>

      {/* Results */}
      <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>
            Report Results <span style={{ color: '#64748B', fontWeight: 500, fontSize: '13px', marginLeft: '8px' }}>({data.length} records)</span>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => exportToPDF(columns, getExportData(), 'Trip Report', 'trip_report')} disabled={data.length === 0} style={{ padding: '8px 16px', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: data.length ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px', opacity: data.length ? 1 : 0.5 }}>
              <FileText size={16} color="#DC2626" /> PDF
            </button>
            <button onClick={() => exportToExcel(getExportData(), 'trip_report')} disabled={data.length === 0} style={{ padding: '8px 16px', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: data.length ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px', opacity: data.length ? 1 : 0.5 }}>
              <Download size={16} color="#10B981" /> Excel
            </button>
            <button onClick={() => exportToCSV(getExportData(), 'trip_report')} disabled={data.length === 0} style={{ padding: '8px 16px', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: data.length ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px', opacity: data.length ? 1 : 0.5 }}>
              <Download size={16} color="#0284C7" /> CSV
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1000px' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                {columns.map(c => <th key={c} style={{ padding: '10px 16px', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} style={{ padding: '60px', textAlign: 'center', color: '#94A3B8', fontSize: '14px' }}>
                    <Filter size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                    No data found for the selected criteria.
                  </td>
                </tr>
              ) : data.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '10px 16px', fontSize: '13px', color: '#475569' }}>{formatLocalTime(row.start_time)}</td>
                  <AddressCell lat={row.start_lat} lng={row.start_lng} />
                  <td style={{ padding: '10px 16px', fontSize: '13px', color: '#475569' }}>{formatLocalTime(row.end_time)}</td>
                  <AddressCell lat={row.end_lat} lng={row.end_lng} />
                  <td style={{ padding: '10px 16px', fontSize: '13px', color: '#475569' }}>{formatDuration(row.duration_seconds)}</td>
                  <td style={{ padding: '10px 16px', fontSize: '13px', color: '#475569', fontWeight: 600 }}>{row.distance || 0}</td>
                  <td style={{ padding: '10px 16px', fontSize: '13px', color: '#475569' }}>{row.max_speed || 0}</td>
                  <td style={{ padding: '10px 16px', fontSize: '13px', color: '#475569' }}>{row.avg_speed ? Math.round(row.avg_speed) : 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default TripReportPage;
