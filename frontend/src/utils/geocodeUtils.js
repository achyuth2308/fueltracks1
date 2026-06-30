// In-memory cache to prevent spamming the Nominatim API
const addressCache = new Map();
const requestQueue = [];
let isProcessing = false;
let lastRequestTime = 0;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const processQueue = async () => {
  if (isProcessing || requestQueue.length === 0) return;
  isProcessing = true;
  
  while (requestQueue.length > 0) {
    const { lat, lng, resolve, cacheKey } = requestQueue[0];
    
    const now = Date.now();
    const timeSinceLast = now - lastRequestTime;
    if (timeSinceLast < 1100) {
      await delay(1100 - timeSinceLast);
    }
    lastRequestTime = Date.now();
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`,
        {
          headers: {
            'Accept-Language': 'en-US,en;q=0.9',
            'User-Agent': 'FuelTracks-Enterprise/1.0'
          }
        }
      );
      if (response.ok) {
        const data = await response.json();
        let address = 'Unknown Location';
        if (data && data.address) {
          const { road, suburb, neighbourhood, city, town, village, state } = data.address;
          const localArea = neighbourhood || suburb || village || town || city;
          const parts = [road, localArea, state].filter(Boolean);
          address = parts.join(', ') || data.display_name;
        } else if (data && data.display_name) {
          address = data.display_name.split(',').slice(0, 3).join(', ');
        }
        addressCache.set(cacheKey, address);
        resolve(address);
      } else {
        resolve('Location unavailable');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      resolve('Location unavailable');
    }
    
    requestQueue.shift();
  }
  isProcessing = false;
};

export const getAddressFromCoordinates = (lat, lng) => {
  return new Promise((resolve) => {
    if (!lat || !lng) return resolve('Unknown Location');
    
    // Aggressive caching: 3 decimal places is ~110m resolution
    // Drastically reduces API calls when loading table rows
    const cacheKey = `${parseFloat(lat).toFixed(3)},${parseFloat(lng).toFixed(3)}`;
    
    if (addressCache.has(cacheKey)) {
      return resolve(addressCache.get(cacheKey));
    }
    
    requestQueue.push({ lat, lng, resolve, cacheKey });
    processQueue();
  });
};
