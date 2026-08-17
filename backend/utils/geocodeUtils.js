const axios = require('axios');

// Simple in-memory cache to prevent redundant API calls for stationary/frequently visiting vehicles
// Keys are coordinates rounded to 3 decimal places (~110m accuracy) for better cache hit rate
const cache = new Map();
const CACHE_MAX_SIZE = 5000;

/**
 * Get human-readable address from coordinates
 * @param {number} lat Latitude
 * @param {number} lng Longitude
 * @returns {Promise<string>}
 */
async function getAddress(lat, lng) {
  if (!lat || !lng) return 'Unknown Location';

  // Round to 3 decimal places for caching purposes (approx 110 meters)
  const roundedLat = parseFloat(lat).toFixed(3);
  const roundedLng = parseFloat(lng).toFixed(3);
  const cacheKey = `${roundedLat},${roundedLng}`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  try {
    const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?location=${lng},${lat}&f=json`;
    // Fast timeout (2000ms) to ensure good performance
    const response = await axios.get(url, { timeout: 2000 });
    
    if (response.data && response.data.address && response.data.address.Match_addr) {
      const address = response.data.address.Match_addr;
      
      // Manage cache size
      if (cache.size >= CACHE_MAX_SIZE) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }
      
      cache.set(cacheKey, address);
      return address;
    }
  } catch (error) {
    console.warn(`[GEOCODE] Failed to reverse geocode ${lat},${lng}:`, error.message);
  }

  // Fallback to coordinates
  return `${lat}, ${lng}`;
}

module.exports = {
  getAddress
};
