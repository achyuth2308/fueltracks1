#!/bin/bash
set -e
# =====================================================================
# FUELTRACKS CONTABO VPS PROVISIONING SCRIPT
# Target: Contabo VPS 4 (8GB RAM, 4 vCPU, 100GB NVMe) | OS: Ubuntu 24.04
# =====================================================================

# Must run as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo ./contabo_provision.sh)"
  exit 1
fi

echo "Starting FuelTracks server provisioning..."

# 1. System Update & Dependencies
apt-get update && apt-get upgrade -y
apt-get install -y curl wget gnupg2 ufw htop git vim socat unzip jq

# 2. Kernel & TCP Tuning (for high concurrent connections)
echo "Tuning Kernel and TCP stack..."
cat <<EOF > /etc/sysctl.d/99-fueltracks.conf
# Increase max file descriptors
fs.file-max = 1048576

# TCP Keepalive Tuning (drop dead device connections faster)
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_probes = 5
net.ipv4.tcp_keepalive_intvl = 15

# Increase connection queue size
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535

# Fast TCP reuse
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15

# Protection against SYN floods
net.ipv4.tcp_syncookies = 1
EOF
sysctl --system

# Ulimits tuning for the 'ubuntu' or 'root' user running node
cat <<EOF > /etc/security/limits.d/fueltracks.conf
* soft nofile 1048576
* hard nofile 1048576
EOF

# 3. Node.js 20 & PM2
echo "Installing Node.js 20 and PM2..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g pm2 yarn
pm2 set pm2:logrotate true
mkdir -p /var/log/pm2
chmod 777 /var/log/pm2

# 4. Redis (Cache & PubSub)
echo "Installing & Tuning Redis..."
apt-get install -y redis-server
# Tune Redis for 8GB server: max 1GB, LRU eviction, turn off append-only (it's just a cache)
sed -i 's/^# maxmemory <bytes>/maxmemory 1gb/' /etc/redis/redis.conf
sed -i 's/^# maxmemory-policy noeviction/maxmemory-policy allkeys-lru/' /etc/redis/redis.conf
sed -i 's/^appendonly yes/appendonly no/' /etc/redis/redis.conf
systemctl restart redis-server
systemctl enable redis-server

# 5. PostgreSQL 16 & TimescaleDB
echo "Installing PostgreSQL 16 & TimescaleDB..."
# Add PostgreSQL official repo
sh -c 'echo "deb https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -

# Add TimescaleDB repo
curl -L https://packagecloud.io/timescale/timescaledb/gpgkey | sudo gpg --dearmor -o /etc/apt/keyrings/timescale.gpg --yes
echo "deb [signed-by=/etc/apt/keyrings/timescale.gpg] https://packagecloud.io/timescale/timescaledb/ubuntu/ $(lsb_release -c -s) main" | sudo tee /etc/apt/sources.list.d/timescaledb.list

apt-get update
apt-get install -y postgresql-16 timescaledb-2-postgresql-16

# Tune PostgreSQL for 8GB RAM using Timescale tuner
timescaledb-tune --quiet --yes

# Additional PG Tuning for high write throughput
cat <<EOF >> /etc/postgresql/16/main/postgresql.conf
# Custom FuelTracks Tuning
shared_buffers = 2GB
effective_cache_size = 4GB
work_mem = 16MB
maintenance_work_mem = 256MB
max_connections = 200
wal_buffers = 16MB
checkpoint_completion_target = 0.9
random_page_cost = 1.1  # For NVMe
EOF

systemctl restart postgresql
systemctl enable postgresql

# Create database and user
sudo -u postgres psql -c "CREATE USER fuel WITH PASSWORD 'fuel_db_pass_CHANGE_ME';" || true
sudo -u postgres psql -c "CREATE DATABASE fueltracks OWNER fuel;" || true
sudo -u postgres psql -d fueltracks -c "CREATE EXTENSION IF NOT EXISTS timescaledb;" || true
sudo -u postgres psql -d fueltracks -c "CREATE EXTENSION IF NOT EXISTS postgis;" || true # If using PostGIS

# 6. Nginx
echo "Installing Nginx..."
apt-get install -y nginx
systemctl enable nginx

# 7. UFW Firewall Setup
echo "Configuring Firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp          # SSH
ufw allow 80/tcp          # HTTP (for SSL certbot)
ufw allow 443/tcp         # HTTPS
# Allow GPS Device TCP Ports (ONLY from Relay IP if you know it, otherwise open to all)
ufw allow 5000/tcp        # BSTPL
ufw allow 5001/tcp        # AIS140
ufw allow 5002/tcp        # Concox
ufw allow 5003/tcp        # AIS140 V2
ufw allow 5004/tcp        # Volty

# ufw --force enable  # (Commented out to prevent locking out user during blind run)
echo "NOTE: Run 'ufw enable' manually after verifying SSH access."

echo ""
echo "======================================================================"
echo "✅ PROVISIONING COMPLETE"
echo "Next Steps:"
echo "1. Verify DB: sudo -u postgres psql -c '\l'"
echo "2. Check Redis: redis-cli ping"
echo "3. Run 'ufw enable' to start firewall"
echo "4. Deploy code and run 'pm2 start ecosystem.config.js --env production'"
echo "======================================================================"
