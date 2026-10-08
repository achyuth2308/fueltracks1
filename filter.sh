#!/bin/bash
for imei in $(cat /home/fueltracks/recent_imeis.txt); do
  count=$(sudo -u postgres psql -d fueltracks -tAc "SELECT count(*) FROM vehicles WHERE imei='$imei'")
  if [ "$count" -eq "0" ]; then
    echo $imei
  fi
done
