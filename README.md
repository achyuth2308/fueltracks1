# FuelTracks - Fleet Tracking & Management System

A multi-tenant, high-concurrency GPS tracking platform for B2B logistics, fleet management, and telematics. It features a multi-port TCP ingestion daemon that processes raw telemetry packets from **BSTPL-17**, **AIS140/tNavIC**, **Concox (V5/VL149/GT800)**, **AIS140 V2**, **Volty / VoltyFuel**, and **Teltonika FMB920** GPS devices, normalizes coordinates into standardized decimal degrees, buffers telemetry in Redis, asynchronously writes to a PostgreSQL/TimescaleDB database, and broadcasts real-time WebSocket events to both a React web dashboard and a Flutter mobile app.

---

## 🏗️ System Architecture & Components

FuelTracks consists of four primary components:

1. **TCP Daemon ([tcp-server/server.js](tcp-server/server.js))**: Runs isolated TCP net socket listeners on separate ports side-by-side:
   - **Port 5000**: **BSTPL-17** devices (packets terminated with `#`).
   - **Port 5001**: **AIS140 / tNavIC** devices (packets terminated with `*`).
   - **Port 5002**: **Concox** binary protocol (parses login, heartbeat, alarm buffers and responds with custom ACK packets).
   - **Port 5003**: **AIS140 V2** protocol devices.
   - **Port 5004**: **Volty / VoltyFuel** devices.
   - **Port 5005**: **Teltonika FMB920** devices.
   - **Port 5010**: **BSTPL-17IS** devices.
   Validates device identification (IMEI), pushes telemetry to Redis Pub/Sub channels for decoupling, and writes diagnostic logs into `raw_packets`.

2. **REST API & Real-time Server ([backend/server.js](backend/server.js))**: An Express.js backend (Port 3001) that handles:
   - Multi-tenant authentication & RBAC (Superadmin, Dealer, Customer).
   - Fleet operations (vehicles, devices, organizations, groups, geofences, routes).
   - Analytical reporting (trips, distance, engine runtime, stoppages, speed violations).
   - Multi-channel notification engine (FCM push, WhatsApp Cloud API, Brevo transactional emails).
   - Public B2B Integration API (`/api/v1/*`) with API-key authorization.
   - Document Scanner & Aadhaar Masking module for automated RC/ID onboarding.

3. **WebSockets Publisher**: Managed via Socket.io on the API server, subscribing to Redis channels and piping live vehicle positions, telemetry, and **real-time alert events** directly to active client rooms (`vehicle:<id>` and `org:<org_id>`).

4. **Web Frontend (`frontend/`)**: A Vite-powered React SPA featuring live Leaflet maps, Recharts analytics, Lucide icons, white-label branding, geofence polygon editors, and notification preference controls.

5. **Mobile App (`../mobile-app/`)**: A cross-platform Flutter application (iOS & Android) with Riverpod 2.5, Dio HTTP client, Socket.io real-time map tracking, FlutterMap (OpenStreetMap) & Google Maps rendering, and background Firebase Cloud Messaging (FCM) notifications.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GPS Tracking Hardware                             │
│  BSTPL-17  │  AIS-140  │  Concox V5  │  Volty  │  Teltonika FMB920  │  AIS140 V2 │
└─────┬────────────┬─────────────┬────────────┬──────────────┬──────────────┬─────┘
      │:5000       │:5001        │:5002       │:5004         │:5005         │:5003
      └────────────┴─────────────┼────────────┴──────────────┴──────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   TCP Ingestion Daemon (Multi-Port Listeners)               │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │ Redis Pub/Sub (`locations`, `alerts`)
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Express.js API & Gateway                           │
├─────────────────────┬──────────────────────────┬────────────────────────────┤
│  Socket.io Engine   │    REST & Public API     │     Alert Subscribers      │
│  - vehicle:<id>     │  - /api/auth             │  - DB persistence          │
│  - org:<org_id>     │  - /api/vehicles         │  - FCM Push Dispatcher     │
│  - live telemetry   │  - /api/admin            │  - WhatsApp Cloud API      │
│                     │  - /api/reports          │  - Brevo Email Service     │
│                     │  - /api/v1/public        │                            │
└──────────┬──────────┴──────────────┬───────────┴──────────────┬─────────────┘
           │                         │                          │
           │ WebSockets (Socket.io)  │ HTTP REST                │ FCM Push
           ▼                         ▼                          ▼
┌───────────────────────┐ ┌───────────────────────┐  ┌────────────────────────┐
│  React Web Dashboard  │ │ PostgreSQL + Timescale│  │   Flutter Mobile App   │
│  (Vite SPA - Port 5173)│ │ (Hypertable Partition)│  │   (iOS & Android)      │
└───────────────────────┘ └───────────────────────┘  └────────────────────────┘
```

---

## 📂 Directory Structure

```
FUELTRACKS-SOFTWARE-MOBILEAPP/
├── fueltracks1/                     # Backend, Web Frontend, TCP Daemon & Database
│   ├── backend/                     # Express REST API & Real-time Services
│   │   ├── config/                  # DB pool, Redis, and env validation
│   │   ├── controllers/             # Auth, vehicle, admin, alerts, whatsapp, scanner
│   │   ├── middleware/              # JWT, RBAC authorization, rate limiters, upload guard
│   │   ├── models/                  # SQL queries (gpsModel, vehicleModel, alertModel)
│   │   ├── modules/                 # Profile and reports sub-systems
│   │   ├── routes/                  # API endpoint route declarations
│   │   ├── services/                # FCM push, WhatsApp Cloud API, Brevo email
│   │   └── subscribers/             # Redis channel listeners (locations, alerts)
│   ├── database/                    # PostgreSQL baseline schema, seeds, and migrations
│   │   ├── schema.sql               # Base tables and relational declarations
│   │   ├── seed.sql                 # Sample seed data for development
│   │   └── timescale_migration.sql  # Hypertable, chunking & compression configs
│   ├── frontend/                    # Vite + React Web Application
│   │   ├── src/                     # Components, pages, context, and API clients
│   │   ├── .env                     # Local frontend dev config (VITE_API_URL)
│   │   └── .env.production          # Production frontend config
│   ├── scripts/                     # Simulators, DB migration runners, and smoke tests
│   ├── tcp-server/                  # Multi-port TCP socket ingestion server
│   │   ├── parser/                  # Packet decoders (BSTPL, AIS140, Concox, Volty, FMB920)
│   │   └── server.js                # TCP net server daemon entrypoint
│   ├── ecosystem.config.js          # PM2 production cluster configuration
│   ├── deploy.sh                    # Automated EC2 Ubuntu deployment script
│   ├── .env                         # Backend environment variables
│   └── .env.example                 # Reference environment template
│
└── mobile-app/                      # Cross-Platform Flutter Mobile Application
    ├── lib/                         # Application source code
    │   ├── core/                    # App config, networking, notifications, themes
    │   └── features/                # Live tracking, history, alerts, vehicle details
    ├── assets/                      # Fonts, vehicle icons, and 3D glb models
    ├── .env                         # Mobile runtime environment config
    └── .env.example                 # Reference mobile environment template
```

---

## 🗄️ Database Architecture & TimescaleDB Optimization

The database is built on PostgreSQL with TimescaleDB extensions for high-throughput write scalability:

### Core Hierarchy & Multi-Tenancy
* **`organizations`**: Three-tier multi-tenant hierarchy (`superadmin` → `dealer` → `customer`).
* **`users`**: Platform administrators and fleet owners with bcrypt-hashed credentials and RBAC roles.
* **`groups`**: Segmentation clusters to control user-vehicle access.
* **`vehicles`**: Physical assets with registration numbers, IMEIs, device types, and validity dates.
* **`devices`**: GPS tracking hardware registered to organizations.
* **`vehicle_groups`** / **`user_groups`**: Association tables for access control.

### Telemetry & Hypertable TimescaleDB
* **`gps_points`**: High-frequency telemetry writes (lat, lng, speed, direction, ignition, odometer, fuel, alerts).
  > [!TIP]
  > Configured as a **TimescaleDB Hypertable** partitioned into 7-day chunks. Columnar compression activates on data older than 14 days, and retention policies purge records older than 180 days. Continuous aggregates provide instantaneous hourly and daily rollups.
* **`vehicle_latest_state`**: Single-row-per-vehicle denormalized cache table for sub-millisecond dashboard queries.
* **`alerts`**: Telemetry alerts (overspeed, SOS, geofence in/out, ignition on/off, power disconnection) with read receipts.
* **`raw_packets`**: Raw hex/string packet buffer for hardware troubleshooting (auto-cleaned after 7 days).

### Automated Document Scanner & Compliance
* **`document_scans`**: Uploaded RC books, driving licenses, and Aadhaar cards.
* **`document_scan_extractions`**: Extracted OCR metadata (engine number, chassis, owner name).
* **Aadhaar Privacy**: Stores only masked Aadhaar numbers (`XXXX-XXXX-1234`) and irreversible HMAC-SHA256 salted hashes.

---

## ⚙️ Configuration & Environment Variables

FuelTracks utilizes three dedicated `.env` files across its modules:

### 1. Backend & TCP Server (`fueltracks1/.env`)

Copy `fueltracks1/.env.example` to `fueltracks1/.env`:

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| **`DB_HOST`** | PostgreSQL host | `127.0.0.1` |
| **`DB_PORT`** | PostgreSQL port | `5432` |
| **`DB_NAME`** | Database name | `fueltracks` |
| **`DB_USER`** | PostgreSQL user | `postgres` |
| **`DB_PASS`** | PostgreSQL password | `postgres` |
| **`PG_POOL_MAX`** | Connection pool limit | `20` |
| **`REDIS_HOST`** | Redis host | `127.0.0.1` |
| **`REDIS_PORT`** | Redis port | `6379` |
| **`JWT_SECRET`** | Secret key for signing JWTs (min 32 chars) | *64-byte random hex string* |
| **`JWT_EXPIRES_IN`**| Token validity duration | `24h` |
| **`API_PORT`** | Express REST API & Socket.io port | `3001` |
| **`TCP_PORT`** | BSTPL-17 device port | `5000` |
| **`AIS140_TCP_PORT`**| AIS140 / tNavIC device port | `5001` |
| **`CONCOX_TCP_PORT`**| Concox binary device port | `5002` |
| **`AIS140V2_TCP_PORT`**| AIS140 V2 protocol port | `5003` |
| **`VOLTY_TCP_PORT`** | Volty / VoltyFuel protocol port | `5004` |
| **`FMB920_TCP_PORT`**| Teltonika FMB920 device port | `5005` |
| **`BSTPL17IS_TCP_PORT`**| BSTPL-17IS protocol port | `5010` |
| **`NODE_ENV`** | Execution mode (`development` / `production`) | `development` |
| **`CORS_ORIGIN`** | Permitted CORS origins | `*` *(or specific domain in prod)* |
| **`FRONTEND_URL`** | Web dashboard origin | `http://localhost:5173` |
| **`BREVO_SENDER_EMAIL`** | Transactional email sender address | `info@fueltracks.in` |
| **`BREVO_API_KEY`** | Brevo API key for transactional emails | *(Optional in dev)* |
| **`WHATSAPP_ENABLED`** | Toggle WhatsApp notification pipeline | `false` |
| **`WHATSAPP_ACCESS_TOKEN`** | Meta Cloud API System User token | *(From Meta Developer portal)* |
| **`WHATSAPP_PHONE_NUMBER_ID`** | Meta Sender Phone Number ID | *(From Meta Developer portal)* |
| **`WHATSAPP_WABA_ID`** | WhatsApp Business Account ID | *(From Meta Developer portal)* |
| **`WHATSAPP_APP_SECRET`** | Meta App Secret for signature verification | *(From Meta Developer portal)* |
| **`WHATSAPP_VERIFY_TOKEN`** | Custom webhook handshake verification token | *(Custom secret string)* |
| **`DOCUMENT_SCANNER_ENABLED`** | Enable RC/Aadhaar document scanner API | `false` |
| **`AADHAAR_HMAC_PEPPER`** | Pepper salt for irreversible Aadhaar HMACs | *(Min 32 random characters)* |
| **`FIREBASE_SERVICE_ACCOUNT_JSON`** | Stringified JSON credentials for FCM push | *(Optional in dev)* |

### 2. Frontend Configuration (`fueltracks1/frontend/.env`)
```env
VITE_API_URL=http://localhost:3001
```

### 3. Mobile App Configuration (`mobile-app/.env`)
```env
ENV=development
API_BASE_URL=https://api.fueltracks.in
SOCKET_URL=https://api.fueltracks.in
GOOGLE_MAPS_API_KEY=AIzaSyBUfwgEy51elZbDcxVXIPJ4x8-7_oMUZDk
```

---

## 🚀 Installation & Setup

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **PostgreSQL**: 15+ (with TimescaleDB recommended for production)
- **Redis**: 6.0+
- **Flutter SDK**: 3.24+ (for mobile app)

### 2. Backend & TCP Ingestion Setup
```bash
# Navigate to backend directory
cd fueltracks1

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your PostgreSQL credentials and JWT secret

# Run database migrations
npm run db:migrate
# Or initialize a fresh database with seed data:
# npm run db:init
```

### 3. Web Frontend Setup
```bash
cd fueltracks1/frontend

# Install dependencies
npm install

# Start local Vite development server
npm run dev
```

### 4. Mobile App Setup
```bash
cd mobile-app

# Get Flutter dependencies
flutter pub get

# Run on an emulator or connected device with runtime environment
flutter run --dart-define-from-file=.env
```

---

## 🏃 Running the Servers

From the `fueltracks1` directory:

| Service | Development (Auto-Reload) | Production / Direct |
| :--- | :--- | :--- |
| **REST API Server** (Port 3001) | `npm run dev:api` | `npm run start:api` |
| **TCP Ingestion Daemon** (Ports 5000-5010) | `npm run dev:tcp` | `npm run start:tcp` |
| **React Frontend** (Port 5173) | `npm run start:frontend` | `npm run build:frontend` |
| **System Smoke Test** | `npm run smoke-test` | `npm run smoke-test` |

---

## 🧪 Device Telemetry Simulators

Test GPS packet ingestion locally without physical devices:

```bash
cd fueltracks1

# BSTPL-17 Protocol (Port 5000)
npm run sim:bstpl

# AIS140 / tNavIC Protocol (Port 5001)
npm run sim:ais140

# Concox V5 / GT800 Protocol (Port 5002)
npm run sim:concox

# AIS140 V2 Protocol (Port 5003)
npm run sim:ais140v2

# Volty / VoltyFuel Protocol (Port 5004)
npm run sim:volty

# Teltonika FMB920 Protocol (Port 5005)
npm run sim:fmb920

# Simulate Safety Park Violation Alert
npm run sim:safetypark
```

---

## 🛠️ Production Deployment & Process Management

Deploy on Ubuntu using PM2 process management:

```bash
cd fueltracks1

# Start all processes (API, TCP Ingestion, Daily Cron Jobs)
npm run pm2:start

# Zero-downtime reload
npm run pm2:reload

# Inspect live logs
npm run pm2:logs
```

The [deploy.sh](deploy.sh) script handles:
1. `git pull` of the latest branch commits.
2. `npm install` for backend and frontend.
3. Building frontend production assets (`frontend/dist`).
4. Running pending database migrations (`scripts/runMigrations.js`).
5. Reloading PM2 processes with memory leak guards.
6. Nginx reverse proxy configuration (`api.fueltracks.in` & `app.fueltracks.in`) with automated Let's Encrypt SSL certificates.

---

## 🔔 Alert & Notification Engine

FuelTracks features an integrated alert processing pipeline:

1. **Ingestion**: GPS devices trigger events (overspeed, SOS, geofence transition, ignition change, battery tamper).
2. **Parsing**: The TCP daemon publishes parsed alerts to the Redis `alerts` channel.
3. **Dispatch (`alertSubscriber.js`)**:
   - Persists the alert to PostgreSQL.
   - Broadcasts real-time WebSockets to `org:<org_id>` and `vehicle:<vehicle_id>` rooms.
   - Dispatches FCM push notifications to subscribed devices recorded in `user_fcm_tokens` that match `user_alert_preferences`.
   - Sends transactional WhatsApp and Email notifications for critical alerts.

---

## 🧪 REST API Reference Summary

### 🔐 Authentication (`/api/auth`)
* `POST /api/auth/login` — Sign in; returns JWT token and user profile.
* `POST /api/auth/logout` — Invalidate session.
* `GET /api/auth/me` — Retrieve active profile.
* `POST /api/auth/forgot-password` — Request password reset email.
* `POST /api/auth/reset-password` — Reset password with token.

### 🚚 Fleet & Vehicle Operations (`/api/vehicles`)
* `GET /api/vehicles` — Vehicle directory with live coordinates, ignition, and connectivity status.
* `GET /api/vehicles/:id` — Single vehicle specification.
* `POST /api/vehicles` — Register a vehicle with 15-digit IMEI.
* `PUT /api/vehicles/:id` — Update vehicle attributes.
* `DELETE /api/vehicles/:id` — Remove vehicle.
* `POST /api/vehicles/:id/migrate` — Migrate asset to another organization.
* `GET /api/vehicles/:id/history` — Historical telemetry replay logs.
* `GET /api/vehicles/:id/route` — Interpolated GPS path points.
* `GET /api/vehicles/:id/report` — Analytics (distance, max speed, idle time).
* `GET /api/vehicles/:id/alerts` — Vehicle-specific alert history.

### 🏢 Tenant & Fleet Administration (`/api/admin`)
* `GET / POST / PUT / DELETE /api/admin/orgs` — Tenant hierarchy CRUD.
* `GET / POST / PUT / DELETE /api/admin/users` — User administration.
* `GET / POST / PUT / DELETE /api/admin/groups` — Device segmentation groups.
* `GET /api/admin/devices` — Tracking hardware inventory.
* `POST /api/admin/onboard/devices` — Batch device and vehicle onboarding.
* `GET /api/admin/billing/expired` — Expired license tracking.
* `PATCH /api/admin/orgs/:id/device-limits` — Manage subscription vehicle quotas.

### 🗺️ Geofencing & Corridor Monitoring (`/api/admin`)
* `GET / POST / PUT / DELETE /api/admin/geofences` — Polygon and Circular geofence zones.
* `POST /api/admin/geofences/:id/assign` — Assign geofence boundaries to vehicles.
* `GET / POST / PUT / DELETE /api/admin/routes` — Defined route corridors with deviation tolerance.
* `POST /api/admin/routes/:id/assign` — Assign route corridors to assets.

### 🔔 Alerts & Preferences (`/api/alerts`)
* `GET /api/alerts` — Paginated organization alert history.
* `PUT /api/alerts/:id/read` — Mark an alert as acknowledged.
* `PUT /api/alerts/read-all` — Mark all alerts as read.
* `GET / PUT /api/alerts/preferences` — Get/update per-user push notification filter toggles.
* `POST /api/alerts/fcm-token` — Register device FCM token for push notifications.
* `DELETE /api/alerts/fcm-token` — Unregister device FCM token on logout.

### 📊 Fleet Analytics & Reports (`/api/reports`)
* `GET /api/reports/trip` — Start/end locations, distance, and duration.
* `GET /api/reports/distance` — Daily odometer summary per vehicle.
* `GET /api/reports/activity` — Ignition run vs idle duration breakdown.
* `GET /api/reports/stoppages` — Parking and stoppage durations with locations.
* `GET /api/reports/overspeeding` — Speed threshold violations.
* `GET /api/reports/consolidated` — Fleet-wide aggregate metrics.
* `GET /api/reports/dashboard` — Live count cards and fleet status summary.

### 💬 WhatsApp Cloud API Integration (`/api/whatsapp`)
* `GET /api/whatsapp/webhook` — Meta Webhook challenge verification.
* `POST /api/whatsapp/webhook` — Incoming status updates and message events.
* `GET / POST /api/whatsapp/recipients` — Manage alert notification phone recipients.
* `GET / PUT /api/whatsapp/settings` — Configure automated daily summary schedules.
* `GET /api/whatsapp/messages` — WhatsApp outbox logs with delivery receipts.
* `POST /api/whatsapp/messages/:id/retry` — Manual outbox message retry.

### 📄 Document Scanner & RC Onboarding (`/api/v1/document-scans`)
* `POST /api/v1/document-scans` — Upload RC/Aadhaar document for OCR extraction.
* `GET /api/v1/document-scans/:id` — Poll processing status and extracted vehicle data.
* `GET /api/v1/document-scans/:id/vehicle-matches` — Inspect candidate match vehicles in the fleet.
* `POST /api/v1/document-scans/:id/confirm` — Confirm and merge extracted metadata into vehicle profile.

### 🔌 Third-Party Integration API (`/api/v1`)
Authorized via `X-API-Key` header:
* `GET /api/v1/vehicles` — Vehicle list for integrated external ERP/TMS systems.
* `GET /api/v1/location/live` — Instantaneous location snapshot.
* `POST /api/v1/location/history` — Historical vehicle trajectory for third-party systems.
* `POST / GET / DELETE /api/v1/webhooks` — Webhook event subscription management.
