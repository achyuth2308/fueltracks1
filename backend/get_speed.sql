SELECT p.plate, v.lat, v.lng, v.speed FROM vehicle_latest_state v JOIN vehicles p ON p.id = v.vehicle_id WHERE p.org_id = (SELECT org_id FROM vehicles WHERE plate = 'AP39TV6179' LIMIT 1);
