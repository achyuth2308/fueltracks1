INSERT INTO devices (device_id, org_id) 
SELECT '865947080002518', org_id 
FROM devices WHERE device_id = '865947080013812';
