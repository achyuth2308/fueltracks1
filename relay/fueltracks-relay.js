/**
 * FuelTracks Relay Server - Production
 * 
 * Fully bidirectional TCP proxy.
 * 
 * Flow:
 *   Device → Relay (port N) → Backend (5.223.83.39:port N)
 *   Backend ACK → Relay → Device  ← This direction MUST work for handshakes
 *
 * Critical for pioneer PN02 and all tracker protocols:
 *   The device sends a packet and WAITS for an ACK before sending the next one.
 *   If the relay blocks the ACK, the device will retry the same packet forever.
 */

const net = require('net');

const PORTS = [5000, 5001, 5002, 5003, 5004, 5005, 5006, 5007, 5008, 5009, 5010];
const BACKEND_HOST = '5.223.83.39';

// Stats tracker
const stats = {
  totalConnections: 0,
  activeConnections: 0,
  bytesFromDevice: 0,
  bytesFromBackend: 0,
};

setInterval(() => {
  console.log(`[RELAY STATS] Active: ${stats.activeConnections} | Total: ${stats.totalConnections} | Device→Backend: ${stats.bytesFromDevice}B | Backend→Device: ${stats.bytesFromBackend}B`);
}, 60000);

PORTS.forEach((port) => {
  const server = net.createServer((deviceSocket) => {
    stats.totalConnections++;
    stats.activeConnections++;

    const clientAddr = deviceSocket.remoteAddress + ':' + deviceSocket.remotePort;
    console.log(`[RELAY:${port}] Device connected: ${clientAddr}`);

    // Open connection to backend immediately
    const backendSocket = net.createConnection({ 
      port: port, 
      host: BACKEND_HOST,
      keepAlive: true,
      keepAliveInitialDelay: 10000,
    });

    let backendReady = false;
    let deviceBuffer = [];

    // ─── Device → Backend ─────────────────────────────────────────────────────
    deviceSocket.on('data', (chunk) => {
      stats.bytesFromDevice += chunk.length;
      if (backendReady) {
        const ok = backendSocket.write(chunk);
        if (!ok) {
          // Pause device until backend drains
          deviceSocket.pause();
          backendSocket.once('drain', () => deviceSocket.resume());
        }
      } else {
        // Buffer until backend connects
        deviceBuffer.push(chunk);
      }
    });

    // ─── Backend → Device (ACK path - CRITICAL for handshake) ─────────────────
    backendSocket.on('data', (chunk) => {
      stats.bytesFromBackend += chunk.length;
      console.log(`[RELAY:${port}] Backend→Device ACK (${chunk.length}B): ${chunk.toString('hex')} → ${clientAddr}`);
      const ok = deviceSocket.write(chunk);
      if (!ok) {
        // Pause backend until device drains
        backendSocket.pause();
        deviceSocket.once('drain', () => backendSocket.resume());
      }
    });

    // ─── Backend Connect: flush buffered data ─────────────────────────────────
    backendSocket.on('connect', () => {
      backendReady = true;
      console.log(`[RELAY:${port}] Backend connected for device ${clientAddr}`);
      if (deviceBuffer.length > 0) {
        const combined = Buffer.concat(deviceBuffer);
        deviceBuffer = [];
        backendSocket.write(combined);
        console.log(`[RELAY:${port}] Flushed ${combined.length}B buffered data to backend`);
      }
    });

    // ─── Cleanup handlers ─────────────────────────────────────────────────────
    deviceSocket.on('end', () => {
      console.log(`[RELAY:${port}] Device disconnected: ${clientAddr}`);
      backendSocket.end();
    });

    deviceSocket.on('close', () => {
      stats.activeConnections = Math.max(0, stats.activeConnections - 1);
      backendSocket.destroy();
    });

    backendSocket.on('end', () => {
      console.log(`[RELAY:${port}] Backend closed connection for ${clientAddr}`);
      deviceSocket.end();
    });

    backendSocket.on('close', () => {
      deviceSocket.destroy();
    });

    // ─── Error handlers (log but don't crash) ─────────────────────────────────
    deviceSocket.on('error', (err) => {
      if (err.code !== 'ECONNRESET' && err.code !== 'EPIPE') {
        console.error(`[RELAY:${port}] Device socket error (${clientAddr}): ${err.message}`);
      }
      backendSocket.destroy();
    });

    backendSocket.on('error', (err) => {
      console.error(`[RELAY:${port}] Backend socket error: ${err.message}`);
      deviceSocket.destroy();
    });

    // ─── Socket options for low-latency ACK delivery ──────────────────────────
    deviceSocket.setNoDelay(true);   // Disable Nagle - send ACK immediately, no buffering
    backendSocket.setNoDelay(true);  // Same for backend direction
    deviceSocket.setTimeout(120000); // 2 min timeout
    backendSocket.setTimeout(120000);

    deviceSocket.on('timeout', () => {
      console.log(`[RELAY:${port}] Device timeout: ${clientAddr}`);
      deviceSocket.destroy();
    });
    backendSocket.on('timeout', () => {
      console.log(`[RELAY:${port}] Backend timeout for ${clientAddr}`);
      backendSocket.destroy();
    });
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`[RELAY] Listening on port ${port} → ${BACKEND_HOST}:${port}`);
  });

  server.on('error', (err) => {
    console.error(`[RELAY] Server error on port ${port}: ${err.message}`);
  });
});

console.log('[RELAY] FuelTracks Relay Server started. All ports active.');
