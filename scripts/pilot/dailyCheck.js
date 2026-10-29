// ============================================================
// PILOT HEALTH CHECK SCRIPT (READ-ONLY)
// Evaluates last 24h metrics against pilot rollback criteria
// Usage: node scripts/pilot/dailyCheck.js
// ============================================================

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const db = require('../../backend/config/db');
const axios = require('axios');

async function run() {
  console.log('\n========================================================================');
  console.log('FUELTRACKS WHATSAPP PILOT: 24-HOUR HEALTH CHECK & ROLLBACK EVALUATOR');
  console.log('========================================================================\n');

  let pilotStatus = 'OK';
  const rollbackReasons = [];
  const warnReasons = [];

  try {
    // 1. Message counts by event_type and status
    const statusCountsRes = await db.query(`
      SELECT event_type, status, COUNT(*)::int as count
      FROM whatsapp_messages
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY event_type, status
      ORDER BY event_type, status
    `);

    console.log('--- 1. Message Counts by Event Type & Status (Last 24h) ---');
    if (statusCountsRes.rows.length === 0) {
      console.log('No WhatsApp messages recorded in the last 24 hours.');
    } else {
      console.table(statusCountsRes.rows);
    }

    // 2. Failure rate and top error codes
    const failRes = await db.query(`
      SELECT 
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status IN ('failed', 'dead'))::int as failures,
        COUNT(*) FILTER (WHERE status = 'dead')::int as dead,
        COUNT(*) FILTER (WHERE status = 'expired')::int as expired
      FROM whatsapp_messages
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `);

    const total = failRes.rows[0].total || 0;
    const failures = failRes.rows[0].failures || 0;
    const deadCount = failRes.rows[0].dead || 0;
    const expiredCount = failRes.rows[0].expired || 0;
    const failPct = total > 0 ? (failures / total) * 100 : 0;

    console.log(`\n--- 2. Reliability & Error Metrics (Last 24h) ---`);
    console.log(`Total Messages: ${total} | Failures: ${failures} (${failPct.toFixed(2)}%) | Dead: ${deadCount} | Expired: ${expiredCount}`);

    if (deadCount > 0) {
      rollbackReasons.push(`Dead messages detected: ${deadCount}`);
    }
    if (failPct > 5.0) {
      rollbackReasons.push(`Failure rate ${failPct.toFixed(2)}% exceeds 5% limit`);
    } else if (failPct > 2.0) {
      warnReasons.push(`Elevated failure rate: ${failPct.toFixed(2)}%`);
    }

    const topErrors = await db.query(`
      SELECT error_code, COUNT(*)::int as count, MIN(SUBSTRING(error_message FROM 1 FOR 60)) as sample_error
      FROM whatsapp_messages
      WHERE created_at >= NOW() - INTERVAL '24 hours' AND error_code IS NOT NULL
      GROUP BY error_code ORDER BY count DESC LIMIT 5
    `);
    if (topErrors.rows.length > 0) {
      console.log('Top Error Codes:');
      console.table(topErrors.rows);
    }

    // 3. Oldest queued message age
    const queuedRes = await db.query(`
      SELECT id, event_type, ROUND(EXTRACT(EPOCH FROM (NOW() - created_at)) / 60, 1)::float as age_minutes, created_at
      FROM whatsapp_messages
      WHERE status = 'queued'
      ORDER BY created_at ASC LIMIT 1
    `);

    console.log(`\n--- 3. Queue Latency ---`);
    if (queuedRes.rows.length === 0) {
      console.log('Queue is completely drained (0 queued messages).');
    } else {
      const q = queuedRes.rows[0];
      console.log(`Oldest queued message: #${q.id} (${q.event_type}), Age: ${q.age_minutes} minutes`);
      if (q.age_minutes > 5.0 && (q.event_type === 'fuel_theft' || q.event_type === 'fuel_refill')) {
        rollbackReasons.push(`Oldest queued alert #${q.id} is ${q.age_minutes} min old (> 5 min threshold)`);
      } else if (q.age_minutes > 3.0) {
        warnReasons.push(`Queued message #${q.id} age elevated (${q.age_minutes} min)`);
      }
    }

    // 4. Duplicate delivery detection
    const dupRes = await db.query(`
      SELECT event_type, event_ref, recipient_id, COUNT(*)::int as sent_count
      FROM whatsapp_messages
      WHERE status IN ('sent', 'delivered', 'read')
        AND created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY event_type, event_ref, recipient_id
      HAVING COUNT(*) > 1
    `);

    console.log(`\n--- 4. Duplicate Delivery Audit ---`);
    if (dupRes.rows.length === 0) {
      console.log('Zero duplicate deliveries found (PASS ✅)');
    } else {
      console.error(`DUPLICATES DETECTED: ${dupRes.rows.length} duplicate groups!`);
      console.table(dupRes.rows);
      rollbackReasons.push(`Duplicate message deliveries detected (${dupRes.rows.length} groups)`);
    }

    // 5. Per-org usage vs cap
    const capRes = await db.query(`
      SELECT 
        o.name as org_name,
        COALESCE(s.max_daily_messages, 1000)::int as daily_cap,
        COUNT(m.id)::int as sent_today
      FROM organizations o
      LEFT JOIN whatsapp_org_settings s ON s.org_id = o.id
      LEFT JOIN whatsapp_messages m ON m.org_id = o.id 
        AND m.status IN ('sent', 'delivered', 'read')
        AND (m.created_at AT TIME ZONE 'Asia/Kolkata')::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
      GROUP BY o.id, o.name, s.max_daily_messages
      HAVING COUNT(m.id) > 0
      ORDER BY sent_today DESC LIMIT 10
    `);

    console.log(`\n--- 5. Organization Daily Usage (IST) ---`);
    if (capRes.rows.length > 0) {
      console.table(capRes.rows);
    } else {
      console.log('No messages sent today.');
    }

    // 6. Opted-out recipients (Privacy safe)
    const optOutRes = await db.query(`
      SELECT id, org_id, CONCAT('******', RIGHT(phone_e164, 4)) as phone_masked, updated_at as opt_out_date
      FROM whatsapp_recipients
      WHERE opt_in = false
      ORDER BY updated_at DESC LIMIT 5
    `);
    console.log(`\n--- 6. Opted-Out Recipients ---`);
    if (optOutRes.rows.length > 0) {
      console.table(optOutRes.rows);
    } else {
      console.log('0 opted-out recipients.');
    }

    // 7. API /api/whatsapp/queue-status probe
    const apiUrl = process.env.API_URL || process.env.FUELTRACKS_API_URL;
    if (apiUrl) {
      console.log(`\n--- 7. Worker Health Probe (${apiUrl}/api/whatsapp/queue-status) ---`);
      try {
        const resp = await axios.get(`${apiUrl}/api/whatsapp/queue-status`, { timeout: 3000 });
        console.log('Queue Status Response:', resp.data);
      } catch (httpErr) {
        console.warn(`Health probe warning: ${httpErr.message}`);
        warnReasons.push(`Queue-status probe failed: ${httpErr.message}`);
      }
    }

    // 8. Overall Pilot Status Evaluation
    if (rollbackReasons.length > 0) {
      pilotStatus = 'ROLLBACK';
    } else if (warnReasons.length > 0) {
      pilotStatus = 'WARN';
    }

    console.log('\n========================================================================');
    if (pilotStatus === 'ROLLBACK') {
      console.log(`PILOT STATUS: ROLLBACK ❌`);
      console.log(`Rollback Triggers Hit:\n  - ${rollbackReasons.join('\n  - ')}`);
    } else if (pilotStatus === 'WARN') {
      console.log(`PILOT STATUS: WARN ⚠️`);
      console.log(`Warnings:\n  - ${warnReasons.join('\n  - ')}`);
    } else {
      console.log(`PILOT STATUS: OK ✅`);
    }
    console.log('========================================================================\n');

  } catch (err) {
    console.error('[DAILY-CHECK-ERROR]', err);
    pilotStatus = 'ROLLBACK';
    console.log('\nPILOT STATUS: ROLLBACK ❌');
  } finally {
    await db.pool.end();
    process.exit(pilotStatus === 'ROLLBACK' ? 1 : 0);
  }
}

run();
