SELECT COUNT(*), MAX(received_at) FROM raw_packets WHERE imei = '861329080867568';
SELECT received_at, packet_type, SUBSTRING(raw, 1, 60) as raw_preview FROM raw_packets WHERE imei = '861329080867568' ORDER BY received_at DESC LIMIT 10;
SELECT received_at, packet_type FROM raw_packets ORDER BY received_at DESC LIMIT 5;
