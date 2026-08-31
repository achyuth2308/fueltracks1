import React, { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import { getAddressFromCoordinates } from '../../utils/geocodeUtils';

const LocationDisplay = ({ lat, lng }) => {
  // Start with a generic non-intrusive loading indicator, not 'Fetching...'
  const [address, setAddress] = useState('...');
  
  useEffect(() => {
    let mounted = true;
    // Intentionally NOT setting state to 'Fetching...' here.
    // This allows the component to retain the previous address while the new one is fetched.
    if (lat && lng) {
      getAddressFromCoordinates(lat, lng).then(addr => {
        if (mounted) {
          const isErrorMsg = addr === 'Location unavailable' || addr === 'Unknown Location' || addr === 'Error fetching';
          
          if (!isErrorMsg) {
            setAddress(addr);
          } else {
            // Only fall back to error text if we don't have a valid previous address
            setAddress(prev => (prev && prev !== '...') ? prev : 'Location not found');
          }
        }
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
