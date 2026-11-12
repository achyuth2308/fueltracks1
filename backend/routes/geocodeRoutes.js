// ============================================================
// GEOCODE PROXY ROUTE
// High-accuracy reverse-geocoding for fleet telematics:
// 1. OpenStreetMap (Nominatim) primary for rich granular street/village/town/district addresses
// 2. ArcGIS intelligent fallback with multi-field address resolution (never bare pincode + IND)
// In-memory LRU cache to prevent spamming upstream providers
// GET /api/geocode/reverse?lat=12.9716&lng=77.5946
// ============================================================

const express = require('express');
const router = express.Router();
const https = require('https');

// In-memory cache: ~110m resolution (3 decimal places)
const addressCache = new Map();
const MAX_CACHE_SIZE = 10000;

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

  // If LongLabel is a full street address (not just pincode like "631051, IND" or "631052, IND")
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

router.get('/reverse', async (req, res) => {
  const { lat, lng } = req.query;

  if (!lat || !lng || isNaN(parseFloat(lat)) || isNaN(parseFloat(lng))) {
    return res.status(400).json({ success: false, error: 'lat and lng query params are required.' });
  }

  const parsedLat = parseFloat(lat);
  const parsedLng = parseFloat(lng);
  const cacheKey = `${parsedLat.toFixed(3)},${parsedLng.toFixed(3)}`;

  if (addressCache.has(cacheKey)) {
    return res.json({ success: true, label: addressCache.get(cacheKey), cached: true });
  }

  let finalLabel = null;

  // 1. Try OpenStreetMap (Nominatim) first for granular road, village, taluk, district address
  try {
    const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${parsedLat}&lon=${parsedLng}&zoom=18&addressdetails=1`;
    const osmData = await fetchJSON(osmUrl, {
      headers: { 'User-Agent': 'FuelTracks-Fleet-Portal/1.0' }
    }, 2500);

    const osmLabel = formatOSMAddress(osmData);
    if (osmLabel && osmLabel.length > 5) {
      finalLabel = osmLabel;
    }
  } catch (err) {
    // OSM timed out or failed, fallback to ArcGIS
  }

  // 2. Fallback to ArcGIS with intelligent multi-field address builder
  if (!finalLabel) {
    try {
      const arcgisUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?location=${encodeURIComponent(parsedLng)},${encodeURIComponent(parsedLat)}&f=json`;
      const arcgisData = await fetchJSON(arcgisUrl, {}, 2500);
      const arcLabel = formatArcGISAddress(arcgisData);
      if (arcLabel && arcLabel.length > 5) {
        finalLabel = arcLabel;
      }
    } catch (err) {
      // ArcGIS also failed
    }
  }

  if (finalLabel) {
    if (addressCache.size >= MAX_CACHE_SIZE) {
      const first = addressCache.keys().next().value;
      addressCache.delete(first);
    }
    addressCache.set(cacheKey, finalLabel);
    return res.json({ success: true, label: finalLabel });
  }

  return res.json({ success: true, label: `${parsedLat.toFixed(4)}, ${parsedLng.toFixed(4)}` });
});

module.exports = router;
