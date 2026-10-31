// ============================================================
// DAILY FLEET REPORT JOB
// Computes consolidated fleet activity for yesterday (IST boundaries)
// and enqueues WhatsApp summary template for opted-in recipients.
//
// Scheduled via PM2 cron every 15 minutes (or callable directly).
// Idempotent via whatsapp_messages UNIQUE(event_type, event_ref, recipient_id).
// ============================================================

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const db = require('../config/db');
const reportRepository = require('../modules/reports/repositories/reportRepository');
const { maskPhone } = require('../utils/phone');

/**
 * Computes yesterday's IST start/end timestamps in UTC and formatted labels
 */
function getYesterdayIstWindow() {
  const now = new Date();
  // Current time in IST
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffsetMs);

  // Yesterday in IST
  const istYesterday = new Date(istNow);
  istYesterday.setUTCDate(istYesterday.getUTCDate() - 1);

  const yYear = istYesterday.getUTCFullYear();
  const yMonth = istYesterday.getUTCMonth();
  const yDate = istYesterday.getUTCDate();

  // Start of yesterday in IST (00:00:00.000 IST) -> UTC
  const startIst = new Date(Date.UTC(yYear, yMonth, yDate, 0, 0, 0, 0) - istOffsetMs);
  // End of yesterday in IST (23:59:59.999 IST) -> UTC
  const endIst = new Date(Date.UTC(yYear, yMonth, yDate, 23, 59, 59, 999) - istOffsetMs);

  const pad = (n) => String(n).padStart(2, '0');
  const dateKey = `${yYear}-${pad(yMonth + 1)}-${pad(yDate)}`;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const displayDate = `${pad(yDate)} ${months[yMonth]} ${yYear}`;

  const currentIstHours = pad(istNow.getUTCHours());
  const currentIstMinutes = pad(istNow.getUTCMinutes());
  const currentIstTime = `${currentIstHours}:${currentIstMinutes}`;

  return {
    startUtc: startIst.toISOString(),
    endUtc: endIst.toISOString(),
    dateKey,
    displayDate,
    currentIstTime
  };
}

/**
 * Format duration seconds into descriptive 'Xh Ym'
 */
function formatHoursMinutes(totalSeconds) {
  const sec = Math.max(0, parseInt(totalSeconds, 10) || 0);
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  if (hours === 0 && minutes === 0) return '0m';
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

/**
 * Main report runner
 */
async function runDailyReport() {
  const { startUtc, endUtc, dateKey, displayDate, currentIstTime } = getYesterdayIstWindow();
  console.log(`[DAILY-REPORT-JOB] Checking daily fleet reports for ${dateKey} (${displayDate}). Current IST: ${currentIstTime}`);

  try {
    // 1. Query customer-type organizations with daily report enabled and opted-in recipients
    const orgsQuery = `
      SELECT o.id, o.name,
             COALESCE(s.daily_report_enabled, true) as report_enabled,
             COALESCE(s.daily_report_time, '07:00') as report_time
      FROM organizations o
      LEFT JOIN whatsapp_org_settings s ON o.id = s.org_id
      WHERE o.is_active = true
        AND o.type = 'customer'
        AND COALESCE(s.daily_report_enabled, true) = true
        AND EXISTS (
          SELECT 1 FROM whatsapp_recipients r
          WHERE r.org_id = o.id AND r.opt_in = true AND r.receive_daily_report = true
        )
      ORDER BY o.name ASC
    `;
    const { rows: candidateOrgs } = await db.query(orgsQuery);

    console.log(`[DAILY-REPORT-JOB] Found ${candidateOrgs.length} customer orgs with active recipients.`);

    for (const org of candidateOrgs) {
      // Check configured time (e.g. '07:00' <= current IST time)
      const configuredTime = org.report_time || '07:00';
      if (currentIstTime < configuredTime) {
        // Report time for today has not arrived yet
        continue;
      }

      // 2. Idempotency check: has this org already generated a report for this dateKey?
      const existingMsg = await db.query(
        `SELECT id FROM whatsapp_messages
         WHERE org_id = $1 AND event_type = 'daily_report' AND event_ref = $2
         LIMIT 1`,
        [org.id, dateKey]
      );
      if (existingMsg.rows.length > 0) {
        // Already processed for yesterday
        continue;
      }

      console.log(`[DAILY-REPORT-JOB] Processing report for "${org.name}" (${org.id})...`);

      // 3. Compute org fleet activity
      const activity = await reportRepository.getConsolidatedActivity(
        org.id,
        'superadmin', // use unconstrained query scope for org
        null,
        startUtc,
        endUtc
      );

      const vehicleCount = activity.length;
      let totalDistance = 0;
      let totalIdleSeconds = 0;
      let totalRefillLiters = 0;
      let totalTheftLiters = 0;

      for (const row of activity) {
        totalDistance += parseFloat(row.distance_travelled) || 0;
        totalIdleSeconds += parseInt(row.idle_seconds, 10) || 0;
        totalRefillLiters += parseFloat(row.total_refill) || 0;
        totalTheftLiters += parseFloat(row.total_theft) || 0;
      }

      // Query refill counts & theft counts from alerts table
      const alertsStatsQuery = `
        SELECT
          COUNT(id) FILTER (WHERE alert_type IN ('fuel_refill', 'fuel_refill_final'))::int as refill_count,
          COUNT(id) FILTER (WHERE alert_type = 'fuel_theft')::int as theft_count
        FROM alerts
        WHERE vehicle_id IN (SELECT id FROM vehicles WHERE org_id = $1)
          AND device_time BETWEEN $2 AND $3
      `;
      const { rows: alertStats } = await db.query(alertsStatsQuery, [org.id, startUtc, endUtc]);
      const refillCount = alertStats[0]?.refill_count || (totalRefillLiters > 0 ? 1 : 0);
      const theftCount = alertStats[0]?.theft_count || (totalTheftLiters > 0 ? 1 : 0);

      // Estimated fuel consumed: drops from fuel sensors or distance approximation
      const estimatedFuelConsumed = Math.round(
        activity.reduce((acc, row) => {
          const startF = parseFloat(row.start_fuel);
          const endF = parseFloat(row.end_fuel);
          const refill = parseFloat(row.total_refill) || 0;
          if (!isNaN(startF) && !isNaN(endF)) {
            const consumed = Math.max(0, startF + refill - endF);
            return acc + consumed;
          }
          return acc;
        }, 0) * 10
      ) / 10;

      // Skip orgs with zero data
      const hasAnyActivity = vehicleCount > 0 && (totalDistance > 0 || totalRefillLiters > 0 || theftCount > 0);
      if (!hasAnyActivity) {
        console.log(`[DAILY-REPORT-JOB] Skipping "${org.name}": zero activity recorded yesterday.`);
        continue;
      }

      // 4. Fetch opted-in recipients
      const recipientsQuery = `
        SELECT id, name, phone_e164
        FROM whatsapp_recipients
        WHERE org_id = $1
          AND opt_in = true
          AND receive_daily_report = true
      `;
      const { rows: recipients } = await db.query(recipientsQuery, [org.id]);

      if (recipients.length === 0) continue;

      const bodyParams = [
        org.name,                                     // {{1}}: Org Name
        displayDate,                                  // {{2}}: Date
        String(vehicleCount),                         // {{3}}: Vehicles
        String(Math.round(totalDistance * 10) / 10),  // {{4}}: Distance in km
        String(estimatedFuelConsumed),                // {{5}}: Fuel used in L
        String(refillCount),                          // {{6}}: Refills count
        String(Math.round(totalRefillLiters * 10) / 10), // {{7}}: Refill litres
        String(theftCount),                           // {{8}}: Theft alerts count
        formatHoursMinutes(totalIdleSeconds)          // {{9}}: Idle time
      ];

      for (const r of recipients) {
        const masked = maskPhone(r.phone_e164);
        const payload = {
          bodyParams,
          orgName: org.name,
          dateKey
        };

        await db.query(
          `INSERT INTO whatsapp_messages (
             org_id, recipient_id, phone_masked, event_type, event_ref,
             template_name, language, payload, status, expires_at
           ) VALUES ($1, $2, $3, 'daily_report', $4, 'daily_fleet_report', 'en', $5, 'queued', NOW() + INTERVAL '12 hours')
           ON CONFLICT (event_type, event_ref, recipient_id) DO NOTHING`,
          [org.id, r.id, masked, dateKey, JSON.stringify(payload)]
        );
      }

      console.log(`[DAILY-REPORT-JOB] Queued daily report for "${org.name}" to ${recipients.length} recipients.`);

      // Brief sleep between orgs to avoid CPU/DB spikes on t3.medium
      const delayMs = process.env.DAILY_REPORT_ORG_DELAY_MS !== undefined ? parseInt(process.env.DAILY_REPORT_ORG_DELAY_MS, 10) : 200;
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    console.log('[DAILY-REPORT-JOB] Run completed successfully.');
  } catch (err) {
    console.error('[DAILY-REPORT-JOB] Unexpected failure:', err.message);
  }
}

// Standalone execution support
if (require.main === module) {
  runDailyReport().then(() => {
    process.exit(0);
  }).catch((err) => {
    console.error('[DAILY-REPORT-JOB] Fatal error:', err);
    process.exit(1);
  });
}

module.exports = {
  runDailyReport,
  getYesterdayIstWindow,
  formatHoursMinutes
};

