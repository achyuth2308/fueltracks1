SELECT vls.vehicle_id, v.imei, vls.ignition, vls.voltage, vls.speed, vls.last_seen, vls.is_online
FROM vehicle_latest_state vls
JOIN vehicles v ON v.id = vls.vehicle_id
WHERE v.imei = '865947080002518';
