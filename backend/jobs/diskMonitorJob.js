const { exec } = require('child_process');
const emailService = require('../services/emailService');

const DISK_THRESHOLD_PERCENT = 80;

/**
 * Runs daily. Checks root disk space on the server.
 * If usage exceeds 80%, fires an emergency alert.
 */
function checkDiskSpace() {
  console.log('[DiskMonitorJob] Checking disk space...');
  
  exec("df -h / | awk 'NR==2 {print $5}' | sed 's/%//'", async (error, stdout, stderr) => {
    if (error) {
      console.error('[DiskMonitorJob] Failed to execute df:', error);
      return;
    }
    
    const usageStr = stdout.trim();
    const usagePercent = parseInt(usageStr, 10);
    
    console.log(`[DiskMonitorJob] Current disk usage: ${usagePercent}%`);

    if (!isNaN(usagePercent) && usagePercent >= DISK_THRESHOLD_PERCENT) {
      console.error(`[DiskMonitorJob] CRITICAL: Disk usage is at ${usagePercent}%! Over ${DISK_THRESHOLD_PERCENT}% threshold.`);
      
      try {
        // We'll reuse the archival status email function as a generic alert,
        // or directly use Brevo. Let's send a custom status string that triggers the alert.
        await emailService.sendArchivalStatusEmail(
          'info@fueltracks.in', 
          'failed', 
          `SERVER DISK IS AT ${usagePercent}%. ARCHIVAL JOB MAY BE BROKEN. PLEASE CHECK IMMEDIATELY.`
        );
        console.log('[DiskMonitorJob] Emergency alert sent.');
      } catch (err) {
        console.error('[DiskMonitorJob] Failed to send emergency email:', err);
      }
    } else {
      console.log(`[DiskMonitorJob] Disk space is healthy.`);
    }
  });
}

// If run directly
if (require.main === module) {
  checkDiskSpace();
}

module.exports = { checkDiskSpace };
