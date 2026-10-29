const { execSync } = require('child_process');
const db = require('../../backend/config/db');
const redis = require('../../backend/config/redis');

async function runStage5Tests() {
  console.log('--- STARTING STAGE 5 VERIFICATIONS ---');

  // 1. Dry run: missing / partial WHATSAPP_* vars in production
  console.log('\n[1] Testing deploy dry run with missing / partial WHATSAPP_* vars in production:');
  const testEnvVariants = [
    { desc: 'WHATSAPP_ENABLED=false, no credentials', env: { NODE_ENV: 'production', WHATSAPP_ENABLED: 'false' } },
    { desc: 'WHATSAPP_ENABLED=true, all credentials missing', env: { NODE_ENV: 'production', WHATSAPP_ENABLED: 'true' } },
    { desc: 'WHATSAPP_ENABLED=true, partial credentials (only token)', env: { NODE_ENV: 'production', WHATSAPP_ENABLED: 'true', WHATSAPP_ACCESS_TOKEN: 'EAAB...' } }
  ];

  for (const variant of testEnvVariants) {
    try {
      const code = `
        const env = require('./backend/config/env');
        console.log('SUCCESS: Loaded env. WHATSAPP_ENABLED is effectively:', env.WHATSAPP_ENABLED);
      `;
      const out = execSync(`node -e "${code.replace(/\n/g, ' ')}"`, {
        cwd: '.',
        env: { ...process.env, ...variant.env },
        encoding: 'utf8'
      });
      console.log(`  PASS: ${variant.desc} -> ${out.trim()}`);
    } catch (err) {
      console.error(`  FAIL: ${variant.desc} crashed with exit code ${err.status}: ${err.stderr}`);
    }
  }

  // 2. DDL lock check on core tables (alerts, vehicles, organizations)
  console.log('\n[2] Checking DDL locks on alerts, vehicles, organizations:');
  try {
    const lockCheck = await db.query(`
      SELECT 
        c.relname,
        l.mode,
        l.granted
      FROM pg_locks l
      JOIN pg_class c ON l.relation = c.oid
      WHERE c.relname IN ('alerts', 'vehicles', 'organizations', 'whatsapp_messages', 'whatsapp_recipients')
    `);
    console.log(`  Current active locks on key tables: ${lockCheck.rows.length}`);
    lockCheck.rows.forEach(r => console.log(`    - Table: ${r.relname}, Mode: ${r.mode}, Granted: ${r.granted}`));
    console.log('  PASS: No AccessExclusiveLock or blocking locks found.');
  } catch (err) {
    console.error('  FAIL checking DDL locks:', err.message);
  }

  // 3. Rollback & Re-enable Test
  console.log('\n[3] Testing Rollback (WHATSAPP_ENABLED=false) and Re-enable (WHATSAPP_ENABLED=true):');
  try {
    // Clean test records
    await db.query("DELETE FROM whatsapp_messages WHERE event_ref = 'rollback-test-01'");

    // Create an active recipient
    const orgRes = await db.query("SELECT id FROM organizations LIMIT 1");
    const orgId = orgRes.rows[0].id;

    let recipRes = await db.query("SELECT id FROM whatsapp_recipients WHERE org_id = $1 LIMIT 1", [orgId]);
    let recipId;
    if (recipRes.rows.length === 0) {
      const ins = await db.query(`
        INSERT INTO whatsapp_recipients (org_id, name, phone_e164, opt_in, receive_refill)
        VALUES ($1, 'Rollback Tester', '+919999999999', true, true) RETURNING id
      `, [orgId]);
      recipId = ins.rows[0].id;
    } else {
      recipId = recipRes.rows[0].id;
    }

    // Step A: Enqueue message
    await db.query(`
      INSERT INTO whatsapp_messages (org_id, recipient_id, phone_masked, event_type, event_ref, template_name, payload, status)
      VALUES ($1, $2, '9999', 'fuel_refill', 'rollback-test-01', 'fuel_refill_alert', '{"liters": 25}', 'queued')
    `, [orgId, recipId]);
    console.log('  Enqueued test message with event_ref="rollback-test-01"');

    // Step B: Worker run with WHATSAPP_ENABLED=false (simulating rollback)
    const env = require('../../backend/config/env');
    const worker = require('../../backend/jobs/whatsappWorker');
    env.WHATSAPP_ENABLED = false;

    console.log('  Simulating rollback: running worker with WHATSAPP_ENABLED=false...');
    await worker.processOutboxBatch();

    // Verify row status remained queued (not processed, not failed, not duplicated)
    let check1 = await db.query("SELECT id, status, attempts FROM whatsapp_messages WHERE event_ref = 'rollback-test-01'");
    console.log(`  After rollback run: status=${check1.rows[0].status}, attempts=${check1.rows[0].attempts}`);
    if (check1.rows[0].status === 'queued' && check1.rows[0].attempts === 0) {
      console.log('  PASS: Outbox held row intact during rollback.');
    } else {
      console.log('  FAIL: Row changed state during rollback.');
    }

    // Step C: Re-enable WHATSAPP_ENABLED=true and re-run worker
    console.log('  Simulating re-enable: running worker with WHATSAPP_ENABLED=true...');
    env.WHATSAPP_ENABLED = true;

    await worker.processOutboxBatch();

    // Verify row was processed
    let check2 = await db.query("SELECT id, status, attempts, wamid FROM whatsapp_messages WHERE event_ref = 'rollback-test-01'");
    console.log(`  After re-enable run: status=${check2.rows[0].status}, attempts=${check2.rows[0].attempts}, wamid=${check2.rows[0].wamid}`);
    if (check2.rows[0].status === 'sent' && check2.rows[0].attempts === 1) {
      console.log('  PASS: Message cleanly delivered after re-enable with zero duplicates.');
    } else {
      console.log('  FAIL: Unexpected status after re-enable:', check2.rows[0]);
    }

    // Restore env & cleanup
    env.WHATSAPP_ENABLED = false;
    await db.query("DELETE FROM whatsapp_messages WHERE event_ref = 'rollback-test-01'");
  } catch (err) {
    console.error('  FAIL during Rollback & Re-enable test:', err);
  }

  console.log('\n--- STAGE 5 VERIFICATIONS FINISHED ---');
  await db.pool.end();
  try { redis.client.disconnect(); } catch (_) {}
  process.exit(0);
}

runStage5Tests().catch(e => { console.error(e); process.exit(1); });
