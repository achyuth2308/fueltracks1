#!/bin/bash
set -e

cd /home/ubuntu/fueltracks1

echo "Fixing TimescaleDB Schema..."
sudo -u postgres psql -d fueltracks -c "ALTER TABLE gps_points DROP CONSTRAINT IF EXISTS gps_points_pkey CASCADE;"
sudo -u postgres psql -d fueltracks -c "ALTER TABLE gps_points ADD CONSTRAINT gps_points_pkey PRIMARY KEY (id, device_time);"
sudo -u postgres psql -d fueltracks -c "SELECT create_hypertable('gps_points', 'device_time', if_not_exists => TRUE);" || echo "Hypertable already exists"

echo "Securing with Certbot (Let's Encrypt SSL)..."
sudo certbot --nginx -d api.fueltracks.in -d app.fueltracks.in --non-interactive --agree-tos -m info@fueltracks.in --redirect

echo "Done!"
