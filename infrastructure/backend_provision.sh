#!/bin/bash
set -e
# =====================================================================
# FUELTRACKS BACKEND VPS PROVISIONING SCRIPT — HETZNER
# Target: Hetzner CPX (8GB/4vCPU), Singapore, Ubuntu 24.04
# Usage: sudo ./backend_provision.sh <RELAY_SERVER_IP> <ADMIN_IP>
# =====================================================================

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root"
  exit 1
fi

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: sudo ./backend_provision.sh <RELAY_IP> <ADMIN_IP>"
  echo "RELAY_IP: the relay server's IP (only source allowed on GPS ports)"
  echo "ADMIN_IP: your own IP, for restricted SSH access"
  exit 1
fi

RELAY_IP=$1
ADMIN_IP=$2

echo "Provisioning backend, relay=$RELAY_IP, admin=$ADMIN_IP..."

# 1. System update
apt-get update && apt-get upgrade -y
apt-get install -y curl wget gnupg2 ufw htop git vim socat unzip jq fail2ban

# 2. Dedicated non-root user for the app
useradd -m -s /bin/bash fueltracks || true

# 3. Kernel/TCP tuning
cat <<EOF > /etc/sysctl.d/99-fueltracks.conf
fs.file-max = 1048576
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_probes = 5
net.ipv4.tcp_keepalive_intvl = 15
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_syncookies = 1
EOF
sysctl --system

cat <<EOF > /etc/security/limits.d/fueltracks.conf
* soft nofile 1048576
* hard nofile 1048576
EOF

# 4. Swap file — protects against OOM killer taking down Postgres/Redis
if [ ! -f /swapfile ]; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# 5. Node.js 20 + PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g pm2 yarn
pm2 set pm2:logrotate true
mkdir -p /var/log/pm2
chown fueltracks:fueltracks /var/log/pm2

# 6. Redis
apt-get install -y redis-server
sed -i 's/^# maxmemory <bytes>/maxmemory 1gb/' /etc/redis/redis.conf
sed -i 's/^# maxmemory-policy noeviction/maxmemory-policy allkeys-lru/' /etc/redis/redis.conf
sed -i 's/^appendonly yes/appendonly no/' /etc/redis/redis.conf
systemctl restart redis-server
systemctl enable redis-server

# 7. PostgreSQL 16 + TimescaleDB
sh -c 'echo "deb https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/keyrings/postgresql.gpg
curl -L https://packagecloud.io/timescale/timescaledb/gpgkey | gpg --dearmor -o /etc/apt/keyrings/timescale.gpg --yes
echo "deb [signed-by=/etc/apt/keyrings/timescale.gpg] https://packagecloud.io/timescale/timescaledb/ubuntu/ $(lsb_release -c -s) main" > /etc/apt/sources.list.d/timescaledb.list

apt-get update
apt-get install -y postgresql-16 timescaledb-2-postgresql-16

timescaledb-tune --quiet --yes

# FIXED: max_connections lowered to 50 (was 200) — app uses connection
# pooling, Postgres doesn't need many raw connections. 200 risked
# memory pressure combined with shared_buffers on an 8GB box.
cat <<EOF >> /etc/postgresql/16/main/postgresql.conf
# Custom FuelTracks Tuning
shared_buffers = 2GB
effective_cache_size = 4GB
work_mem = 16MB
maintenance_work_mem = 256MB
max_connections = 50
wal_buffers = 16MB
checkpoint_completion_target = 0.9
random_page_cost = 1.1
EOF

systemctl restart postgresql
systemctl enable postgresql

# Generate a real random password instead of a placeholder
DB_PASS=$(openssl rand -base64 24)
sudo -u postgres psql -c "CREATE USER fuel WITH PASSWORD '$DB_PASS';" || true
sudo -u postgres psql -c "CREATE DATABASE fueltracks OWNER fuel;" || true
sudo -u postgres psql -d fueltracks -c "CREATE EXTENSION IF NOT EXISTS timescaledb;" || true
echo "DB_PASSWORD=$DB_PASS" > /home/fueltracks/.db_credentials
chown fueltracks:fueltracks /home/fueltracks/.db_credentials
chmod 600 /home/fueltracks/.db_credentials
echo "Generated DB password saved to /home/fueltracks/.db_credentials — move into .env"

# NOTE: PostGIS intentionally omitted. If geospatial queries are
# needed later, install postgresql-16-postgis-3 BEFORE creating the
# extension, don't create it blind.

# 8. Nginx
apt-get install -y nginx
systemctl enable nginx

# 9. Firewall — FIXED: GPS ports restricted to relay IP only,
# SSH restricted to admin IP only (not open to the world)
ufw default deny incoming
ufw default allow outgoing
ufw allow from $ADMIN_IP to any port 22 proto tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow from $RELAY_IP to any port 5000 proto tcp
ufw allow from $RELAY_IP to any port 5001 proto tcp
ufw allow from $RELAY_IP to any port 5002 proto tcp
ufw allow from $RELAY_IP to any port 5003 proto tcp
ufw allow from $RELAY_IP to any port 5004 proto tcp
ufw allow from $RELAY_IP to any port 5005 proto tcp  # FMB920

systemctl enable fail2ban
systemctl start fail2ban

echo "NOTE: run 'ufw enable' after verifying SSH access from $ADMIN_IP works."

echo ""
echo "✅ BACKEND PROVISIONING COMPLETE"
echo "Next steps:"
echo "1. Verify DB: sudo -u postgres psql -c '\l'"
echo "2. Check Redis: redis-cli ping"
echo "3. Move DB_PASSWORD from /home/fueltracks/.db_credentials into .env"
echo "4. Run 'ufw enable'"
echo "5. Deploy code as the 'fueltracks' user, not root"
echo "6. Run: pm2 start ecosystem.config.js --env production"
