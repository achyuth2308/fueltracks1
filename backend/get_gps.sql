SELECT COUNT(*) FROM gps_points WHERE vehicle_id = (SELECT id FROM vehicles WHERE plate = 'AP39TV6179' LIMIT 1) AND device_time >= current_date;
