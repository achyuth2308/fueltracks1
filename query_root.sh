#!/bin/bash
sudo -u postgres psql -d fueltracks -tAc "SELECT id, name, parent_id FROM organizations WHERE id = 'a0000000-0000-0000-0000-000000000001'"
