// ============================================================
// GEOCODE PROXY ROUTE
// Proxies reverse-geocode requests from the mobile/web app
// to ArcGIS so CORS is never an issue on web builds.
// GET /api/geocode/reverse?lat=12.9716&lng=77.5946
// No auth required — lat/lng are not sensitive.
// ============================================================

const express = require('express');
const router = express.Router();
const https = require('https');

router.get('/reverse', (req, res) => {
  const { lat, lng } = req.query;

  if (!lat || !lng || isNaN(parseFloat(lat)) || isNaN(parseFloat(lng))) {
    return res.status(400).json({ success: false, error: 'lat and lng query params are required.' });
  }

  const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?location=${encodeURIComponent(lng)},${encodeURIComponent(lat)}&f=json`;

  https.get(url, (upstream) => {
    let body = '';
    upstream.on('data', (chunk) => { body += chunk; });
    upstream.on('end', () => {
      try {
        const data = JSON.parse(body);
        const address = data?.address || {};
        const label =
          address.LongLabel ||
          address.Match_addr ||
          (address.Address && address.City
            ? `${address.Address}, ${address.City}`
            : address.Address) ||
          null;

        res.json({ success: true, label: label || null, raw: address });
      } catch (e) {
        res.status(502).json({ success: false, error: 'Failed to parse geocode response.' });
      }
    });
    upstream.on('error', (e) => {
      res.status(502).json({ success: false, error: e.message });
    });
  }).on('error', (e) => {
    res.status(502).json({ success: false, error: e.message });
  });
});

module.exports = router;
