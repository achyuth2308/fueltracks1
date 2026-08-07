#!/bin/bash
set -e
echo "Resuming server provisioning..."

# Remove old broken timescale PPAs
sudo rm -f /etc/apt/sources.list.d/*timescale*

# Use official PackageCloud repository and force 'jammy' (Ubuntu 22.04 LTS) for compatibility
curl -L "https://packagecloud.io/timescale/timescaledb/gpgkey" 2> /dev/null | sudo gpg --dearmor -o /etc/apt/keyrings/timescale.gpg --yes
echo "deb [signed-by=/etc/apt/keyrings/timescale.gpg] https://packagecloud.io/timescale/timescaledb/ubuntu/ jammy main" | sudo tee /etc/apt/sources.list.d/timescaledb.list

sudo apt update
sudo apt install timescaledb-2-postgresql-15 -y
sudo timescaledb-tune --quiet --yes || true
sudo systemctl restart postgresql

# 5. Database Setup
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'fuel';"
sudo -u postgres psql -c "CREATE DATABASE fueltracks;" || true

echo "Server provisioning complete!"
