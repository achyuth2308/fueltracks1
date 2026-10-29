# FuelTracks WhatsApp 3-Day Production Pilot Runbook

Concise, copy-paste operational runbook for executing the 3-day pilot on production.

---

## 1. Pre-Deploy Read-Only Verification (Run on Server)

```bash
# 1. Environment & process baseline
node -v
pm2 list
pm2 monit
# Note current fueltracks-api RSS baseline: ____________ MB

# 2. Database schema verification
psql -h 127.0.0.1 -U postgres -d fueltracks -c "\d alerts"
psql -h 127.0.0.1 -U postgres -d fueltracks -c "\d vehicles"
psql -h 127.0.0.1 -U postgres -d fueltracks -c "\d organizations"
psql -h 127.0.0.1 -U postgres -d fueltracks -c "\d vehicle_latest_state"

# 3. Detect any missing columns before migration
psql -h 127.0.0.1 -U postgres -d fueltracks -c "
SELECT table_name, column_name 
FROM (VALUES 
  ('alerts', 'is_read'),
  ('organizations', 'settings'),
  ('vehicle_latest_state', 'today_distance'),
  ('vehicle_latest_state', 'today_distance_date'),
  ('vehicle_latest_state', 'today_start_odometer'),
  ('vehicle_latest_state', 'battery')
) AS req(table_name, column_name)
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.columns c
  WHERE c.table_name = req.table_name AND c.column_name = req.column_name
);
"
```

---

## 2. Deploy Sequence

```bash
# Step 1: Fetch and switch to branch
git fetch origin
git checkout feature/whatsapp-integration
git pull origin feature/whatsapp-integration

# Step 2: Install dependencies
npm --prefix frontend install --production=false
npm --prefix frontend run build
npm install --production

# Step 3: Run base DDL migrations (idempotent, fast lock)
npm run db:migrate

# Step 4: Run CONCURRENT index migration in off-peak / quiet hour
# NOTE: In TimescaleDB, gps_points & alerts hypertables do not support CREATE INDEX CONCURRENTLY
# across chunks. Use database/manual_concurrent_indexes.sql which applies standard indexes to chunks.
psql -h 127.0.0.1 -U postgres -d fueltracks -f database/manual_concurrent_indexes.sql

# Step 5: Reload API with WHATSAPP_ENABLED=false
# In .env: ensure WHATSAPP_ENABLED=false
pm2 reload fueltracks-api --update-env

# Step 6: Monitor telemetry & RSS for 24h before enabling Meta dispatch
```

---

## 3. Meta Portal Checklist

```bash
# 1. Check pre-approved template status in Meta WABA
node scripts/whatsappSubmitTemplates.js --status
# Confirm fuel_refill_alert, fuel_theft_alert, daily_fleet_report show: APPROVED

# 2. Webhook verification in Meta Developer Portal
# URL: https://api.fueltracks.in/api/webhooks/whatsapp
# Subscribed fields: "messages"
# Verify Token matches WHATSAPP_VERIFY_TOKEN in .env

# 3. Phone number: Verified & Active in WhatsApp Manager
# 4. Token: Permanent System User Token configured in .env (WHATSAPP_ACCESS_TOKEN)
# 5. Test recipient numbers whitelisted if in Meta Sandbox mode
```

---

## 4. Enable Sequence (Pilot Day 1)

```bash
# 1. In FuelTracks Web UI:
# Navigate to Organization Settings > WhatsApp > Add 2-3 internal staff recipients (Opt-In = true).

# 2. Update .env on production server:
# WHATSAPP_ENABLED=true
# WHATSAPP_API_BASE_URL=https://graph.facebook.com

# 3. Reload API process
pm2 reload fueltracks-api --update-env

# 4. End-to-end verification tests:
# - Trigger 1 refill event, 1 theft event, and run daily report test:
node scripts/pilot/dailyCheck.js --trigger-test

# - Verify message status transitions in database:
psql -h 127.0.0.1 -U postgres -d fueltracks -c "
SELECT id, event_type, status, wamid, attempts, created_at 
FROM whatsapp_messages 
ORDER BY id DESC LIMIT 5;
"
# (Expect transition: queued -> sent -> delivered -> read)

# - Inbound Keyword Test:
# Send "STOP" from a recipient phone -> Confirm opt_in flips to false.
# Send "START" from recipient phone -> Confirm opt_in flips back to true.
```

---

## 5. Rollback Procedure & Triggers

### Rollback Commands:
```bash
# 1. Disable WhatsApp immediately
sed -i 's/WHATSAPP_ENABLED=true/WHATSAPP_ENABLED=false/' .env
pm2 reload fueltracks-api --update-env

# 2. Inspect queued messages backlog
psql -h 127.0.0.1 -U postgres -d fueltracks -c "
SELECT event_type, status, COUNT(*) 
FROM whatsapp_messages 
WHERE status = 'queued' 
GROUP BY event_type, status;
"
# NOTE: While disabled, outbox pauses safely. When re-enabled later, any messages older
# than their expires_at (2h for alerts, 12h for reports) are marked 'expired' and discarded.
```

### Hard Rollback Triggers (Abort Pilot immediately if any occurs):
1. **API Memory Leak / Crash**: RSS climbs continuously across 3 days without plateauing, or PM2 restarts `fueltracks-api`.
2. **Duplicate Messages**: Any occurrence of identical `(event_type, event_ref, recipient_id)` delivered more than once.
3. **High Failure Rate**: Message failure rate exceeds 5% over 24 hours, or any message marked `status = 'dead'`.
4. **Queue Latency**: Oldest `queued` message for `fuel_theft` or `fuel_refill` is older than 5 minutes.
5. **Telemetry Degradation**: GPS packet ingestion lag or event-loop delay visibly increases above baseline.

---

## 6. Monitoring & RSS Trend Tracking

```bash
# Set PM2 memory restart ceiling at 1.5x of the measured baseline (e.g. baseline 160MB -> alert 240MB, max 600MB):
# In ecosystem.config.js: max_memory_restart: '600M'

# Track 5-minute RSS trend to /var/log/fueltracks_rss.log:
crontab -e
# Add:
*/5 * * * * ps -C node -o pid,rss,cmd | grep 'fueltracks-api' | awk '{print strftime("%Y-%m-%d %H:%M:%S"), $1, $2/1024 " MB"}' >> /var/log/fueltracks_rss.log
```

