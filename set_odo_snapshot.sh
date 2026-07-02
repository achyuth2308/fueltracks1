#!/bin/bash
PGPASSWORD=achyux psql -h 127.0.0.1 -U postgres -d fueltracks << 'EOF'
UPDATE vehicles v
SET metadata = v.metadata || jsonb_build_object(
  'odometerSnapshot',
  (SELECT vls.odometer::text FROM vehicle_latest_state vls WHERE vls.vehicle_id = v.id)
)
WHERE (v.metadata->>'odometerReading')::numeric > 0;
EOF
echo "Done"
