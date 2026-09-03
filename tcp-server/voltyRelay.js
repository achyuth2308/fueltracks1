// ============================================================
// VOLTYSOFT TCP RELAY
// Forwards raw GPS packets to Voltysoft's government bridge
// ============================================================

const net = require('net');

const VOLTYSOFT_HOST = 'device.simplytrack.in';
const VOLTYSOFT_PORT = 24000;

// Map of active relay sockets keyed by IMEI
const relaySockets = new Map();

/**
 * Forward a raw buffer packet to Voltysoft
 * @param {string} imei The IMEI of the vehicle
 * @param {Buffer|string} rawData The exact raw data received from the device
 */
function forwardToVoltysoft(imei, rawData) {
  if (!imei || !rawData) return;

  let client = relaySockets.get(imei);

  if (!client || client.destroyed) {
    client = new net.Socket();
    client.connect(VOLTYSOFT_PORT, VOLTYSOFT_HOST, () => {
      console.log(`[TCP RELAY] Connected to Voltysoft for IMEI: ${imei}`);
      client.write(rawData);
    });

    client.on('error', (err) => {
      console.error(`[TCP RELAY] Voltysoft relay error for ${imei}:`, err.message);
      client.destroy();
    });

    client.on('close', () => {
      console.log(`[TCP RELAY] Voltysoft connection closed for IMEI: ${imei}`);
      relaySockets.delete(imei);
    });

    client.on('data', (data) => {
      // Voltysoft might send ACK back. We ignore it because we already ACK the device locally.
    });

    relaySockets.set(imei, client);
  } else {
    // Socket is already open, just write to it
    client.write(rawData);
  }
}

/**
 * Close all relay sockets cleanly
 */
function closeAll() {
  for (const [imei, socket] of relaySockets.entries()) {
    if (!socket.destroyed) {
      socket.destroy();
    }
  }
  relaySockets.clear();
}

module.exports = {
  forwardToVoltysoft,
  closeAll
};
