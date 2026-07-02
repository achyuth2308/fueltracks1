#!/bin/bash
set -e
cd /home/ubuntu/fueltracks1 || exit 1

echo "Running Database Migrations..."
npm run db:migrate
sudo -u postgres psql -d fueltracks -f database/timescale_migration.sql

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
sudo certbot --nginx -d api.fueltracks.in -d app.fueltracks.in --non-interactive --agree-tos -m info@fueltracks.in --redirect || echo "Certbot failed (maybe DNS hasn't propagated yet?)"

echo "Deployment Resume Finished!"
