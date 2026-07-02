SELECT v.name, v.imei, vls.gsm_signal, vls.satellites, vls.odometer FROM vehicles v JOIN vehicle_latest_state vls ON v.id = vls.vehicle_id WHERE v.name = 'WINDSOR';
