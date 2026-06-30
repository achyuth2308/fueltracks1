// In-memory cache to prevent spamming the Nominatim API
const addressCache = new Map();

// Helper to delay execution (rate limiting)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let lastRequestTime = 0;

export const getAddressFromCoordinates = async (lat, lng) => {
  if (!lat || !lng) return 'Unknown Location';
  
  // Format coordinate keys to 4 decimal places (~11 meters resolution) 
  // This drastically increases cache hits for vehicles parked or moving slowly
  const cacheKey = `${parseFloat(lat).toFixed(4)},${parseFloat(lng).toFixed(4)}`;
  
  if (addressCache.has(cacheKey)) {
    return addressCache.get(cacheKey);
  }

  try {
    // OpenStreetMap Nominatim Rate Limiting: max 1 request per second
    const now = Date.now();
    const timeSinceLastReq = now - lastRequestTime;
    if (timeSinceLastReq < 1000) {
      await delay(1000 - timeSinceLastReq);
    }
    lastRequestTime = Date.now();

    // Use BigDataCloud free reverse geocoding (no auth, more lenient rate limits)
    const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);

    if (!response.ok) throw new Error('Geocoding failed');
    
    const data = await response.json();
    
    let address = 'Unknown Location';
    if (data && data.locality) {
      const parts = [data.locality, data.city, data.principalSubdivision, data.countryName].filter(Boolean);
      // Remove duplicates
      address = [...new Set(parts)].join(', ');
    } else if (data && data.city) {
      address = `${data.city}, ${data.principalSubdivision}, ${data.countryName}`;
    }

    
    // Cache the successful result
    addressCache.set(cacheKey, address);
    return address;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    // Don't cache errors so we can retry later
    return 'Location unavailable';
  }
};
