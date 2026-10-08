#!/bin/bash
sudo -u postgres psql -d fueltracks -tAc "\d organization_profiles"
