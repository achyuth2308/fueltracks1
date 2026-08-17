sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'fuel';"
sudo -u postgres createdb fueltracks || true
