// ============================================================
// PM2 ECOSYSTEM CONFIG — FuelTracks
// Deploy with: pm2 start ecosystem.config.js --env production
// ============================================================

module.exports = {
  apps: [
    // ── API + WebSocket server ──────────────────────────────
    {
      name: 'fueltracks-api',
      script: 'backend/server.js',

      // TCP servers can't use cluster mode (can't share raw sockets).
      // API could, but keep fork for simpler debugging; scale horizontally via load balancer.
      instances: 1,
      exec_mode: 'fork',

      // Cap heap to avoid OOM on t3.medium (4GB); Node will GC more aggressively before this
      node_args: '--max-old-space-size=512',

      env_production: {
        NODE_ENV: 'production',
      },

      // Auto-restart if memory grows past 600 MB (leak guard)
      max_memory_restart: '600M',

      // Log paths — ensure /var/log/pm2/ exists and is writable by ubuntu
      error_file: '/var/log/pm2/fueltracks-api-error.log',
      out_file:   '/var/log/pm2/fueltracks-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Wait 1 second between restarts to avoid rapid crash loops
      restart_delay: 1000,
      max_restarts: 10,
      min_uptime: '10s',

      watch: false,
      autorestart: true,
    },

    // ── TCP ingestion server ────────────────────────────────
    {
      name: 'fueltracks-tcp',
      script: 'tcp-server/server.js',

      // Must be fork — Concox/BSTPL/AIS140 raw TCP sockets are not cluster-safe
      instances: 1,
      exec_mode: 'fork',

      node_args: '--max-old-space-size=512',

      env_production: {
        NODE_ENV: 'production',
      },

      max_memory_restart: '600M',

      error_file: '/var/log/pm2/fueltracks-tcp-error.log',
      out_file:   '/var/log/pm2/fueltracks-tcp-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      restart_delay: 1000,
      max_restarts: 10,
      min_uptime: '10s',

      watch: false,
      autorestart: true,
    },
  ],
};
