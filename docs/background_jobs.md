# Background Jobs & Cron Tasks

FuelTracks relies on PM2 to execute background jobs via the `ecosystem.config.js` configuration. These jobs are isolated from the main API and TCP server to prevent blocking the event loop.

## 1. Archiver Job (`backend/jobs/archiverJob.js`)
**Schedule:** Runs daily at 2:00 AM UTC (`0 2 * * *`)
**Process Name:** `fueltracks-archiver`

### Purpose:
Archives raw GPS data and telemetry logs older than the operational window to maintain PostgreSQL (TimescaleDB) performance. 

### Mechanism:
1. Queries historical data partitions in Postgres.
2. Extracts the day's data and compresses it.
3. Uploads the compressed payload to Amazon S3 (Staging bucket).
4. S3 lifecycle rules automatically transition this data to Glacier Deep Archive after 30 days.

---

## 2. Restore Monitor Job (`backend/jobs/restoreMonitorJob.js`)
**Schedule:** Runs every 30 minutes (`*/30 * * * *`)
**Process Name:** `fueltracks-restore-monitor`

### Purpose:
Monitors the status of data retrieval requests from AWS Glacier Deep Archive. 

### Mechanism:
1. When a user requests historical data older than 30 days, a retrieval request is sent to AWS.
2. Glacier retrieval takes 12-48 hours. This job polls AWS S3/Glacier APIs every 30 minutes to check if requested objects have been successfully restored to the S3 standard tier.
3. Once restored, it updates the database status so the user can download their archive via the dashboard.

---

## 3. Disk Monitor Job (`backend/jobs/diskMonitorJob.js`)
**Schedule:** Runs daily at 8:00 AM UTC (`0 8 * * *`)
**Process Name:** `fueltracks-disk-monitor`

### Purpose:
Ensures the server infrastructure does not run out of disk space, which would cause database corruption or TCP server crashes.

### Mechanism:
1. Checks the disk usage of the root volume and the PostgreSQL data volume.
2. If disk usage exceeds the critical threshold (typically 85%), it sends an automated alert (via email/webhook) to the system administrators to prevent outages.
