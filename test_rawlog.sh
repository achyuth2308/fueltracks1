#!/bin/bash
# Test: manually publish a raw_log message and check if it gets saved to DB
TEST_MSG='{"imei":"861329080867568","packetType":"TEST_MANUAL","rawHex":"TEST123","rawString":"TEST123","deviceTime":"2026-08-06T07:27:00.000Z","odometer":0,"parsedJson":{"packetType":"TEST_MANUAL","imei":"861329080867568"},"parsed":true,"error":null}'
redis-cli PUBLISH raw_logs "$TEST_MSG"
sleep 2
sudo -u postgres psql -d fueltracks -c "SELECT COUNT(*), MAX(received_at) FROM raw_packets WHERE imei = '861329080867568';"
