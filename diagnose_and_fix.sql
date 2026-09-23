-- ============================================================
-- FuelTracks: API Key Diagnostic & Fix Queries
-- Run these on the Hetzner server:
--   psql -U postgres -d fueltracks -p 5433 -f diagnose_and_fix.sql
-- Or paste into psql one section at a time.
-- ============================================================

\echo ''
\echo '══════════════════════════════════════════════════════'
\echo '📋 STEP 1 — ALL ORGANIZATIONS'
\echo '══════════════════════════════════════════════════════'
SELECT id, name, type, is_active
FROM organizations
ORDER BY name;

\echo ''
\echo '══════════════════════════════════════════════════════'
\echo '🚛 STEP 2 — ALL VEHICLES (showing plate + org)'
\echo '══════════════════════════════════════════════════════'
SELECT v.plate, v.imei, v.is_active, o.name AS org_name, v.org_id
FROM vehicles v
JOIN organizations o ON o.id = v.org_id
ORDER BY v.plate;

\echo ''
\echo '══════════════════════════════════════════════════════'
\echo '🔑 STEP 3 — ALL API KEYS'
\echo '══════════════════════════════════════════════════════'
-- Check if group_id column exists, add it if not
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='api_keys' AND column_name='group_id'
  ) THEN
    ALTER TABLE api_keys ADD COLUMN group_id UUID REFERENCES groups(id) ON DELETE SET NULL;
    RAISE NOTICE 'group_id column added to api_keys table.';
  ELSE
    RAISE NOTICE 'group_id column already exists.';
  END IF;
END $$;

SELECT ak.id, ak.key_prefix, ak.name, ak.is_active,
       ak.org_id, ak.group_id, ak.last_used_at,
       o.name AS linked_org_name
FROM api_keys ak
JOIN organizations o ON o.id = ak.org_id
ORDER BY ak.created_at;

\echo ''
\echo '══════════════════════════════════════════════════════'
\echo '🔍 STEP 4 — MISMATCH CHECK'
\echo '  Shows API key org vs. vehicle org'
\echo '══════════════════════════════════════════════════════'
SELECT
  ak.key_prefix,
  ak.name AS key_label,
  o_key.name AS api_key_org,
  (SELECT COUNT(*) FROM vehicles v WHERE v.org_id = ak.org_id AND v.is_active = TRUE) AS vehicles_visible_to_key,
  (SELECT COUNT(*) FROM vehicles) AS total_vehicles_in_db
FROM api_keys ak
JOIN organizations o_key ON o_key.id = ak.org_id;

\echo ''
\echo '══════════════════════════════════════════════════════'
\echo '🔧 STEP 5 — FIX: Update API key to correct org'
\echo '  ONLY runs if vehicles_visible_to_key = 0'
\echo '  It re-links the API key to the org that owns vehicles'
\echo '══════════════════════════════════════════════════════'

-- This updates the FIRST api key to point to the org that has the most vehicles
-- Review the output of steps 2 and 3 before running this
UPDATE api_keys
SET org_id = (
  SELECT v.org_id
  FROM vehicles v
  WHERE v.is_active = TRUE
  GROUP BY v.org_id
  ORDER BY COUNT(*) DESC
  LIMIT 1
)
WHERE id IN (
  -- Only update keys that currently see 0 vehicles
  SELECT ak.id FROM api_keys ak
  WHERE NOT EXISTS (
    SELECT 1 FROM vehicles v
    WHERE v.org_id = ak.org_id AND v.is_active = TRUE
  )
)
RETURNING id, key_prefix, org_id;

\echo ''
\echo '══════════════════════════════════════════════════════'
\echo '✅ VERIFICATION — After fix, key should see vehicles'
\echo '══════════════════════════════════════════════════════'
SELECT
  ak.key_prefix,
  o.name AS now_linked_to_org,
  COUNT(v.id) AS vehicles_now_visible
FROM api_keys ak
JOIN organizations o ON o.id = ak.org_id
LEFT JOIN vehicles v ON v.org_id = ak.org_id AND v.is_active = TRUE
GROUP BY ak.key_prefix, o.name;

\echo ''
\echo '══════════════════════════════════════════════════════'
\echo '📍 STEP 6 — ROUTE TRUTH (for your reference)'
\echo '══════════════════════════════════════════════════════'
\echo ''
\echo 'CORRECT endpoints (NOT /api/v12):'
\echo '  GET  /api/v1/vehicles                              -> vehicle list'
\echo '  GET  /api/v1/location/live?imei=<IMEI>            -> live location'
\echo '  POST /api/v1/location/live  body:{vehicleRegistrationNumber:...} -> live by plate'
\echo '  GET  /api/v1/location/history?imei=<IMEI>&start=YYYY-MM-DD&end=YYYY-MM-DD'
\echo '  POST /api/v1/location/history  body:{imei:...,start:...,end:...}'
\echo ''
\echo '/api/v12 does NOT exist. The integration guide had wrong endpoint docs.'
\echo 'Done!'
