const net = require('net');

const PORTS = [5000, 5001, 5002, 5003, 5004, 5005, 5006, 5007, 5008, 5009, 5010];
const BACKEND_HOST = '5.223.83.39';

PORTS.forEach((port) => {
  const server = net.createServer((clientSocket) => {
    const backendSocket = net.createConnection({ port: port, host: BACKEND_HOST });
    
    let connected = false;
    let buffer = [];
    
    // Manually buffer data received before backend connects
    clientSocket.on('data', (chunk) => {
      if (connected) {
        backendSocket.write(chunk);
      } else {
        buffer.push(chunk);
      }
    });

    // On connect, flush buffer
    backendSocket.on('connect', () => {
      connected = true;
      buffer.forEach(chunk => backendSocket.write(chunk));
      buffer = [];
    });
    
    // Pipe back from backend to client
    backendSocket.on('data', (chunk) => {
      clientSocket.write(chunk);
    });

    // Handle errors silently to prevent noisy logs from dropped tracker connections
    clientSocket.on('error', (err) => {});
    backendSocket.on('error', (err) => {});
    
    // Cleanup on disconnect
    clientSocket.on('close', () => {
      backendSocket.destroy();
    });
    backendSocket.on('close', () => {
      clientSocket.destroy();
    });
  });

  server.listen(port, () => {
    console.log(`Relay listening on port ${port} -> ${BACKEND_HOST}:${port}`);
  });
  
  server.on('error', (err) => {
    console.error(`Server error on port ${port}:`, err.message);
  });
});
