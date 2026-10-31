
// ============================================================
// MOCK META GRAPH API SERVER FOR QA & INTEGRATION TESTING
// Plain Node.js http module with configurable latency and error injection.
// ============================================================

'use strict';

const http = require('http');

let config = {
  latencyMs: 0,
  errorCode: null,       // e.g. 500, 130429, 190, 131047, 131030, 132001
  httpStatus: 200,
  malformed: false,
  empty: false
};

const receivedMessages = [];
let requestCounter = 0;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Control endpoints
  if (pathname === '/mock/control' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const update = JSON.parse(body);
        Object.assign(config, update);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, config }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/mock/control' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ config, requestCount: requestCounter, receivedCount: receivedMessages.length }));
    return;
  }

  if (pathname === '/mock/received' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, messages: receivedMessages }));
    return;
  }

  if (pathname === '/mock/clear' && req.method === 'POST') {
    receivedMessages.length = 0;
    requestCounter = 0;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, cleared: true }));
    return;
  }

  // Meta Graph API endpoint: POST /v{version}/{phoneNumberId}/messages
  if (req.method === 'POST' && pathname.includes('/messages')) {
    requestCounter++;
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let parsedBody = null;
      try {
        parsedBody = JSON.parse(body);
      } catch (_) { }

      const recordedReq = {
        id: requestCounter,
        headers: req.headers,
        path: pathname,
        body: parsedBody,
        rawBody: body,
        receivedAt: new Date().toISOString()
      };
      receivedMessages.push(recordedReq);

      const respond = () => {
        if (config.empty) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('');
          return;
        }

        if (config.malformed) {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('<html><head><title>502 Bad Gateway</title></head><body>Bad Gateway</body></html>');
          return;
        }

        if (config.errorCode || config.httpStatus !== 200) {
          const status = config.httpStatus !== 200 ? config.httpStatus : 400;
          const code = config.errorCode || (status === 500 ? 'INTERNAL_ERROR' : 131000);
          res.writeHead(status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: {
              message: `Injected mock failure for code ${code}`,
              type: 'OAuthException',
              code: typeof code === 'number' ? code : 131000,
              error_subcode: 0,
              fbtrace_id: `mock-trace-${Date.now()}`
            }
          }));
          return;
        }

        // Happy path
        const wamid = `wamid.HBgL${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          messaging_product: 'whatsapp',
          contacts: [{ input: parsedBody?.to || 'unknown', wa_id: parsedBody?.to || 'unknown' }],
          messages: [{ id: wamid }]
        }));
      };

      if (config.latencyMs > 0) {
        setTimeout(respond, config.latencyMs);
      } else {
        respond();
      }
    });
    return;
  }

  // Fallback 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found on mock Meta server' }));
});

function startMockServer(port = 3099) {
  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`[MOCK-META] Server listening on http://127.0.0.1:${port}`);
      resolve(server);
    });
  });
}

function stopMockServer() {
  return new Promise((resolve) => {
    server.close(() => {
      console.log('[MOCK-META] Server stopped.');
      resolve();
    });
  });
}

if (require.main === module) {
  const port = parseInt(process.env.MOCK_META_PORT, 10) || 3099;
  startMockServer(port);
}

module.exports = {
  server,
  startMockServer,
  stopMockServer,
  getConfig: () => config,
  setConfig: (c) => { Object.assign(config, c); },
  resetConfig: () => {
    config = { latencyMs: 0, errorCode: null, httpStatus: 200, malformed: false, empty: false };
  },
  getReceivedMessages: () => receivedMessages,
  clearReceivedMessages: () => {
    receivedMessages.length = 0;
    requestCounter = 0;
  }
};

