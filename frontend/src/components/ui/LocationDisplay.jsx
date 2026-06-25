import React, { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import { getAddressFromCoordinates } from '../../utils/geocodeUtils';

const LocationDisplay = ({ lat, lng }) => {
  const [address, setAddress] = useState('Fetching...');
  
  useEffect(() => {
    let mounted = true;
    setAddress('Fetching...');
    if (lat && lng) {
      getAddressFromCoordinates(lat, lng).then(addr => {
        if (mounted) setAddress(addr);
      });
    }
    return () => { mounted = false; };
  }, [lat, lng]);

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #F1F5F9' }}>
      <span style={{ color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
        <MapPin size={12} /> Loc
      </span>
      <span style={{ fontWeight: 600, color: '#334155', textAlign: 'right', fontSize: '11px', lineHeight: '1.3', maxWidth: '140px' }}>
        {address}
      </span>
    </div>
  );
};

export default LocationDisplay;
