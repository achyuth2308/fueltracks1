import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Settings, CheckCircle2, ArrowLeft } from 'lucide-react';

const AlertsAdminPage = () => {
  const navigate = useNavigate();
  return (
    <div style={{ padding: '32px', background: '#EEF5F8', minHeight: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              cursor: 'pointer',
              color: '#334155',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#94A3B8'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#CBD5E1'; }}
            title="Go Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em', margin: 0 }}>Alerts & Notifications</h1>
            <p style={{ fontSize: '14px', color: '#6B7280', margin: '4px 0 0 0' }}>Manage system events, policies, and notification channels.</p>
          </div>
        </div>
      </div>
      <div style={{
        background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0',
        boxShadow: '0 4px 6px rgba(0,0,0,0.02)', flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center'
      }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: '#EEF5F8', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
          <Bell size={40} color="#94A3B8" />
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#111827', marginBottom: '8px' }}>Module Ready for Integration</h2>
        <p style={{ fontSize: '14px', color: '#6B7280', maxWidth: '400px', lineHeight: 1.5, marginBottom: '32px' }}>
          The Alerts engine is provisioned. Future updates will enable configuring custom rules and notification channels.
        </p>
      </div>
    </div>
  );
};

export default AlertsAdminPage;
