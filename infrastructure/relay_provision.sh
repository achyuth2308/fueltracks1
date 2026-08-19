#!/bin/bash
set -e
# =====================================================================
# FUELTRACKS RELAY VPS PROVISIONING SCRIPT — HETZNER
# Target: Hetzner CX22 (or smallest available), Singapore
# Purpose: Forward all GPS device TCP traffic to the backend server
# Usage: sudo ./relay_provision.sh <BACKEND_SERVER_IP>
# =====================================================================

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo ./relay_provision.sh)"
  exit 1
fi

if [ -z "$1" ]; then
  echo "ERROR: Backend IP required."
  echo "Usage: sudo ./relay_provision.sh <BACKEND_SERVER_IP>"
  exit 1
fi

BACKEND_IP=$1
echo "Configuring relay to forward traffic to $BACKEND_IP..."

apt-get update
apt-get install -y socat supervisor ufw fail2ban

# Kernel tuning
cat <<EOF > /etc/sysctl.d/99-relay.conf
fs.file-max = 1048576
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
EOF
sysctl --system

# Supervisor config — one forwarder per protocol port
cat <<EOF > /etc/supervisor/conf.d/fueltracks-relay.conf
[program:relay-bstpl]
command=socat TCP-LISTEN:5000,fork,reuseaddr TCP:$BACKEND_IP:5000
autostart=true
autorestart=true
user=root

[program:relay-ais140]
command=socat TCP-LISTEN:5001,fork,reuseaddr TCP:$BACKEND_IP:5001
autostart=true
autorestart=true
user=root

[program:relay-concox]
command=socat TCP-LISTEN:5002,fork,reuseaddr TCP:$BACKEND_IP:5002
autostart=true
autorestart=true
user=root

[program:relay-ais140v2]
command=socat TCP-LISTEN:5003,fork,reuseaddr TCP:$BACKEND_IP:5003
autostart=true
autorestart=true
user=root

[program:relay-volty]
command=socat TCP-LISTEN:5004,fork,reuseaddr TCP:$BACKEND_IP:5004
autostart=true
autorestart=true
user=root

[program:relay-fmb920]
command=socat TCP-LISTEN:5005,fork,reuseaddr TCP:$BACKEND_IP:5005
autostart=true
autorestart=true
user=root
EOF

systemctl restart supervisor
systemctl enable supervisor

# Firewall — relay stays open to the world on device ports (devices
# connect from anywhere), SSH is what needs restricting
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 5000:5005/tcp
echo "NOTE: run 'ufw enable' after verifying SSH access."

# fail2ban for SSH brute-force protection
systemctl enable fail2ban
systemctl start fail2ban

echo ""
echo "✅ RELAY PROVISIONING COMPLETE"
echo "Forwarding ports 5000-5005 to $BACKEND_IP"
echo "Check status: supervisorctl status"
echo "Run 'ufw enable' when ready."
