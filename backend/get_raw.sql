SELECT raw_hex FROM raw_packets WHERE imei = (SELECT imei FROM vehicles WHERE plate = 'AP39TV6179') ORDER BY id DESC LIMIT 5;
