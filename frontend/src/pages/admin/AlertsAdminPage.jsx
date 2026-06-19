import React from 'react';
import { Bell, Settings, CheckCircle2 } from 'lucide-react';

const AlertsAdminPage = () => {
  return (
    <div style={{ padding: '32px', background: 'linear-gradient(to bottom, #f5efe4 0%, #f5efe4 50%, #f5efe4 50%, #f5efe4 100%)', minHeight: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em' }}>Alerts & Notifications</h1>
          <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>Manage system events, policies, and notification channels.</p>
        </div>
      </div>
      <div style={{
        background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0',
        boxShadow: '0 4px 6px rgba(0,0,0,0.02)', flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center'
      }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: '#f5efe4', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
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
