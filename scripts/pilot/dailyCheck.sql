-- ============================================================
-- WhatsApp Production Pilot 24-Hour Read-Only Health Check
-- Run with: psql -h 127.0.0.1 -U postgres -d fueltracks -f scripts/pilot/dailyCheck.sql
-- ============================================================

\echo '=== 1. 24-HOUR MESSAGE COUNTS BY EVENT TYPE & STATUS ==='
SELECT 
  event_type,
  status,
  COUNT(*) as message_count
FROM whatsapp_messages
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY event_type, status
ORDER BY event_type, status;

\echo '=== 2. FAILURE METRICS & TOP ERROR CODES (LAST 24H) ==='
SELECT 
  COUNT(*) FILTER (WHERE status IN ('failed', 'dead')) as total_failures,
  COUNT(*) as total_messages,
  ROUND((COUNT(*) FILTER (WHERE status IN ('failed', 'dead'))::numeric / NULLIF(COUNT(*), 0) * 100), 2) as failure_rate_pct
FROM whatsapp_messages
WHERE created_at >= NOW() - INTERVAL '24 hours';

SELECT 
  error_code,
  COUNT(*) as count,
  MIN(SUBSTRING(error_message FROM 1 FOR 60)) as sample_error
FROM whatsapp_messages
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND error_code IS NOT NULL
GROUP BY error_code
ORDER BY count DESC
LIMIT 5;

\echo '=== 3. DEAD & EXPIRED MESSAGES (LAST 24H) ==='
SELECT 
  COUNT(*) FILTER (WHERE status = 'dead') as dead_count,
  COUNT(*) FILTER (WHERE status = 'expired') as expired_count
FROM whatsapp_messages
WHERE created_at >= NOW() - INTERVAL '24 hours';

\echo '=== 4. OLDEST QUEUED MESSAGE AGE ==='
SELECT 
  id,
  event_type,
  ROUND(EXTRACT(EPOCH FROM (NOW() - created_at)) / 60, 1) as age_minutes,
  created_at
FROM whatsapp_messages
WHERE status = 'queued'
ORDER BY created_at ASC
LIMIT 1;

\echo '=== 5. DUPLICATE DELIVERY DETECTION (MUST BE 0) ==='
SELECT 
  event_type,
  event_ref,
  recipient_id,
  COUNT(*) as sent_count
FROM whatsapp_messages
WHERE status IN ('sent', 'delivered', 'read')
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY event_type, event_ref, recipient_id
HAVING COUNT(*) > 1;

\echo '=== 6. PER-ORGANIZATION DAILY USAGE VS CAP ==='
SELECT 
  o.name as org_name,
  COALESCE(s.max_daily_messages, 1000) as daily_cap,
  COUNT(m.id) as sent_today,
  ROUND((COUNT(m.id)::numeric / COALESCE(s.max_daily_messages, 1000) * 100), 1) as cap_usage_pct
FROM organizations o
LEFT JOIN whatsapp_org_settings s ON s.org_id = o.id
LEFT JOIN whatsapp_messages m ON m.org_id = o.id 
  AND m.status IN ('sent', 'delivered', 'read')
  AND (m.created_at AT TIME ZONE 'Asia/Kolkata')::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
GROUP BY o.id, o.name, s.max_daily_messages
HAVING COUNT(m.id) > 0
ORDER BY sent_today DESC;

\echo '=== 7. OPTED-OUT RECIPIENTS ==='
SELECT 
  id,
  org_id,
  CONCAT('******', RIGHT(phone_e164, 4)) as phone_masked,
  updated_at as opt_out_date
FROM whatsapp_recipients
WHERE opt_in = false
ORDER BY updated_at DESC
LIMIT 10;
