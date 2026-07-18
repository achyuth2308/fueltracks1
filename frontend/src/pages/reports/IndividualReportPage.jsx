import React, { useState, useEffect } from 'react';
import CustomDatePicker from '../../components/ui/CustomDatePicker';
import { formatLocalTime } from '../../utils/dateUtils';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Loader2, UserCircle, Activity, Truck, Calendar, FileText, Download } from 'lucide-react';
import { exportToExcel, exportToPDF, exportToCSV } from '../../utils/exportUtils';
import axiosInstance from '../../api/axios';
import * as vehicleApi from '../../api/vehicleApi';

const IndividualReportPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  
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
    if(!filters.startDate || !filters.endDate || !filters.vehicleId) return;
    setLoading(true);
    try {
      const start = new Date(filters.startDate);
      start.setHours(0,0,0,0);
      const end = new Date(filters.endDate);
      end.setHours(23,59,59,999);

      const params = new URLSearchParams();
      params.append('startDate', start.toISOString());
      params.append('endDate', end.toISOString());
      params.append('vehicleId', filters.vehicleId);

      const res = await axiosInstance.get(`/api/reports/individual?${params.toString()}`);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', boxSizing: 'border-box', color: '#0F172A' }}>
      
      {/* Filters Bar */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px', padding: '10px 16px', background: '#fff', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#F3E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Truck size={14} color="#9333EA" />
          </div>
          <select value={filters.vehicleId} onChange={e => setFilters({...filters, vehicleId: e.target.value})} style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #E2E8F0', outline: 'none', background: '#FAFAFA', color: '#0F172A', fontSize: '13px', fontWeight: 500, minWidth: '180px' }}>
            <option value="" disabled>Select a Vehicle</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div style={{ width: '1px', height: '28px', background: '#E2E8F0' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={14} color="#2563EB" />
          </div>
          <CustomDatePicker value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #E2E8F0', outline: 'none', background: '#FAFAFA', color: '#0F172A', fontSize: '13px', fontWeight: 500, width: '140px', boxSizing: 'border-box' }} />
          <span style={{ color: '#94A3B8', fontSize: '12px', fontWeight: 700 }}>→</span>
          <CustomDatePicker value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #E2E8F0', outline: 'none', background: '#FAFAFA', color: '#0F172A', fontSize: '13px', fontWeight: 500, width: '140px', boxSizing: 'border-box' }} />
        </div>
        <button onClick={handleGenerate} disabled={loading} style={{ padding: '8px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#FFF', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', boxShadow: '0 2px 8px rgba(37,99,235,0.3)', marginLeft: 'auto' }}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Generate
        </button>
        <div style={{ width: '1px', height: '28px', background: '#E2E8F0', marginLeft: '4px', marginRight: '4px' }} />
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => {
            const columns = ['Vehicle Name', 'Plate', 'Total Distance (km)', 'Running Time', 'Idle Time', 'Trip Count', 'Stoppages', 'Overspeeding'];
            const expData = data ? [{
              'Vehicle Name': data.vehicle?.name || '-',
              'Plate': data.vehicle?.plate || '-',
              'Total Distance (km)': data.activity?.distance_travelled || 0,
              'Running Time': Math.floor((data.activity?.running_seconds || 0)/60) + ' mins',
              'Idle Time': Math.floor((data.activity?.idle_seconds || 0)/60) + ' mins',
              'Trip Count': data.summary?.trip_count || 0,
              'Stoppages': data.summary?.stoppage_count || 0,
              'Overspeeding': data.summary?.overspeeding_count || 0
            }] : [];
            exportToPDF(columns, expData, 'Individual Report', 'individual_report');
          }} disabled={!data} style={{ padding: '8px 12px', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: data ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px', opacity: data ? 1 : 0.5 }}>
            <FileText size={16} color="#DC2626" /> PDF
          </button>
          <button onClick={() => {
            const expData = data ? [{
              'Vehicle Name': data.vehicle?.name || '-',
              'Plate': data.vehicle?.plate || '-',
              'Total Distance (km)': data.activity?.distance_travelled || 0,
              'Running Time': Math.floor((data.activity?.running_seconds || 0)/60) + ' mins',
              'Idle Time': Math.floor((data.activity?.idle_seconds || 0)/60) + ' mins',
              'Trip Count': data.summary?.trip_count || 0,
              'Stoppages': data.summary?.stoppage_count || 0,
              'Overspeeding': data.summary?.overspeeding_count || 0
            }] : [];
            exportToExcel(expData, 'individual_report');
          }} disabled={!data} style={{ padding: '8px 12px', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: data ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px', opacity: data ? 1 : 0.5 }}>
            <Download size={16} color="#10B981" /> Excel
          </button>
        </div>
      </div>

      {/* Results */}
      <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>Report Results <span style={{ color: '#64748B', fontWeight: 500, fontSize: '13px', marginLeft: '8px' }}>({data ? 1 : 0} records)</span></div>
        </div>
        <div style={{ overflowX: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                {['Vehicle Name', 'Plate', 'Total Distance', 'Running Time', 'Idle Time', 'Trip Count', 'Stoppages', 'Overspeeding'].map(c => <th key={c} style={{ padding: '14px 24px', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {!data ? (
                <tr>
                  <td colSpan={8} style={{ padding: '60px', textAlign: 'center', color: '#94A3B8', fontSize: '14px' }}>
                    No data found for the selected criteria.
                  </td>
                </tr>
              ) : (
                <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '14px 24px', fontSize: '13px', fontWeight: 600, color: '#111827' }}>{data.vehicle?.name || '-'}</td>
                  <td style={{ padding: '14px 24px', fontSize: '13px', color: '#475569' }}>{data.vehicle?.plate || '-'}</td>
                  <td style={{ padding: '14px 24px', fontSize: '13px', color: '#475569', fontWeight: 600 }}>{data.activity?.distance_travelled || 0} km</td>
                  <td style={{ padding: '14px 24px', fontSize: '13px', color: '#10B981' }}>{Math.floor((data.activity?.running_seconds || 0)/60)} mins</td>
                  <td style={{ padding: '14px 24px', fontSize: '13px', color: '#F59E0B' }}>{Math.floor((data.activity?.idle_seconds || 0)/60)} mins</td>
                  <td style={{ padding: '14px 24px', fontSize: '13px', color: '#3B82F6', fontWeight: 600 }}>{data.summary?.trip_count || 0}</td>
                  <td style={{ padding: '14px 24px', fontSize: '13px', color: '#EF4444', fontWeight: 600 }}>{data.summary?.stoppage_count || 0}</td>
                  <td style={{ padding: '14px 24px', fontSize: '13px', color: '#EF4444', fontWeight: 600 }}>{data.summary?.overspeeding_count || 0}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default IndividualReportPage;
