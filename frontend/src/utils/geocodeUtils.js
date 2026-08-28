import axiosInstance from '../api/axios';

// In-memory cache to prevent spamming
const addressCache = new Map();

export const getAddressFromCoordinates = async (lat, lng) => {
  if (!lat || !lng) return 'Unknown Location';
  
  // Aggressive caching: 3 decimal places is ~110m resolution
  const cacheKey = `${parseFloat(lat).toFixed(3)},${parseFloat(lng).toFixed(3)}`;
  
  if (addressCache.has(cacheKey)) {
    return addressCache.get(cacheKey);
  }
  
  try {
    const response = await axiosInstance.get(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
    if (response.status === 200) {
      const data = response.data;
      let address = 'Location unavailable';
      
      if (data && data.success && data.label) {
        address = data.label;
      }
      
      addressCache.set(cacheKey, address);
      return address;
    }
    return 'Location unavailable';
  } catch (error) {
    console.error('Geocoding error:', error);
    return 'Location unavailable';
  }
};

