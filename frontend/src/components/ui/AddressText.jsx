import React, { useState, useEffect } from 'react';
import { getAddressFromCoordinates } from '../../utils/geocodeUtils';

const AddressText = ({ lat, lng }) => {
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

  return <span style={{ fontSize: '11px', color: '#475569', fontWeight: 600, whiteSpace: 'normal', lineHeight: '1.3' }}>{address}</span>;
};

export default AddressText;
