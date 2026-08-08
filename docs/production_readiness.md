# FuelTracks — Complete Production Readiness Package

**Status: LOCKED IN** — architecture, hosting provider, and pricing below are final decisions, not open options.

**Stack:** Node.js/Express/Socket.io, PostgreSQL 16 + TimescaleDB, Redis
**Protocols:** BSTPL-17, AIS140, Concox (TCP) — ports 5000–5004
**Hosting:** Hetzner Cloud, Singapore location, two-server architecture (relay + backend)
**Archival:** AWS S3 (staging) → Glacier Deep Archive (automated lifecycle)
**Current scale target:** 1,000–3,000 vehicles, designed to scale to 2,00,000

---

## 1. LOCKED-IN PRICING

### Current scale (1,000–3,000 vehicles)

| Item | Cost/month |
|---|---|
| Relay VPS (Hetzner, smallest tier) | ₹580–650 |
| Backend VPS (Hetzner, 8GB/4vCPU, Singapore) | ₹2,100–2,400 |
| S3 staging + Glacier archival | ₹20–30 |
| Domain/SSL (amortized) | ₹100–150 |
| **Total** | **~₹2,800–3,200/month** |
| **Cost per vehicle (at 3,000)** | **~₹1.00/month** |

### Scaling path, 10K → 2,00,000 vehicles

| Vehicle count | What changes | Total infra/month | Cost/vehicle/month |
|---|---|---|---|
| 5,000–10,000 | Vertical upgrade — bigger Hetzner backend box | ₹3,700–4,900 | ₹0.37–0.98 |
| 10,000–30,000 | Split into 2 servers (ingestion + DB, dedicated-core) | ₹8,000–12,000 | ₹0.27–1.20 |
| 30,000–50,000 | + read replica + Redis Streams buffer + 2nd ingestion server | ₹15,000–24,000 | ₹0.30–0.80 |
| 50,000–2,00,000 | Full horizontal scale: multiple ingestion servers, load balancer, DB primary+replicas, message queue (Kafka justified here) | ₹15,000–35,000+ | ₹0.08–0.70 |

**Rule:** only move to the next tier when actually hitting the resource ceiling of the current one — never pre-build ahead of real vehicle count.

### Business case vs. old vendor software

| | Cost/device/year |
|---|---|
| Old vendor software (admin + customer panel license) | ₹200 |
| In-house software infra cost (at 10K scale) | ~₹10–12 |
| **Savings per device/year** | **~₹188–190** |

At 10,000 devices: **~₹19,00,000/year saved** on software licensing alone.

---

## 2. ARCHITECTURE

```
                    [Marketing site]
                    Vercel/Cloudflare Pages (free, decoupled)

[GPS Devices] ──TCP──> [RELAY VPS]  ──forwards──> [BACKEND VPS]
                        Hetzner CX22               Hetzner CPX (8GB/4vCPU)
                        Singapore                  Singapore
                        Fixed IP,                  ├── Node TCP ingestion
                        NEVER changes               ├── Node API + Socket.io
                        socat + supervisor          ├── Nginx (API + dashboard static build)
                                                     ├── PostgreSQL 16 + TimescaleDB
                                                     └── Redis (cache + live position buffer)
                                                              │
                                                     Daily cron: export day's data → S3
                                                              │
                                                     S3 lifecycle rule: auto-archive to Glacier Deep Archive after 30 days
```

**Why the relay exists:** GPS devices hardcode server IP:port at install time. The relay is the ONLY address ever given to physical devices. Migrating the backend later means changing one forwarding rule on the relay — not touching thousands of deployed devices.

---

## 3. RELAY SERVER — PROVISIONING SCRIPT
See `infrastructure/relay_provision.sh`

---

## 4. BACKEND SERVER — PROVISIONING SCRIPT
See `infrastructure/backend_provision.sh`

---

## 5. OFF-SERVER BACKUP SCRIPT (Postgres → S3)
See `infrastructure/backup_script.sh`

---

## 6. DAILY GPS DATA ARCHIVAL — S3 + GLACIER
See `infrastructure/archival_script.sh`

---

## 7. LIVE POSITION BUFFER PATTERN (replaces Kafka)

No message broker needed at this scale. In-memory buffer + timed flush + Redis for live position:

```javascript
// tcp-server.js — packet handler
const buffer = [];

function onDevicePacket(imei, gpsData) {
  // Live map: instant update, no DB write
  redisClient.set(`latest:${imei}`, JSON.stringify(gpsData), 'EX', 120);

  // Queue for batched persistence
  buffer.push({ imei, ...gpsData, received_at: new Date() });
}

// Flush every 20 seconds — batched write, not per-packet
setInterval(async () => {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0, buffer.length);
  try {
    await batchUpsertGpsData(batch); // single multi-row INSERT/UPSERT
  } catch (err) {
    logger.error('Batch flush failed', err);
    // Consider: push failed batch to Redis Streams for retry,
    // rather than losing it silently
  }
}, 20000);
```

**If durability across restarts matters** (don't lose a few seconds of buffered data on a crash), swap the in-memory array for **Redis Streams** — same Redis you're already running:

```javascript
// Instead of buffer.push():
await redisClient.xadd('gps:pending', '*', 'data', JSON.stringify(gpsData));

// Flush job reads and trims the stream instead of an array
const entries = await redisClient.xrange('gps:pending', '-', '+', 'COUNT', 5000);
// ...batch write, then:
await redisClient.xtrim('gps:pending', 'MAXLEN', 0);
```

---

## 8. IMMOBILIZER FLOW — DESIGN PATTERN

**⚠️ Safety-critical feature — read the safety rules before implementing anything below.**

I don't have your specific device's exact command bytes for relay-based engine cutoff (this varies by device vendor/firmware — check your device's protocol datasheet for the literal command string). What follows is the **safe design pattern** any implementation must follow, regardless of exact device command syntax.

### Mandatory safety rules
1. **Never allow cutoff above 0 km/h.** Check the device's last-reported speed before sending any cutoff command. If speed > 0, reject the command outright — do not queue it for "when it stops," reject it now and require the operator to resend.
2. **Require explicit confirmation from the requesting user** (not a single click) — this is a physically consequential action.
3. **Log every immobilizer command** — who requested it, when, the vehicle's speed/location at request time, and the device's acknowledgment (or failure to acknowledge).
4. **Require device acknowledgment before showing "success" in the UI.** Sending the command is not the same as it taking effect — wait for the device's ACK packet.
5. **Auto-expire pending commands** — if no ACK within a defined timeout (e.g., 30s), mark as failed, don't leave it in an ambiguous state.
6. **Re-verify speed = 0 at the moment of sending**, not just when the button was clicked — a vehicle could start moving in the gap between request and dispatch.

### Flow

```
[Operator clicks "Immobilize Vehicle X"]
        │
        ▼
[Backend checks Redis: latest:{imei} — what's the last known speed?]
        │
   speed > 0? ──YES──> REJECT: "Vehicle is moving, cannot immobilize"
        │
       NO
        │
        ▼
[Require explicit confirmation dialog: "This will cut engine power. Confirm?"]
        │
        ▼
[Backend re-checks speed one more time (race condition guard)]
        │
        ▼
[Send device-specific cutoff command over the TCP connection]
        │
        ▼
[Log: user, vehicle, timestamp, speed-at-request, command sent]
        │
        ▼
[Wait for device ACK, timeout 30s]
        │
   ACK received? ──NO──> Mark FAILED, alert operator, log timeout
        │
       YES
        │
        ▼
[Mark SUCCESS, notify operator, log confirmed state]
```

### Code skeleton (command syntax is a placeholder — replace with your device's actual protocol)

```javascript
async function immobilizeVehicle(imei, requestedBy) {
  const latest = await redisClient.get(`latest:${imei}`);
  if (!latest) throw new Error('No recent position data — cannot verify vehicle is stopped');

  const { speed, timestamp } = JSON.parse(latest);
  const dataAge = Date.now() - new Date(timestamp).getTime();

  if (speed > 0) {
    throw new Error('Vehicle is in motion — immobilization blocked');
  }
  if (dataAge > 60000) {
    throw new Error('Position data is stale — cannot confirm vehicle is stopped');
  }

  const commandId = generateCommandId();
  await logImmobilizerRequest({ imei, requestedBy, speed, commandId });

  // Re-check immediately before dispatch (race condition guard)
  const recheck = await redisClient.get(`latest:${imei}`);
  if (JSON.parse(recheck).speed > 0) {
    throw new Error('Vehicle started moving — immobilization aborted');
  }

  // PLACEHOLDER — replace with your device's actual protocol command
  const success = await sendDeviceCommand(imei, 'RELAY_CUTOFF_ON', { commandId });

  if (!success) {
    await logImmobilizerResult({ commandId, status: 'FAILED_NO_ACK' });
    throw new Error('Device did not acknowledge command');
  }

  await logImmobilizerResult({ commandId, status: 'CONFIRMED' });
  return { commandId, status: 'CONFIRMED' };
}
```

### Common implementation pitfalls (worth checking against whatever issue you're currently hitting)
- **Relay wiring**: confirm the relay is wired to interrupt the correct circuit (fuel pump or starter, not something that fails unsafely) — this is a hardware/installation issue as much as a software one.
- **ACK timeout too short**: cellular latency varies; a 5-second timeout will show false failures. 30s is safer.
- **No re-check before dispatch**: the biggest safety gap — always re-verify speed immediately before sending, not just when the operator first clicked.
- **Silent command loss**: if the TCP connection drops between "command sent" and "ACK received," you need a retry/requery flow, not an indefinite "pending" state.

---

## 9. MIGRATION SAFETY (any future server move)

```
1. pg_dump -Fc fueltracks_db > backup.dump          (on OLD server)
2. Transfer dump to NEW server (scp/rsync)
3. Install TimescaleDB extension on NEW server BEFORE restoring
4. pg_restore -d fueltracks_db backup.dump           (on NEW server)
5. Verify: SELECT count(*) FROM key_tables;  — compare old vs new
6. Update relay's forwarding rule to point at new backend IP
7. Keep old server alive a few days post-cutover as rollback
```

---

## 10. CODE QUALITY CHECKLIST

```
[ ] Every async function wrapped in try/catch
[ ] Global Express error handler + unhandledRejection/uncaughtException
    handlers — logged, never silently crash
[ ] TCP parser: malformed device packets caught, logged, never crash
    the whole ingestion server
[ ] All API input validated (Zod/Joi) before touching DB
[ ] Parameterized queries only — zero string-concatenated SQL
[ ] Structured logger (Pino/Winston), correct log levels, no secrets logged
[ ] All secrets in .env, .env in .gitignore
[ ] npm audit run, high/critical vulnerabilities fixed
[ ] ESLint + Prettier enforced (pre-commit hook or CI)
[ ] Schema changes via migration tool (Knex/Prisma/node-pg-migrate)
[ ] Indexes on IMEI, vehicle ID, timestamp — verify with EXPLAIN ANALYZE
[ ] IMEI lookups + geofence checks cached in Redis, not queried per-packet
[ ] Batched UPSERTs, not one write per packet
[ ] SIGTERM/SIGINT handled — close DB pool + Redis cleanly
[ ] Device reconnect logic with backoff
```

---

## 11. PRODUCTION READINESS CHECKLIST

```
[ ] Uptime monitoring (UptimeRobot/Better Uptime) on /health endpoint
[ ] /health checks actual DB + Redis connectivity, not just "server up"
[ ] Sentry (or equivalent) for error tracking
[ ] Alert specifically on TCP server disconnect/crash
[ ] Basic CI (GitHub Actions): lint + test before merge
[ ] Staging environment before touching production device fleet
[ ] Incident runbook: server down, disk full, TCP server not accepting
    connections — written BEFORE it's needed live
[ ] README with environment setup steps
[ ] API endpoints documented
[ ] Relay/migration process documented (not tribal knowledge)
[ ] Immobilizer safety rules documented and reviewed by whoever
    signs off on the feature — this is not just a code review item
```

---

## 12. ROLLOUT PRIORITY ORDER

```
1. Provision relay + backend on Hetzner Singapore
   (backend_provision.sh needs relay IP first — provision relay, THEN backend)
2. Global error handling + input validation
3. Off-server backups (Part 5) — verify a real restore works
4. HTTPS + firewall + rate limiting + fail2ban
5. Logging + Sentry + uptime monitoring
6. PM2 non-root + graceful shutdown + zero-downtime deploy
7. GPS archival pipeline (Part 6) + TimescaleDB compression policy
8. CI pipeline + staging environment
9. Immobilizer feature — only after 1-8 are stable, given its safety profile
10. Indexes, code cleanup, documentation — ongoing

BEFORE ANY SCRIPT RUNS ON PRODUCTION: review the diff/output first.
Confirm before it touches the actual server, database, or a live vehicle.
```

---

## 13. GITHUB → PRODUCTION: THE FULL DEPLOYMENT FLOW

### 13.1 Repo setup (₹0)
```
[ ] Private GitHub repo
[ ] Two branches: main (→ prod), staging (→ pre-prod)
[ ] .gitignore includes: .env, node_modules, any credential/key files
[ ] .env.example committed (empty template) — real .env is created 
    manually on each server, never pulled from git
[ ] package-lock.json committed — ensures server installs the exact 
    same dependency versions you developed against
```

### 13.2 Domain + DNS (~₹800-1,200/year)
```
[ ] Buy .in domain (Namecheap/BigRock/GoDaddy)
[ ] Move DNS to Cloudflare free tier — free DDoS protection as a bonus
[ ] A record: app.fueltracks.in → backend server's IP
```

### 13.3 Deploy key (separate from your personal SSH key)
```bash
ssh-keygen -t ed25519 -f fueltracks_deploy_key -C "deploy"
# Public key → server's /home/fueltracks/.ssh/authorized_keys
# Private key → kept safe, used only for deploys (GitHub Secrets if 
# automating later, or just your local machine for manual deploys)
```

### 13.4 The firewall conflict — decide this explicitly
Part 4's backend firewall restricts SSH to your ADMIN_IP only. GitHub 
Actions runners have changing IPs and can't SSH in under that rule as-is.

DECISION (recommended while solo): manual deploy — no automatic 
GitHub→server push. You SSH in yourself and run deploy.sh after 
testing on staging. Firewall stays exactly as locked in. Revisit 
self-hosted Actions runner once deploy frequency makes this slow.

### 13.5 deploy.sh (lives on the server)
```bash
#!/bin/bash
# /home/fueltracks/deploy.sh — run manually via SSH
cd /home/fueltracks/app
git pull origin main
npm ci --production
pm2 reload ecosystem.config.js --env production
echo "Deployed $(git rev-parse --short HEAD)"
```

### 13.6 SSL (₹0)
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d app.fueltracks.in
# Verify auto-renewal actually works:
sudo certbot renew --dry-run
```

### 13.7 Staging environment (~₹500/month, separate small VPS)
```
[ ] Same provisioning script, smaller server size
[ ] Separate subdomain: staging.fueltracks.in
[ ] Separate database — never point staging at production data
[ ] Workflow: push to staging branch → deploy.sh on staging server 
    → test → merge staging into main → deploy.sh on prod server
```

### 13.8 Go-live checklist
```
[ ] Relay's forwarding rule points to real backend IP
[ ] DNS A record live and resolving
[ ] SSL active and auto-renewing
[ ] .env has real generated secrets, not placeholders
[ ] Backup cron confirmed running — check the log file after first run
[ ] /health endpoint returns success
[ ] UptimeRobot pointed at /health
[ ] One real device tested end-to-end before onboarding the full fleet
```

### 13.9 Common errors in this flow

| Error | Cause | Fix |
|---|---|---|
| `Permission denied (publickey)` | Deploy key not on server, or wrong path | Confirm public key is in `authorized_keys` exactly |
| Code doesn't change after deploy | Pulled code but didn't restart the process | `pm2 reload`, not just `git pull` |
| Missing `.env` on new server | Correctly gitignored, never manually created | Keep `.env.example` in git as a template, fill real values by hand per server |
| `npm ci` fails on server, works locally | Lockfile not committed, or Node version mismatch | Commit `package-lock.json`, match server's Node version to dev |
| GitHub Actions can't SSH in | The IP conflict from 13.4 | Use manual deploy (Option A) until automation is worth the setup |
| Device connections drop on deploy | `pm2 reload` restarts the TCP listener | Expected at current scale; PM2 cluster mode + `wait_ready` for true zero-downtime once it matters |

---

## 14. STEP-BY-STEP FORMULA FOR A FIRST-TIME DEPLOYMENT

Follow this in order. Don't skip ahead — each step assumes the previous one is done and verified.

```
STEP 1 — Repo hygiene
  → Verify .env is gitignored (check: git status should never show .env)
  → Commit package-lock.json
  → Push a staging branch

STEP 2 — Order the relay server (Hetzner, Singapore, smallest tier)
  → Note its IP the moment it's issued

STEP 3 — Order the backend server (Hetzner, Singapore, 8GB/4vCPU)
  → Note its IP

STEP 4 — Provision the relay
  → SSH into relay server
  → Run relay_provision.sh <BACKEND_IP>
  → Verify: supervisorctl status shows all 5 forwarders running

STEP 5 — Provision the backend
  → SSH into backend server
  → Run backend_provision.sh <RELAY_IP> <YOUR_ADMIN_IP>
  → Verify: sudo -u postgres psql -c '\l' shows fueltracks DB exists
  → Verify: redis-cli ping returns PONG
  → Move generated DB_PASSWORD from .db_credentials into your real .env

STEP 6 — Deploy code manually (first time, by hand — get this right 
          once before scripting it)
  → SSH into backend as the 'fueltracks' user (not root)
  → git clone your repo
  → Create .env with real values (DB password, JWT secret, etc.)
  → npm ci --production
  → pm2 start ecosystem.config.js --env production
  → pm2 save && pm2 startup   (so it survives a reboot)

STEP 7 — DNS + SSL
  → Point app.fueltracks.in A record at backend's IP
  → Run certbot, verify HTTPS works in a browser

STEP 8 — Firewall — LAST, not first
  → Only enable ufw after confirming SSH access works from your IP
  → ufw enable
  → Immediately re-test SSH in a NEW terminal window before closing 
    your current session — if you get locked out, you still have 
    the current session open to fix it

STEP 9 — Test end-to-end with ONE real device
  → Confirm device connects through relay → reaches backend → data 
    lands in Postgres → shows on live map
  → Only after this works, onboard the rest of the fleet

STEP 10 — Turn on monitoring
  → UptimeRobot on /health
  → Confirm backup cron ran successfully (check log after 24h)
  → Confirm archival cron ran successfully (check log after 24h)

STEP 11 — THEN, only once 1-10 are solid: set up staging + Terraform
  → This is explicitly last. Don't let infra tooling delay getting 
    a working, monitored, backed-up production system live first.
```

**The golden rule for a first deployment:** get it working manually, 
end to end, with real monitoring and real backups — BEFORE adding any 
automation (CI, Terraform, auto-deploy). Automation should make an 
already-working process faster, not be the thing standing between you 
and a working system.
