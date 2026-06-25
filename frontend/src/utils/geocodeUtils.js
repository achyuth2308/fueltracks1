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

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`,
      {
        headers: {
          'Accept-Language': 'en-US,en;q=0.9',
          // Nominatim requires a user-agent to avoid blocks
          'User-Agent': 'FuelTracks-Enterprise/1.0'
        }
      }
    );

    if (!response.ok) throw new Error('Geocoding failed');
    
    const data = await response.json();
    
    // Construct a nice, human-readable address string
    let address = 'Unknown Location';
    if (data && data.address) {
      const { road, suburb, neighbourhood, city, town, village, state } = data.address;
      
      // Pick the most relevant local area identifier
      const localArea = neighbourhood || suburb || village || town || city;
      
      const parts = [road, localArea, state].filter(Boolean);
      address = parts.join(', ') || data.display_name;
      
      // Fallback if address is empty
      if (!address || address.trim() === '') {
        address = data.display_name.split(',').slice(0, 3).join(', ');
      }
    } else if (data && data.display_name) {
      address = data.display_name.split(',').slice(0, 3).join(', ');
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
