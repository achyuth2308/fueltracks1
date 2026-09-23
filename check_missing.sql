SELECT v.id, v.imei, v.name FROM vehicles v LEFT JOIN devices d ON v.imei = d.device_id WHERE d.device_id IS NULL;
