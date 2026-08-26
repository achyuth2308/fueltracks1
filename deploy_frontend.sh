cd /home/fueltracks/fueltracks1/frontend
git pull origin main
npm install
npm run build
sudo cp -r dist/* /var/www/html/
sudo systemctl restart nginx
echo "DEPLOYMENT COMPLETE"
