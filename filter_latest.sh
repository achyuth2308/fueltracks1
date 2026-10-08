#!/bin/bash
tail -n 20000 /var/log/pm2/fueltracks-tcp-out.log | grep -a -oE '[0-9]{15}' | sort | uniq > /root/latest_imeis.txt
for imei in $(cat /root/latest_imeis.txt); do
  count=$(sudo -u postgres psql -d fueltracks -tAc "SELECT count(*) FROM vehicles WHERE imei='$imei'")
  if [ "$count" -eq "0" ]; then
    echo $imei
  fi
done
