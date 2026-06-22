import React from 'react';
import { MapPin, CheckCircle2 } from 'lucide-react';

const GeofencesAdminPage = () => {
  return (
    <div style={{ padding: '32px', background: '#EEF5F8', minHeight: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em' }}>Geofence Management</h1>
          <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>Define virtual perimeters and spatial monitoring zones.</p>
        </div>
      </div>
      <div style={{
        background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0',
        boxShadow: '0 4px 6px rgba(0,0,0,0.02)', flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center'
      }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: '#EEF5F8', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
          <MapPin size={40} color="#94A3B8" />
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#111827', marginBottom: '8px' }}>Module Ready for Integration</h2>
        <p style={{ fontSize: '14px', color: '#6B7280', maxWidth: '400px', lineHeight: 1.5, marginBottom: '32px' }}>
          The Geofencing engine is provisioned. Future updates will enable drawing polygons and setting entry/exit alerts.
        </p>
      </div>
    </div>
  );
};

export default GeofencesAdminPage;
