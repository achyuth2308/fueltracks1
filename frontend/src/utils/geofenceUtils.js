// ============================================================
// GEOFENCE UTILITIES & GEOMETRY CALCULATIONS
// ============================================================

const EARTH_RADIUS_METERS = 6378137; // WGS84 authalic radius

/**
 * Robustly parses coordinates into an array of { lat, lng } points.
 * Handles:
 * - JSON string or Array
 * - GeoJSON format: [[lng, lat], ...] or [[[lng, lat], ...]]
 * - Object format: [{ lat, lng }, ...] or [{ latitude, longitude }, ...]
 * - Auto-detection of flipped [lng, lat] vs [lat, lng]
 */
export function normalizeCoordinates(raw) {
  if (!raw) return [];
  let data = raw;

  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.warn('Failed to parse coordinates JSON:', e.message);
      return [];
    }
  }

  // Handle GeoJSON MultiPolygon or nested Polygon features
  if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0]) && Array.isArray(data[0][0])) {
    data = data[0];
  }

  if (!Array.isArray(data)) return [];

  const points = [];

  for (const item of data) {
    if (!item) continue;

    let lat = null;
    let lng = null;

    if (Array.isArray(item) && item.length >= 2) {
      const v0 = Number(item[0]);
      const v1 = Number(item[1]);

      // Detect flipped coordinates:
      // In GeoJSON, convention is [lng, lat].
      // For India/Asia, lat is approx 8..37, lng is approx 68..98.
      // If v0 is outside [-90, 90] and v1 is inside [-90, 90], then v0 is lng and v1 is lat.
      if (Math.abs(v0) > 90 && Math.abs(v1) <= 90) {
        lng = v0;
        lat = v1;
      } else if (v0 > 60 && v1 < 40) {
        // Obvious India flipped coordinates [lng, lat]
        lng = v0;
        lat = v1;
      } else {
        // Standard [lat, lng]
        lat = v0;
        lng = v1;
      }
    } else if (typeof item === 'object') {
      const rawLat = item.lat ?? item.latitude;
      const rawLng = item.lng ?? item.lon ?? item.longitude;

      if (rawLat !== undefined && rawLng !== undefined) {
        lat = Number(rawLat);
        lng = Number(rawLng);
      }
    }

    if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
      points.push({ lat, lng });
    }
  }

  return points;
}

/**
 * Calculates the centroid of a polygon or array of points.
 */
export function getPolygonCentroid(points) {
  const pts = normalizeCoordinates(points);
  if (!pts || pts.length === 0) return { lat: 17.207174, lng: 78.314323 };
  if (pts.length === 1) return pts[0];

  let totalLat = 0;
  let totalLng = 0;
  for (const p of pts) {
    totalLat += p.lat;
    totalLng += p.lng;
  }
  return {
    lat: totalLat / pts.length,
    lng: totalLng / pts.length,
  };
}

/**
 * Computes polygon area in square meters using spherical Shoelace formula on projected coordinates.
 */
export function calculatePolygonAreaM2(points) {
  const pts = normalizeCoordinates(points);
  if (pts.length < 3) return 0;

  // Project lat/lng to local metric coordinates using mean latitude
  const centroid = getPolygonCentroid(pts);
  const rad = Math.PI / 180;
  const latMeanRad = centroid.lat * rad;

  const xy = pts.map(p => ({
    x: (p.lng - centroid.lng) * rad * EARTH_RADIUS_METERS * Math.cos(latMeanRad),
    y: (p.lat - centroid.lat) * rad * EARTH_RADIUS_METERS,
  }));

  // Standard 2D Shoelace formula
  let area = 0;
  const n = xy.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += xy[i].x * xy[j].y;
    area -= xy[j].x * xy[i].y;
  }

  return Math.abs(area) / 2;
}

/**
 * Computes circle area in square meters (pi * r^2).
 */
export function calculateCircleAreaM2(radiusMeters) {
  const r = Number(radiusMeters) || 0;
  return Math.PI * r * r;
}

/**
 * Formats area nicely in m² or km².
 */
export function formatArea(areaM2) {
  const a = Number(areaM2) || 0;
  if (a >= 1000000) {
    return `${(a / 1000000).toFixed(2)} km²`;
  }
  if (a >= 10000) {
    return `${(a / 10000).toFixed(2)} ha`;
  }
  return `${Math.round(a).toLocaleString()} m²`;
}

/**
 * Formats distance/radius nicely in m or km.
 */
export function formatRadius(radiusMeters) {
  const r = Number(radiusMeters) || 0;
  if (r >= 1000) {
    return `${(r / 1000).toFixed(1)} km`;
  }
  return `${Math.round(r)} m`;
}

export const formatDistance = formatRadius;

/**
 * Calculates straight-line distance in meters between two lat/lng points.
 */
export function calculateHaversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // meters
  const dLat = ((Number(lat2) - Number(lat1)) * Math.PI) / 180;
  const dLon = ((Number(lon2) - Number(lon1)) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((Number(lat1) * Math.PI) / 180) *
      Math.cos((Number(lat2) * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const GEOFENCE_COLOR_PALETTE = [
  { hex: '#3B82F6', label: 'Blue', border: '#1D4ED8' },
  { hex: '#10B981', label: 'Green', border: '#047857' },
  { hex: '#F59E0B', label: 'Amber', border: '#B45309' },
  { hex: '#EF4444', label: 'Red', border: '#B91C1C' },
  { hex: '#8B5CF6', label: 'Purple', border: '#6D28D9' },
  { hex: '#06B6D4', label: 'Teal', border: '#0E7490' },
  { hex: '#EC4899', label: 'Pink', border: '#BE185D' },
  { hex: '#6366F1', label: 'Indigo', border: '#4338CA' },
];
