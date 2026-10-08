#!/bin/bash
sudo -u postgres psql -d fueltracks -tAc "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'gps_points';"
