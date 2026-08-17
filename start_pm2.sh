cd ~/fueltracks1
pm2 start backend/server.js --name "api"
pm2 start tcp-server/server.js --name "tcp"
pm2 save
pm2 startup | tail -n 1 > pm2_startup.sh
chmod +x pm2_startup.sh
./pm2_startup.sh
