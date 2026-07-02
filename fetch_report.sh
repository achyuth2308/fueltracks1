#!/bin/bash
curl -s -X GET "https://api.fueltracks.in/api/vehicles/FTTPL_MY_CARWINDSOR/report?startDate=$(date -d 'yesterday' +%Y-%m-%d)&endDate=$(date +%Y-%m-%d)" \
  -H "Authorization: Bearer <PLACEHOLDER>" > raw_report.json
