SELECT packet_type, parsed, error, parsed_json->>'ignition' AS ign, device_time FROM raw_packets WHERE imei='860657056471598' ORDER BY created_at DESC LIMIT 20;
