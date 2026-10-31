const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');

const TUNNEL_JSON_PATH = path.join(__dirname, '..', 'tunnel.json');

class TunnelService {
  constructor() {
    this.childProcess = null;
    this.activeUrl = '';
    this.starting = false;
    this.cloudflaredBin = this.findCloudflaredBinary();
    
    // Load existing tunnel if still valid
    this.loadPersistedTunnel();

    // Clean up on exit
    process.on('exit', () => this.cleanup());
    process.on('SIGINT', () => {
      this.cleanup();
      process.exit();
    });
    process.on('SIGTERM', () => {
      this.cleanup();
      process.exit();
    });
  }

  findCloudflaredBinary() {
    const candidates = [
      'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
      'C:\\Program Files\\cloudflared\\cloudflared.exe',
      path.join(os.homedir(), 'bin', 'cloudflared.exe'),
      path.join(os.homedir(), 'cloudflared.exe'),
      'cloudflared.exe',
      'cloudflared'
    ];

    for (const bin of candidates) {
      if (fs.existsSync(bin)) return bin;
    }

    try {
      const output = execSync('where cloudflared', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const firstLine = output.split(/\r?\n/)[0]?.trim();
      if (firstLine && fs.existsSync(firstLine)) {
        return firstLine;
      }
    } catch (_) {}

    return null;
  }

  loadPersistedTunnel() {
    try {
      if (fs.existsSync(TUNNEL_JSON_PATH)) {
        const data = JSON.parse(fs.readFileSync(TUNNEL_JSON_PATH, 'utf8'));
        if (data && data.url) {
          this.activeUrl = data.url;
        }
      }
    } catch (_) {}
  }

  saveTunnelUrl(url) {
    this.activeUrl = url;
    try {
      fs.writeFileSync(
        TUNNEL_JSON_PATH,
        JSON.stringify(
          {
            url: url,
            updatedAt: new Date().toISOString(),
            pid: this.childProcess ? this.childProcess.pid : null
          },
          null,
          2
        ),
        'utf8'
      );
    } catch (err) {
      console.error('[TunnelService] Failed to save tunnel.json:', err.message);
    }
  }

  async verifyUrl(url, timeoutMs = 2500) {
    if (!url || !url.startsWith('https://')) return false;
    return new Promise((resolve) => {
      const req = https.get(url, { timeout: timeoutMs }, (res) => {
        // Any 2xx, 3xx or 404 from our Vite server means tunnel is connected to Vite
        resolve(res.statusCode < 500);
      });
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.on('error', () => resolve(false));
    });
  }

  getLanIp() {
    let lanIp = 'localhost';
    const interfaces = os.networkInterfaces();
    for (const [name, ifaceList] of Object.entries(interfaces)) {
      if (
        name.toLowerCase().includes('vethernet') ||
        name.toLowerCase().includes('virtual') ||
        name.toLowerCase().includes('loopback') ||
        name.toLowerCase().includes('wsl')
      ) {
        continue;
      }
      for (const i of ifaceList) {
        if ((i.family === 'IPv4' || i.family === 4) && !i.internal && i.address !== '127.0.0.1') {
          lanIp = i.address;
          break;
        }
      }
      if (lanIp !== 'localhost') break;
    }
    return lanIp;
  }

  async getTunnelUrl(targetPort = 5173) {
    // 1. If we have an activeUrl, verify it is actually live
    if (this.activeUrl) {
      const isAlive = await this.verifyUrl(this.activeUrl, 1500);
      if (isAlive) {
        return this.activeUrl;
      }
      // Dead URL: clear it
      console.warn(`[TunnelService] Tunnel ${this.activeUrl} is unreachable. Invalidating...`);
      this.activeUrl = '';
      try {
        if (fs.existsSync(TUNNEL_JSON_PATH)) {
          fs.unlinkSync(TUNNEL_JSON_PATH);
        }
      } catch (_) {}
    }

    // 2. Try to start a new tunnel if cloudflared is present
    if (this.cloudflaredBin && !this.starting) {
      return this.startTunnel(targetPort);
    }

    return '';
  }

  startTunnel(targetPort = 5173) {
    if (this.starting) {
      return Promise.resolve(this.activeUrl);
    }

    if (!this.cloudflaredBin) {
      console.warn('[TunnelService] cloudflared binary not found on this machine.');
      return Promise.resolve('');
    }

    this.starting = true;
    console.log(`[TunnelService] Starting Cloudflare Tunnel pointing to http://localhost:${targetPort}...`);

    return new Promise((resolve) => {
      let resolved = false;

      try {
        const proc = spawn(this.cloudflaredBin, ['tunnel', '--url', `http://localhost:${targetPort}`], {
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe']
        });

        this.childProcess = proc;

        const onOutput = (chunk) => {
          const str = chunk.toString();
          // Look for trycloudflare.com URL pattern
          const match = str.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
          if (match && !resolved) {
            resolved = true;
            this.starting = false;
            const newUrl = match[0];
            console.log(`[TunnelService] Tunnel successfully launched: ${newUrl}`);
            this.saveTunnelUrl(newUrl);
            resolve(newUrl);
          }
        };

        if (proc.stdout) proc.stdout.on('data', onOutput);
        if (proc.stderr) proc.stderr.on('data', onOutput);

        proc.on('error', (err) => {
          console.error('[TunnelService] Failed to spawn cloudflared:', err.message);
          this.starting = false;
          if (!resolved) {
            resolved = true;
            resolve('');
          }
        });

        proc.on('close', (code) => {
          console.log(`[TunnelService] cloudflared exited with code ${code}`);
          this.childProcess = null;
          this.activeUrl = '';
          this.starting = false;
          try {
            if (fs.existsSync(TUNNEL_JSON_PATH)) {
              fs.unlinkSync(TUNNEL_JSON_PATH);
            }
          } catch (_) {}
          if (!resolved) {
            resolved = true;
            resolve('');
          }
        });

        // 12s timeout for tunnel setup
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            this.starting = false;
            console.warn('[TunnelService] Tunnel launch timed out waiting for URL.');
            resolve(this.activeUrl || '');
          }
        }, 12000);

      } catch (err) {
        console.error('[TunnelService] Error starting tunnel:', err.message);
        this.starting = false;
        resolve('');
      }
    });
  }

  cleanup() {
    if (this.childProcess) {
      try {
        this.childProcess.kill();
      } catch (_) {}
      this.childProcess = null;
    }
  }
}

module.exports = new TunnelService();
