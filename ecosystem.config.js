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

      // Kill any stale process holding port 3001 before starting (prevents EADDRINUSE crash loops)
      pre_start: 'fuser -k 3001/tcp 2>/dev/null || true',

      // Wait 2 seconds between restarts so the port is definitely free
      restart_delay: 2000,
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

    // ── CRON JOBS ──────────────────────────────────────────
    {
      name: 'fueltracks-archiver',
      script: 'backend/jobs/archiverJob.js',
      instances: 1,
      exec_mode: 'fork',
      cron_restart: '0 2 * * *', // Run every day at 2:00 AM UTC
      autorestart: false, // Exit after running
      env_production: { NODE_ENV: 'production' },
      error_file: '/var/log/pm2/fueltracks-archiver-error.log',
      out_file: '/var/log/pm2/fueltracks-archiver-out.log',
      merge_logs: true,
    },
    {
      name: 'fueltracks-restore-monitor',
      script: 'backend/jobs/restoreMonitorJob.js',
      instances: 1,
      exec_mode: 'fork',
      cron_restart: '*/30 * * * *', // Run every 30 minutes
      autorestart: false,
      env_production: { NODE_ENV: 'production' },
      error_file: '/var/log/pm2/fueltracks-restore-monitor-error.log',
      out_file: '/var/log/pm2/fueltracks-restore-monitor-out.log',
      merge_logs: true,
    },
    {
      name: 'fueltracks-disk-monitor',
      script: 'backend/jobs/diskMonitorJob.js',
      instances: 1,
      exec_mode: 'fork',
      cron_restart: '0 8 * * *', // Run every day at 8:00 AM UTC
      autorestart: false,
      env_production: { NODE_ENV: 'production' },
      error_file: '/var/log/pm2/fueltracks-disk-monitor-error.log',
      out_file: '/var/log/pm2/fueltracks-disk-monitor-out.log',
      merge_logs: true,
    }
  ],
};
