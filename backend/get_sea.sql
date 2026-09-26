SELECT v.vehicle_id, p.plate, v.lat, v.lng FROM vehicle_latest_state v JOIN vehicles p ON p.id = v.vehicle_id WHERE v.lat > 0 AND v.lat < 16 AND v.lng > 81;
