$query = "SELECT v.name, v.plate, v.metadata->>'odometerReading' as baseline_odo, vls.odometer as gps_odo, (COALESCE(vls.odometer,0) + COALESCE(CAST(NULLIF(v.metadata->>'odometerReading','') AS NUMERIC),0)) as current_odo FROM vehicles v LEFT JOIN vehicle_latest_state vls ON v.id = vls.vehicle_id LIMIT 10;"

ssh -o StrictHostKeyChecking=no -i "KeyPair (1).pem" ubuntu@13.239.125.98 "PGPASSWORD=achyux psql -h 127.0.0.1 -U postgres -d fueltracks -c '$query'"
