SELECT raw_hex, packet_type, device_time, parsed_data FROM raw_packets WHERE imei = '865947080002518' AND raw_hex IS NOT NULL ORDER BY received_at DESC LIMIT 5;
