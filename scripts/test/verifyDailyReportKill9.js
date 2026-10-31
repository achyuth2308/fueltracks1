const { spawn } = require('child_process');
const path = require('path');
const db = require('../../backend/config/db');

async function testKillAndResume() {
  console.log('[KILL9-TEST] Starting daily report job kill -9 and resume check...');

  // Clear previous test daily reports
  await db.query("DELETE FROM whatsapp_messages WHERE event_type = 'daily_report'");

  // Spawn daily report job in a separate process
  const child = spawn(process.execPath, [
    path.join(__dirname, '../../backend/jobs/dailyReportJob.js'),
    '--date', '2026-10-28',
    '--delay', '10'
  ], {
    env: { ...process.env, DAILY_REPORT_ORG_DELAY_MS: '20' },
    stdio: 'inherit'
  });

  // Wait 1.5s then kill -9
  await new Promise(r => setTimeout(r, 1500));
  console.log(`[KILL9-TEST] Killing daily report PID ${child.pid} with SIGKILL...`);
  try {
    process.kill(child.pid, 'SIGKILL');
  } catch (_) {}

  const midCountRes = await db.query("SELECT COUNT(*) FROM whatsapp_messages WHERE event_type = 'daily_report'");
  console.log(`[KILL9-TEST] Messages created before kill: ${midCountRes.rows[0].count}`);

  // Re-run daily report job to completion
  console.log('[KILL9-TEST] Re-running daily report job to completion...');
  await new Promise((resolve, reject) => {
    const resumeChild = spawn(process.execPath, [
      path.join(__dirname, '../../backend/jobs/dailyReportJob.js'),
      '--date', '2026-10-28',
      '--delay', '5'
    ], {
      env: { ...process.env, DAILY_REPORT_ORG_DELAY_MS: '5' },
      stdio: 'inherit'
    });
    resumeChild.on('exit', code => resolve(code));
    resumeChild.on('error', reject);
  });

  // Query for duplicate messages: exactly ONE SQL count query
  const dupQuery = await db.query(`
    SELECT COUNT(*) as duplicate_groups
    FROM (
      SELECT event_type, event_ref, recipient_id
      FROM whatsapp_messages
      WHERE event_type = 'daily_report'
      GROUP BY event_type, event_ref, recipient_id
      HAVING COUNT(*) > 1
    ) dups;
  `);

  console.log(`[KILL9-TEST] Duplicates found: ${dupQuery.rows[0].duplicate_groups}`);
  await db.pool.end();
  process.exit(0);
}

testKillAndResume().catch(err => {
  console.error('[KILL9-TEST] FATAL:', err);
  process.exit(1);
});

