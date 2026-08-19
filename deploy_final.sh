#!/bin/bash
# =====================================================================
# ⚠️  DEPRECATED — AWS EC2 one-shot fix script, DO NOT RUN ON HETZNER
#
# This was a one-time emergency fix run during the Contabo/EC2 era:
#   - Targets /home/ubuntu/ (wrong user for Hetzner — use 'fueltracks')
#   - The TimescaleDB schema fix it performs is now handled by the
#     standard migration path (npm run db:migrate + timescale_migration.sql)
#   - Certbot is configured by deploy_fix.sh inline nginx block instead
#
# Kept for historical reference only. Do not run on Hetzner servers.
# =====================================================================
set -e

cd /home/fueltracks/fueltracks1

echo "Fixing TimescaleDB Schema..."
sudo -u postgres psql -d fueltracks -c "ALTER TABLE gps_points DROP CONSTRAINT IF EXISTS gps_points_pkey CASCADE;"
sudo -u postgres psql -d fueltracks -c "ALTER TABLE gps_points ADD CONSTRAINT gps_points_pkey PRIMARY KEY (id, device_time);"
sudo -u postgres psql -d fueltracks -c "SELECT create_hypertable('gps_points', 'device_time', if_not_exists => TRUE);" || echo "Hypertable already exists"

echo "Securing with Certbot (Let's Encrypt SSL)..."
sudo certbot --nginx -d api.fueltracks.in -d app.fueltracks.in --non-interactive --agree-tos -m info@fueltracks.in --redirect

echo "Done!"
