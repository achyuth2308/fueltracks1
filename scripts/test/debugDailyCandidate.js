const db = require('../../backend/config/db');

async function check() {
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
      LIMIT 10
  `;
  const res = await db.query(orgsQuery);
  console.log('Candidate orgs count:', res.rows.length);
  console.log('Candidate orgs sample:', res.rows.slice(0, 3));

  // Let's check current IST time in dailyReportJob.js
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffsetMs);
  const pad = (n) => String(n).padStart(2, '0');
  const currentIstTime = `${pad(istNow.getUTCHours())}:${pad(istNow.getUTCMinutes())}`;
  console.log('Current IST time:', currentIstTime);

  await db.pool.end();
}

check().catch(console.error);

