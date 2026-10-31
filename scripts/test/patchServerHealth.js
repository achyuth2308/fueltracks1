const fs = require('fs');

const path = 'backend/server.js';
let s = fs.readFileSync(path, 'utf8');

const target = `    // Check Redis status
    await redisConfig.redis.ping();

    res.status(200).json({
      success: true,
      status: 'OK',
      services: {
        database: 'connected',
        redis: 'connected',
      },
    });`;

const replacement = `    // Check Redis status
    await redisConfig.redis.ping();

    let whatsappHealth = { enabled: env.WHATSAPP_ENABLED };
    try {
      const { getQueueStatus } = require('./jobs/whatsappWorker');
      whatsappHealth = await getQueueStatus();
    } catch (_) {}

    res.status(200).json({
      success: true,
      status: 'OK',
      services: {
        database: 'connected',
        redis: 'connected',
        whatsapp: whatsappHealth
      },
    });`;

if (s.includes(target.replace(/\n/g, '\r\n'))) {
  s = s.replace(target.replace(/\n/g, '\r\n'), replacement.replace(/\n/g, '\r\n'));
  fs.writeFileSync(path, s);
  console.log('SUCCESS: Patched server.js with CRLF');
} else if (s.includes(target)) {
  s = s.replace(target, replacement);
  fs.writeFileSync(path, s);
  console.log('SUCCESS: Patched server.js with LF');
} else {
  console.error('Target not found in server.js');
}

