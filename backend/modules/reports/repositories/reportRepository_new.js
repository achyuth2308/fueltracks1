const db = require('../../../config/db');

// ─── Shared PostgreSQL Haversine expression ───────────────────────────────────
// Computes distance in km between consecutive GPS points using LAG().
// Guards against floating-point domain errors with GREATEST/LEAST clamp.
// Filters out:
//   - segments with time gap > 10 minutes (signal loss / overnight)
//   - segments > 5 km in one step (teleport / GPS corrupt)
const HAVERSINE_SEGMENT_KM = `
  CASE
    WHEN prev_lat IS NOT NULL AND prev_lng IS NOT NULL
         AND prev_time IS NOT NULL
         AND EXTRACT(EPOCH FROM (device_time - prev_time)) < 600
         AND (6371 * acos(GREATEST(-1.0, LEAST(1.0,
               cos(radians(prev_lat)) * cos(radians(lat)) *
               cos(radians(lng) - radians(prev_lng)) +
               sin(radians(prev_lat)) * sin(radians(lat))
             )))) < 5
    THEN 6371 * acos(GREATEST(-1.0, LEAST(1.0,
           cos(radians(prev_lat)) * cos(radians(lat)) *
           cos(radians(lng) - radians(prev_lng)) +
           sin(radians(prev_lat)) * sin(radians(lat))
         )))
    ELSE 0
  END
`;
