import React from 'react';
import { Fuel, Plus, Info, Settings, AlertTriangle, FileText, CheckCircle2, ChevronRight, Activity } from 'lucide-react';

const FuelAdminPage = () => {
  return (
    <div style={{ padding: '32px', background: '#EEF5F8', minHeight: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em' }}>Fuel Monitoring</h1>
            <span style={{ padding: '4px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 700, background: '#F8FAFC', color: '#64748B' }}>
              DISABLED
            </span>
          </div>
          <p style={{ fontSize: '14px', color: '#6B7280' }}>Advanced fuel analytics, theft detection, and consumption reports.</p>
        </div>
        <button
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: '#f97316', color: '#FFFFFF',
            padding: '10px 20px', borderRadius: '10px',
            fontSize: '14px', fontWeight: 600, border: 'none',
            cursor: 'not-allowed', boxShadow: '0 4px 12px rgba(249,115,22,0.2)', opacity: 0.7
          }}
          title="Module ready for integration"
        >
          <Settings size={18} />
          <span>Configure Module</span>
        </button>
      </div>

      {/* KPI Cards / Current State */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {[
          { label: 'Fuel Sensors Connected', value: '—', color: '#3B82F6', icon: Activity },
          { label: 'Fuel Enabled Vehicles', value: '—', color: '#10B981', icon: Fuel },
          { label: 'Active Fuel Alerts', value: 'Disabled', color: '#F59E0B', icon: AlertTriangle },
          { label: 'Scheduled Reports', value: 'Disabled', color: '#8B5CF6', icon: FileText },
        ].map(stat => (
          <div key={stat.label} style={{
            background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0',
            padding: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
            display: 'flex', alignItems: 'center', gap: '16px'
          }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${stat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <stat.icon size={20} color={stat.color} />
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#111827', lineHeight: 1 }}>{stat.value}</div>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, marginTop: '4px' }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Empty State */}
      <div style={{
        background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0',
        boxShadow: '0 4px 6px rgba(0,0,0,0.02)', flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center'
      }}>
        <div style={{
          width: '80px', height: '80px', borderRadius: '24px', background: '#EEF5F8', border: '1px solid #E2E8F0',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px'
        }}>
          <Fuel size={40} color="#94A3B8" />
        </div>

        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#111827', marginBottom: '8px' }}>Module Ready for Integration</h2>
        <p style={{ fontSize: '14px', color: '#6B7280', maxWidth: '400px', lineHeight: 1.5, marginBottom: '32px' }}>
          The Fuel Monitoring subsystem is fully provisioned. To begin receiving telemetry, please connect compatible fuel level sensors and enable the module in Organization settings.
        </p>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {['Real-time Volume', 'Refill Detection', 'Theft Alerts', 'Consumption Reports'].map(feature => (
            <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#EEF5F8', padding: '8px 16px', borderRadius: '99px', border: '1px solid #E2E8F0' }}>
              <CheckCircle2 size={14} color="#10B981" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>{feature}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FuelAdminPage;
