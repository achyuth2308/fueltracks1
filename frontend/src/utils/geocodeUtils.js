import axiosInstance from '../api/axios';

// In-memory cache to prevent spamming
const addressCache = new Map();

export const getAddressFromCoordinates = async (lat, lng, forceRefresh = false) => {
  if (!lat || !lng) return 'Unknown Location';
  
  // Aggressive caching: 3 decimal places is ~110m resolution
  const cacheKey = `${parseFloat(lat).toFixed(3)},${parseFloat(lng).toFixed(3)}`;
  
  if (!forceRefresh && addressCache.has(cacheKey)) {
    const cached = addressCache.get(cacheKey);
    // If cached value was just an old bare pincode (e.g. "631052, IND"), re-fetch rich address
    if (cached && !/^\d{5,6}(,\s*[A-Z]{2,3})?$/i.test(String(cached).trim())) {
      return cached;
    }
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

