#!/bin/bash
PGPASSWORD=achyux psql -h 127.0.0.1 -U postgres -d fueltracks << 'EOF'
SELECT 
  v.name,
  vls.odometer as gps_odo,
  v.metadata->>'odometerReading' as baseline,
  v.metadata->>'odometerSnapshot' as snapshot,
  CASE 
    WHEN v.metadata->>'odometerReading' IS NOT NULL 
      AND v.metadata->>'odometerReading' != '' 
      AND v.metadata->>'odometerReading' != '0'
    THEN COALESCE(CAST(NULLIF(v.metadata->>'odometerReading','') AS NUMERIC), 0) 
         + GREATEST(0, COALESCE(vls.odometer, 0) - COALESCE(CAST(NULLIF(v.metadata->>'odometerSnapshot','') AS NUMERIC), 0))
    ELSE COALESCE(vls.odometer, 0)
  END as displayed_odometer
FROM vehicles v
LEFT JOIN vehicle_latest_state vls ON v.id = vls.vehicle_id;
EOF
