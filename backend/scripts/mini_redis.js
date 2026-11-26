/**
 * Lightweight In-Memory Redis Server for FuelTracks local development
 * Implements basic RESP protocol for GET, SET, DEL, INCR, INCRBYFLOAT, PUBLISH, SUBSCRIBE
 */
const net = require('net');

const store = new Map();
const expiries = new Map();
const subscribers = new Map(); // channel -> Set of sockets

function serializeResp(val) {
  if (val === null || val === undefined) return Buffer.from('$-1\r\n');
  if (typeof val === 'number') return Buffer.from(`:${val}\r\n`);
  if (typeof val === 'string' || Buffer.isBuffer(val)) {
    const buf = Buffer.from(val);
    return Buffer.concat([Buffer.from(`$${buf.length}\r\n`), buf, Buffer.from('\r\n')]);
  }
  if (Array.isArray(val)) {
    const parts = [Buffer.from(`*${val.length}\r\n`)];
    for (const item of val) {
      parts.push(serializeResp(item));
    }
    return Buffer.concat(parts);
  }
  return Buffer.from(`+${val}\r\n`);
}

function parseCommands(buffer) {
  const commands = [];
  let offset = 0;

  while (offset < buffer.length) {
    if (buffer[offset] === 42) { // '*' Array of bulk strings
      const lineEnd = buffer.indexOf('\r\n', offset);
      if (lineEnd === -1) break;
      const count = parseInt(buffer.slice(offset + 1, lineEnd).toString(), 10);
      offset = lineEnd + 2;

      const args = [];
      let incomplete = false;
      for (let i = 0; i < count; i++) {
        if (offset >= buffer.length || buffer[offset] !== 36) { // '$'
          incomplete = true;
          break;
        }
        const bEnd = buffer.indexOf('\r\n', offset);
        if (bEnd === -1) { incomplete = true; break; }
        const len = parseInt(buffer.slice(offset + 1, bEnd).toString(), 10);
        offset = bEnd + 2;
        if (len === -1) {
          args.push(null);
        } else {
          if (offset + len + 2 > buffer.length) { incomplete = true; break; }
          args.push(buffer.slice(offset, offset + len).toString());
          offset += len + 2;
        }
      }
      if (incomplete) break;
      commands.push({ args, consumed: offset });
    } else {
      // Inline command (e.g. PING)
      const lineEnd = buffer.indexOf('\r\n', offset);
      if (lineEnd === -1) break;
      const line = buffer.slice(offset, lineEnd).toString().trim();
      offset = lineEnd + 2;
      if (line.length > 0) {
        commands.push({ args: line.split(/\s+/), consumed: offset });
      }
    }
  }

  return { commands, remaining: buffer.slice(offset) };
}

const server = net.createServer((socket) => {
  let inBuf = Buffer.alloc(0);
  const mySubscriptions = new Set();

  socket.on('data', (chunk) => {
    inBuf = Buffer.concat([inBuf, chunk]);
    const { commands, remaining } = parseCommands(inBuf);
    inBuf = remaining;

    for (const { args } of commands) {
      if (!args || args.length === 0) continue;
      const cmd = args[0].toUpperCase();

      if (cmd === 'PING') {
        socket.write('+PONG\r\n');
      } else if (cmd === 'CLIENT') {
        socket.write('+OK\r\n');
      } else if (cmd === 'COMMAND') {
        socket.write('*0\r\n');
      } else if (cmd === 'INFO') {
        socket.write(serializeResp('# Server\r\nredis_version:7.0.0\r\n'));
      } else if (cmd === 'SELECT') {
        socket.write('+OK\r\n');
      } else if (cmd === 'SET') {
        const key = args[1];
        const val = args[2];
        store.set(key, val);
        if (expiries.has(key)) {
          clearTimeout(expiries.get(key));
          expiries.delete(key);
        }
        if (args[3] && args[3].toUpperCase() === 'EX' && args[4]) {
          const sec = parseInt(args[4], 10);
          if (sec > 0) {
            const t = setTimeout(() => {
              store.delete(key);
              expiries.delete(key);
            }, sec * 1000);
            expiries.set(key, t);
          }
        }
        socket.write('+OK\r\n');
      } else if (cmd === 'GET') {
        const key = args[1];
        const val = store.has(key) ? store.get(key) : null;
        socket.write(serializeResp(val));
      } else if (cmd === 'DEL') {
        let count = 0;
        for (let i = 1; i < args.length; i++) {
          const k = args[i];
          if (store.delete(k)) count++;
          if (expiries.has(k)) {
            clearTimeout(expiries.get(k));
            expiries.delete(k);
          }
        }
        socket.write(`:${count}\r\n`);
      } else if (cmd === 'INCR') {
        const key = args[1];
        const cur = parseInt(store.get(key) || '0', 10);
        const next = cur + 1;
        store.set(key, String(next));
        socket.write(`:${next}\r\n`);
      } else if (cmd === 'INCRBYFLOAT') {
        const key = args[1];
        const delta = parseFloat(args[2]) || 0;
        const cur = parseFloat(store.get(key) || '0');
        const next = cur + delta;
        store.set(key, String(next));
        socket.write(serializeResp(String(next)));
      } else if (cmd === 'SUBSCRIBE') {
        for (let i = 1; i < args.length; i++) {
          const ch = args[i];
          if (!subscribers.has(ch)) subscribers.set(ch, new Set());
          subscribers.get(ch).add(socket);
          mySubscriptions.add(ch);
          socket.write(serializeResp(['subscribe', ch, mySubscriptions.size]));
        }
      } else if (cmd === 'PUBLISH') {
        const ch = args[1];
        const msg = args[2];
        let delivered = 0;
        if (subscribers.has(ch)) {
          const clientSet = subscribers.get(ch);
          for (const client of clientSet) {
            if (!client.destroyed) {
              client.write(serializeResp(['message', ch, msg]));
              delivered++;
            }
          }
        }
        socket.write(`:${delivered}\r\n`);
      } else {
        socket.write('+OK\r\n');
      }
    }
  });

  socket.on('close', () => {
    for (const ch of mySubscriptions) {
      if (subscribers.has(ch)) {
        subscribers.get(ch).delete(socket);
      }
    }
  });

  socket.on('error', () => {});
});

server.listen(6379, '127.0.0.1', () => {
  console.log('[MINI-REDIS] In-memory Redis server listening on 127.0.0.1:6379');
});
