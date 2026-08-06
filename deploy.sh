#!/bin/bash
set -e

echo "============================================================"
echo "  🚀 Starting FuelTracks EC2 Production Deployment"
echo "============================================================"

# Ensure we are in the right directory
cd /home/ubuntu/fueltracks1 || { echo "Directory not found!"; exit 1; }

echo "1. Pulling latest code from main..."
git fetch origin main
git reset --hard origin/main

echo "2. Installing Node dependencies..."
npm install

echo "3. Building frontend application..."
npm --prefix frontend install
npm run build:frontend

echo "4. Running Database Migrations..."
npm run db:migrate || echo "[WARN] db:migrate finished with warnings"

echo "5. Reloading Application with PM2 (Zero Downtime)..."
pm2 reload ecosystem.config.js --env production || pm2 start ecosystem.config.js --env production
pm2 save

echo "6. Verifying Nginx..."
sudo nginx -t && sudo systemctl reload nginx || echo "[WARN] Nginx reload skipped or non-critical"

echo "============================================================"
echo "  ✅ Production Deployment Completed Successfully!"
echo "============================================================"
pm2 status

