SELECT id, imei, name, updated_at FROM vehicles WHERE updated_at > NOW() - INTERVAL '2 hours' ORDER BY updated_at DESC;
