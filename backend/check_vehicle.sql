SELECT id, imei, name, plate, metadata->>'engineOn' AS engine_on_pref, metadata->>'batteryVoltage' AS battery_thresh FROM vehicles WHERE imei = '865947080002518';
