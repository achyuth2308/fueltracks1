SELECT COUNT(*) FROM gps_points gp JOIN vehicles v ON gp.vehicle_id = v.id WHERE v.plate = 'AP39WH7388' AND gp.device_time >= CURRENT_DATE;
