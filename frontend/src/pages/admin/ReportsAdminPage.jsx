import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Map, Activity, Route, Zap, TrendingUp, Clock, Truck, Loader2, AlertTriangle, MapPin } from 'lucide-react';
import axiosInstance from '../../api/axios';

const fetchDashboardStats = async () => {
  const res = await axiosInstance.get(`/api/reports/dashboard`);
  return res.data;
};

const StatCard = ({ title, value, icon: Icon, color, bg }) => (
  <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', gap: '20px', transition: 'transform 0.2s', cursor: 'default' }} onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform='none'}>
    <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: bg, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={28} />
    </div>
    <div>
      <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748B', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
      <div style={{ fontSize: '28px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  </div>
);

const ReportLinkCard = ({ title, desc, path, icon: Icon, color, bg, navigate }) => (
  <div onClick={() => navigate(path)} style={{ background: '#FFFFFF', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: '16px' }} onMouseEnter={e => { e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 12px 20px rgba(0,0,0,0.05)'; e.currentTarget.style.borderColor=color; }} onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 4px 6px rgba(0,0,0,0.02)'; e.currentTarget.style.borderColor='#E2E8F0'; }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: bg, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={24} />
      </div>
      <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#111827', margin: 0 }}>{title}</h3>
    </div>
    <p style={{ fontSize: '14px', color: '#64748B', margin: 0, lineHeight: 1.5 }}>{desc}</p>
  </div>
);

const ReportsAdminPage = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardStats()
      .then(res => {
        if(res.success) setStats(res.data);
      })
      .catch(err => {
        console.error(err);
        setError('Failed to load dashboard statistics.');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: '32px', background: 'linear-gradient(to bottom, #FFF7ED 0%, #FFF7ED 50%, #F8FAFC 50%, #F8FAFC 100%)', minHeight: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em' }}>Reports Dashboard</h1>
        <p style={{ fontSize: '15px', color: '#64748B', marginTop: '8px' }}>Comprehensive fleet analytics and historical data exports.</p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '40px' }}>
          <Loader2 size={40} className="animate-spin" color="#FF6B00" style={{ marginBottom: '16px' }} />
          <div style={{ fontSize: '15px', color: '#64748B', fontWeight: 600 }}>Gathering analytics...</div>
        </div>
      ) : error ? (
        <div style={{ padding: '24px', background: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px', color: '#DC2626' }}>
          <AlertTriangle size={24} />
          <div style={{ fontSize: '15px', fontWeight: 600 }}>{error}</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '40px' }}>
            <StatCard title="Distance Today" value={`${(stats?.distanceToday || 0).toFixed(1)} km`} icon={TrendingUp} bg="#FFF4ED" color="#FF6B00" />
            <StatCard title="Running Vehicles" value={stats?.running || 0} icon={Truck} bg="#ECFDF5" color="#10B981" />
            <StatCard title="Idle Vehicles" value={stats?.idle || 0} icon={Clock} bg="#FEF3C7" color="#F59E0B" />
            <StatCard title="Stopped Vehicles" value={stats?.stopped || 0} icon={MapPin} bg="#F1F5F9" color="#64748B" />
          </div>

          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#111827', marginBottom: '24px' }}>Available Reports</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            <ReportLinkCard 
              title="Trip Report" 
              desc="View start and end locations, durations, and distances for all completed trips." 
              path="/admin/reports/trip" 
              icon={Map} bg="#F3E8FF" color="#9333EA" navigate={navigate} 
            />
            <ReportLinkCard 
              title="Daily Distance Report" 
              desc="Analyze total distance travelled by each vehicle on a daily basis." 
              path="/admin/reports/distance" 
              icon={TrendingUp} bg="#E0F2FE" color="#0284C7" navigate={navigate} 
            />
            <ReportLinkCard 
              title="Vehicle Activity Report" 
              desc="Breakdown of running, idling, stopped, and offline hours for utilization tracking." 
              path="/admin/reports/activity" 
              icon={Activity} bg="#ECFDF5" color="#059669" navigate={navigate} 
            />
            <ReportLinkCard 
              title="Route History Report" 
              desc="Visualize the exact path a vehicle took on the map with telemetry data points." 
              path="/admin/reports/route" 
              icon={Route} bg="#FFF4ED" color="#FF6B00" navigate={navigate} 
            />
            <ReportLinkCard 
              title="Ignition Report" 
              desc="Detailed log of all engine ON and OFF events with timestamp and location." 
              path="/admin/reports/ignition" 
              icon={Zap} bg="#FEF2F2" color="#DC2626" navigate={navigate} 
            />
          </div>
        </>
      )}

    </div>
  );
};

export default ReportsAdminPage;
