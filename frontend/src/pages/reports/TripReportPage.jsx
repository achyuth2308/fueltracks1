import React, { useState, useEffect } from 'react';
import CustomDatePicker from '../../components/ui/CustomDatePicker';
import { formatLocalTime } from '../../utils/dateUtils';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Search, Loader2, Map, Filter, FileText } from 'lucide-react';
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
  return <td style={{ padding: '14px 24px', fontSize: '13px', color: '#475569', maxWidth: '250px', whiteSpace: 'normal', wordWrap: 'break-word' }}>{address}</td>;
};

const TripReportPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  
  // Filters
  const [vehicles, setVehicles] = useState([]);
  const [filters, setFilters] = useState({
    vehicleId: '',
    startDate: new Date(new Date().setHours(0,0,0,0)).toISOString().slice(0, 16),
    endDate: new Date(new Date().setHours(23,59,59,999)).toISOString().slice(0, 16)
  });

  useEffect(() => {
    vehicleApi.getVehicles({ t: Date.now() })
      .then(res => { 
        if(res.success) {
          setVehicles(res.data);
          if (res.data.length > 0) {
            setFilters(prev => ({ ...prev, vehicleId: res.data[0].id }));
          }
        } 
      })
      .catch(console.error);
  }, []);

  const handleGenerate = async () => {
    if(!filters.startDate || !filters.endDate) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const start = new Date(filters.startDate);
      const end = new Date(filters.endDate);

      const params = new URLSearchParams();
      params.append('startDate', start.toISOString());
      params.append('endDate', end.toISOString());
      if(filters.vehicleId) params.append('vehicleId', filters.vehicleId);

      const res = await axiosInstance.get('/api/reports/trip?' + params.toString());
      if(res.data.success) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const columns = ['Start Time', 'Start Address', 'End Time', 'End Address', 'Duration (mins)', 'Distance', 'Max Speed', 'Avg Speed'];

  const getExportData = () => {
    return data.map(row => ({
      'Start Time': formatLocalTime(row.start_time),
      'Start Address': (row.start_lat && row.start_lng) ? `Lat: ${row.start_lat}, Lng: ${row.start_lng}` : 'N/A',
      'End Time': formatLocalTime(row.end_time),
      'End Address': (row.end_lat && row.end_lng) ? `Lat: ${row.end_lat}, Lng: ${row.end_lng}` : 'N/A',
      'Duration (mins)': row.duration_seconds ? Math.floor(row.duration_seconds / 60) : 0,
      'Distance': row.distance || 0,
      'Max Speed': row.max_speed || 0,
      'Avg Speed': row.avg_speed ? Math.round(row.avg_speed) : 0
    }));
  };

  return (
    <div style={{ padding: '32px', background: '#EEF5F8', minHeight: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', color: '#000000' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
        <button onClick={() => navigate('/admin/reports')} style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569' }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Map size={24} color="#9333EA" /> Trip Report
          </h1>
          <p style={{ fontSize: '14px', color: '#64748B', margin: '4px 0 0 0' }}>Detailed log of all completed vehicle trips.</p>
        </div>
      </div>

      {/* Filters Panel */}
      <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', marginBottom: '24px', display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: '220px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Start Date</label>
          <CustomDatePicker showTime value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', outline: 'none', boxSizing: 'border-box', color: '#000000' }} />
        </div>
        <div style={{ flex: 1, minWidth: '220px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>End Date</label>
          <CustomDatePicker showTime value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', outline: 'none', boxSizing: 'border-box', color: '#000000' }} />
        </div>
        <button onClick={handleGenerate} disabled={loading} style={{ padding: '12px 24px', borderRadius: '10px', background: '#f97316', color: '#FFF', border: 'none', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(249,115,22,0.2)' }}>
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
          Generate Report
        </button>
      </div>

      {/* Results */}
      <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>
              Report Results <span style={{ color: '#64748B', fontWeight: 500, fontSize: '13px', marginLeft: '8px' }}>({data.length} records)</span>
            </div>
            {filters.vehicleId && (
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#0ea5e9' }}>
                Vehicle: {vehicles.find(v => v.id === filters.vehicleId)?.name || 'Unknown'} 
                <span style={{ fontSize: '13px', color: '#64748B', marginLeft: '4px' }}>
                  ({vehicles.find(v => v.id === filters.vehicleId)?.plate || 'No Plate'})
                </span>
              </div>
            )}
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
                {columns.map(c => <th key={c} style={{ padding: '14px 24px', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c}</th>)}
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
                  <td style={{ padding: '14px 24px', fontSize: '13px', color: '#475569' }}>{formatLocalTime(row.start_time)}</td>
                  <AddressCell lat={row.start_lat} lng={row.start_lng} />
                  <td style={{ padding: '14px 24px', fontSize: '13px', color: '#475569' }}>{formatLocalTime(row.end_time)}</td>
                  <AddressCell lat={row.end_lat} lng={row.end_lng} />
                  <td style={{ padding: '14px 24px', fontSize: '13px', color: '#475569' }}>{row.duration_seconds ? Math.floor(row.duration_seconds / 60) : 0}</td>
                  <td style={{ padding: '14px 24px', fontSize: '13px', color: '#475569', fontWeight: 600 }}>{row.distance || 0}</td>
                  <td style={{ padding: '14px 24px', fontSize: '13px', color: '#475569' }}>{row.max_speed || 0}</td>
                  <td style={{ padding: '14px 24px', fontSize: '13px', color: '#475569' }}>{row.avg_speed ? Math.round(row.avg_speed) : 0}</td>
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
