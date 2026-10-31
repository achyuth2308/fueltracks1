const fs = require('fs');
const path = require('path');

// 1. Patch fuelEventAggregator.js
const feaPath = path.join(__dirname, '../../backend/services/fuelEventAggregator.js');
let fea = fs.readFileSync(feaPath, 'utf8');

if (!fea.includes('activeSessionVehicles')) {
  fea = fea.replace(
    'const THEFT_COOLDOWN_SEC = 600; // 10 minutes',
    'const THEFT_COOLDOWN_SEC = 600; // 10 minutes\n\n// Hot-path in-memory set to eliminate 99.9% of redundant Redis GETs\nconst activeSessionVehicles = new Set();'
  );
  fea = fea.replace(
    'const sessionKey = `refill:session:${vehicleId}`;',
    'const rise = currFuel - prevFuel;\n    // Hot-path bypass: if not in an active session and not starting one, skip Redis entirely\n    if (!activeSessionVehicles.has(vehicleId) && (!isStationary || rise < startDelta)) {\n      return null;\n    }\n    const sessionKey = `refill:session:${vehicleId}`;'
  );
  fea = fea.replace(
    /await redis\.set\(sessionKey, JSON\.stringify\(session\), 'EX', SESSION_TTL_SEC\);/g,
    'await redis.set(sessionKey, JSON.stringify(session), \'EX\', SESSION_TTL_SEC); activeSessionVehicles.add(vehicleId);'
  );
  fea = fea.replace(
    /await redis\.del\(sessionKey\);/g,
    'await redis.del(sessionKey); activeSessionVehicles.delete(vehicleId);'
  );
  fs.writeFileSync(feaPath, fea);
  console.log('Patched fuelEventAggregator.js');
}

// 2. Patch alertSubscriber.js
const asubPath = path.join(__dirname, '../../backend/subscribers/alertSubscriber.js');
let asub = fs.readFileSync(asubPath, 'utf8');
if (asub.includes('const org = await OrgModel.findById(orgId);')) {
  asub = asub.replace(
    'const org = await OrgModel.findById(orgId);',
    `let org = null;
        try {
          const cached = await redis.get(\`org:minimal:\${orgId}\`);
          if (cached) org = JSON.parse(cached);
        } catch (_) {}
        if (!org) {
          const oRes = await db.query('SELECT id, name, type, settings, email, phone FROM organizations WHERE id = $1', [orgId]);
          if (oRes.rows.length > 0) {
            org = oRes.rows[0];
            await redis.set(\`org:minimal:\${orgId}\`, JSON.stringify(org), 'EX', 120).catch(() => {});
          }
        }`
  );
  fs.writeFileSync(asubPath, asub);
  console.log('Patched alertSubscriber.js');
}

// 3. Patch whatsappWorker.js
const wwPath = path.join(__dirname, '../../backend/jobs/whatsappWorker.js');
let ww = fs.readFileSync(wwPath, 'utf8');
if (!ww.includes('lastMaintenanceTime')) {
  ww = ww.replace(
    'let lastConfigErrorTime = 0;',
    'let lastConfigErrorTime = 0;\nlet lastMaintenanceTime = 0;'
  );
  ww = ww.replace(
    '// 1. Mark expired messages and recover zombie messages\n  await markExpiredMessages();\n  await recoverStuckSendingMessages();',
    '// 1. Periodic maintenance once every 60s (avoid running heavy UPDATEs every 2s tick)\n  const nowTs = Date.now();\n  if (nowTs - lastMaintenanceTime > 60000) {\n    lastMaintenanceTime = nowTs;\n    await markExpiredMessages().catch(() => {});\n    await recoverStuckSendingMessages().catch(() => {});\n  }'
  );
  fs.writeFileSync(wwPath, ww);
  console.log('Patched whatsappWorker.js');
}

