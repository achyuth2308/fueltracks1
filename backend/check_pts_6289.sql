SELECT COUNT(*) FROM gps_points gp JOIN vehicles v ON gp.vehicle_id = v.id WHERE v.plate = 'AP39TV6289' AND gp.device_time >= CURRENT_DATE;
