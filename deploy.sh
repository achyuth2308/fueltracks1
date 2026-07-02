#!/bin/bash
set -e

echo "============================================================"
echo "  🚀 Starting FuelTracks EC2 Deployment"
echo "============================================================"

# Ensure we are in the right directory
cd /home/ubuntu/fueltracks1 || { echo "Directory not found!"; exit 1; }

echo "Pulling latest code..."
git pull origin main

echo "Installing Node dependencies..."
npm install

echo "Building frontend..."
npm run build:frontend

echo "Setting up PM2 Limits..."
# Ensure PM2 can open enough file descriptors for 15k devices
sudo bash -c 'cat <<EOF > /etc/systemd/system/pm2-ubuntu.service.d/limits.conf
[Service]
LimitNOFILE=65535
EOF' || true
sudo systemctl daemon-reload || true

echo "Starting application with PM2..."
pm2 stop all || true
npm run pm2:start
pm2 save

echo "Running Database Migrations..."
npm run db:migrate
sudo -u postgres psql -d fueltracks -f database/timescale_migration.sql

echo "Installing Nginx & Certbot..."
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx -y

echo "Configuring Nginx Reverse Proxy..."
sudo bash -c 'cat <<EOF > /etc/nginx/sites-available/fueltracks
# BACKEND API (api.fueltracks.in)
server {
    listen 80;
    server_name api.fueltracks.in;
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

# FRONTEND WEB APP (app.fueltracks.in)
server {
    listen 80;
    server_name app.fueltracks.in;
    
    root /home/ubuntu/fueltracks1/frontend/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF'

# Enable the site
sudo ln -sf /etc/nginx/sites-available/fueltracks /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

echo "Securing with Certbot (Let's Encrypt SSL)..."
# Non-interactive SSL cert generation
sudo certbot --nginx -d api.fueltracks.in -d app.fueltracks.in --non-interactive --agree-tos -m info@fueltracks.in --redirect || echo "Certbot failed (maybe DNS hasn't propagated yet?)"

echo "============================================================"
echo "  ✅ Deployment Script Finished!"
echo "============================================================"
