sudo apt-get update
sudo apt-get install -y nginx
sudo cp ~/fueltracks.nginx.conf /etc/nginx/sites-available/fueltracks
sudo ln -sf /etc/nginx/sites-available/fueltracks /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo systemctl restart nginx
