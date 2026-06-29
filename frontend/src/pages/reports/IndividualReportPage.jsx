import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Loader2, UserCircle, Activity } from 'lucide-react';
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
    <div style={{ padding: '32px', background: '#f8fafc', minHeight: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', color: '#000000' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
        <button onClick={() => navigate('/admin/reports')} style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569' }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserCircle size={24} color="#8B5CF6" /> Individual Vehicle Report
          </h1>
          <p style={{ fontSize: '14px', color: '#64748B', margin: '4px 0 0 0' }}>Comprehensive individual breakdown of a specific vehicle.</p>
        </div>
      </div>

      {/* Filters Panel */}
      <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', marginBottom: '24px', display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Select Vehicle</label>
          <select value={filters.vehicleId} onChange={e => setFilters({...filters, vehicleId: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', outline: 'none', background: '#F8FAFC', color: '#000000' }}>
            <option value="" disabled>Select a Vehicle</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.plate})</option>)}
          </select>
        </div>
        <div style={{ width: '150px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Start Date</label>
          <input type="date" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', outline: 'none', boxSizing: 'border-box', color: '#000000' }} />
        </div>
        <div style={{ width: '150px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>End Date</label>
          <input type="date" value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', outline: 'none', boxSizing: 'border-box', color: '#000000' }} />
        </div>
        <button onClick={handleGenerate} disabled={loading || !filters.vehicleId} style={{ padding: '12px 24px', borderRadius: '10px', background: '#8ba0b5', color: '#FFF', border: 'none', fontWeight: 600, cursor: (loading || !filters.vehicleId) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: (loading || !filters.vehicleId) ? 0.6 : 1 }}>
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
          Generate Report
        </button>
      </div>

      {/* Summary Dashboard */}
      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>Total Distance</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#111827', marginTop: '8px' }}>{data.activity.distance_travelled || 0} km</div>
            </div>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>Running Time</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#10B981', marginTop: '8px' }}>{Math.floor((data.activity.running_seconds || 0)/60)} mins</div>
            </div>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>Idle Time</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#F59E0B', marginTop: '8px' }}>{Math.floor((data.activity.idle_seconds || 0)/60)} mins</div>
            </div>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>Trip Count</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#3B82F6', marginTop: '8px' }}>{data.summary.trip_count}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '24px' }}>
             {/* Stoppages Mini-table */}
             <div style={{ flex: 1, background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', maxHeight: '400px', overflowY: 'auto' }}>
               <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700 }}>Recent Stoppages</h3>
               {data.stoppages.length === 0 ? <p style={{ color: '#94a3b8' }}>No stoppages found.</p> : (
                 <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                   <thead>
                     <tr style={{ color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                       <th style={{ padding: '8px 0' }}>Start Time</th>
                       <th>Duration</th>
                     </tr>
                   </thead>
                   <tbody>
                     {data.stoppages.map((s, i) => (
                       <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                         <td style={{ padding: '8px 0' }}>{new Date(s.start_time).toLocaleString()}</td>
                         <td style={{ color: '#EF4444', fontWeight: 600 }}>{Math.floor(s.duration_seconds/60)} mins</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               )}
             </div>

             {/* Overspeeding Mini-table */}
             <div style={{ flex: 1, background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', maxHeight: '400px', overflowY: 'auto' }}>
               <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700 }}>Overspeeding Events</h3>
               {data.overspeeding.length === 0 ? <p style={{ color: '#94a3b8' }}>No overspeeding found.</p> : (
                 <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                   <thead>
                     <tr style={{ color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                       <th style={{ padding: '8px 0' }}>Start Time</th>
                       <th>Max Speed</th>
                     </tr>
                   </thead>
                   <tbody>
                     {data.overspeeding.map((s, i) => (
                       <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                         <td style={{ padding: '8px 0' }}>{new Date(s.start_time).toLocaleString()}</td>
                         <td style={{ color: '#EF4444', fontWeight: 600 }}>{s.max_speed}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               )}
             </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default IndividualReportPage;
