SELECT lat, lng, COUNT(*) FROM vehicle_latest_state WHERE lat IS NOT NULL AND lat != 0 GROUP BY lat, lng HAVING COUNT(*) > 1 ORDER BY COUNT(*) DESC LIMIT 5;
