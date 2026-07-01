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
    const response = await fetch(
      `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?location=${lng},${lat}&f=json`,
      {
        headers: {
          'Accept-Language': 'en-US,en;q=0.9',
        }
      }
    );
    if (response.ok) {
      const data = await response.json();
      let address = 'Unknown Location';
      
      if (data && data.address) {
        address = data.address.LongLabel || data.address.Match_addr || 'Location unavailable';
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

