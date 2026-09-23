SELECT id, imei, ignition, ST_AsText(location) as loc, updated_at FROM vehicles WHERE imei = '352312096157725';
