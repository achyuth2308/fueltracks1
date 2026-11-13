const https = require('https');

// Simple in-memory cache to prevent redundant API calls for stationary/frequently visiting vehicles
// Keys are coordinates rounded to 3 decimal places (~110m accuracy) for better cache hit rate
const cache = new Map();
const CACHE_MAX_SIZE = 10000;

function fetchJSON(url, options = {}, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

function formatOSMAddress(data) {
  if (!data || !data.address) return data?.display_name || null;
  const a = data.address;
  const parts = [
    a.road || a.street || a.highway,
    a.suburb || a.neighbourhood || a.village || a.hamlet || a.residential,
    a.city || a.town || a.municipality || a.county,
    a.state_district,
    a.state,
    a.postcode
  ].filter(Boolean);

  const unique = [];
  for (const p of parts) {
    const clean = String(p).trim();
    if (clean && !unique.some(u => u.toLowerCase() === clean.toLowerCase())) {
      unique.push(clean);
    }
  }
  return unique.join(', ') || data.display_name || null;
}

function formatArcGISAddress(data) {
  const a = data?.address;
  if (!a) return null;

  const isPincodeOnly = /^\d{5,6}(,\s*[A-Z]{2,3})?$/i.test(String(a.LongLabel || '').trim());
  if (!isPincodeOnly && a.LongLabel && a.LongLabel.length > 20 && !/^\d{5,6}/.test(a.LongLabel)) {
    return a.LongLabel;
  }

  const parts = [
    a.Address || a.PlaceName,
    a.Neighborhood || a.District || a.Block,
    a.City,
    a.Subregion,
    a.Region
  ].filter(p => p && String(p).trim() !== '' && !/^\d{5,6}$/.test(String(p).trim()));

  const postalStr = a.Postal || a.PostalExt;
  let res = parts.join(', ');
  if (postalStr) {
    res += (res ? ' - ' : '') + postalStr;
  }
  return res || a.Match_addr || a.LongLabel || null;
}

/**
 * Get human-readable address from coordinates
 * @param {number} lat Latitude
 * @param {number} lng Longitude
 * @returns {Promise<string>}
 */
async function getAddress(lat, lng) {
  if (!lat || !lng) return 'Unknown Location';

  const parsedLat = parseFloat(lat);
  const parsedLng = parseFloat(lng);
  if (isNaN(parsedLat) || isNaN(parsedLng)) return 'Unknown Location';

  const cacheKey = `${parsedLat.toFixed(3)},${parsedLng.toFixed(3)}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  let finalLabel = null;

  // 1. Try OSM
  try {
    const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${parsedLat}&lon=${parsedLng}&zoom=18&addressdetails=1`;
    const osmData = await fetchJSON(osmUrl, {
      headers: { 'User-Agent': 'FuelTracks-Fleet-Portal/1.0' }
    }, 2500);

    const osmLabel = formatOSMAddress(osmData);
    if (osmLabel && osmLabel.length > 5) {
      finalLabel = osmLabel;
    }
  } catch (err) {}

  // 2. Try ArcGIS
  if (!finalLabel) {
    try {
      const arcgisUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?location=${encodeURIComponent(parsedLng)},${encodeURIComponent(parsedLat)}&f=json`;
      const arcgisData = await fetchJSON(arcgisUrl, {}, 2500);
      const arcLabel = formatArcGISAddress(arcgisData);
      if (arcLabel && arcLabel.length > 5) {
        finalLabel = arcLabel;
      }
    } catch (err) {}
  }

  const address = finalLabel || `${parsedLat.toFixed(4)}, ${parsedLng.toFixed(4)}`;

  if (cache.size >= CACHE_MAX_SIZE) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  cache.set(cacheKey, address);
  return address;
}

module.exports = {
  getAddress
};
