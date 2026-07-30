# FuelTracks - Fleet Tracking & Management System

A multi-tenant, high-concurrency GPS tracking platform for B2B logistics and fleet management. It features a multi-port TCP daemon that ingests raw telemetry packets from **BSTPL-17**, **AIS140/tNavIC**, and **Concox (V5/VL149/GT800)** GPS devices, parses GPS coordinates (converting DDM and decimal formats to standardized decimal degrees), buffers records in Redis, and asynchronously writes to a PostgreSQL database (optimized with TimescaleDB) and publishes real-time WebSocket events.

---

## 🏗️ System Architecture & Components

FuelTracks consists of four primary components:
1. **TCP Daemon ([tcp-server/server.js](tcp-server/server.js))**: Runs isolated net socket listeners on separate ports side-by-side:
   - **Port 5000** for **BSTPL-17** devices (terminated with `#`).
   - **Port 5001** for **AIS140 / tNavIC** devices (terminated with `*`).
   - **Port 5002** for **Concox** devices (binary protocol, parses login/heartbeat/alarm buffers and responds with custom ACK packets).
   It parses raw data, validates IMEI identification, pushes to Redis Pub/Sub channels for decoupling, and writes diagnostic logs into `raw_packets`.
2. **REST API Server ([backend/server.js](backend/server.js))**: An Express.js backend (Port 3001) that handles multi-tenant authentication, RBAC administration (Superadmins, Dealers, Customers), CRUD of vehicles, devices, organizations, groups, custom reporting logs, geofences, billing, audits, and the new **alert notification system**.
3. **WebSockets Publisher**: Managed via Socket.io inside the Express server, subscribing to Redis channels and piping live vehicle positions, telemetry, and **real-time alert events** directly to active client rooms (`vehicle:<id>` and `org:<org_id>`).
4. **Web Frontend (`frontend/`)**: A Vite-powered React single page application (SPA) with styled dashboards using Leaflet maps, Recharts analytics, Lucide icons, and a new **Alert History & Notification Preferences** page.

```
┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│ BSTPL-17 GPS Device  │   │  AIS140 GPS Device   │   │  Concox GPS Device   │
└──────────┬───────────┘   └──────────┬───────────┘   └──────────┬───────────┘
           │                          │                          │
           │ TCP (Port 5000)          │ TCP (Port 5001)          │ TCP (Port 5002)
           └───────────┬──────────────┴──────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────┐
│     TCP Daemon (Tri-protocol listeners)         │
└──────────────────────┬──────────────────────────┘
                       │
                       │ Redis Pub/Sub (locations + alerts)
                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│                              API Server                                │
├──────────────┬───────────────────────────────────┬─────────────────────┤
│  Socket.io   │          REST API                 │  Alert Subscriber   │
│  Real-time   │  /api/auth  /api/vehicles         │  → DB save          │
│  events      │  /api/admin /api/alerts           │  → Socket.io emit   │
│              │  /api/reports /api/profile        │  → FCM push (Firebase)│
└──────┬───────┴────────────────────┬──────────────┴─────────────────────┘
       │                            │
       │ WebSockets                 │ HTTP REST + FCM Push
       ▼                            ▼
┌──────────────────┐   ┌────────────────────┐   ┌──────────────────────┐
│  React Frontend  │   │  PostgreSQL 15+    │   │  Flutter Mobile App  │
│  (Web Dashboard) │   │  (TimescaleDB)     │   │  (FCM Push Notifs)   │
└──────────────────┘   └────────────────────┘   └──────────────────────┘
```

---

## 📂 Directory Structure

```
fueltracks/
├── backend/              # Express REST API, controllers, and socket managers
│   ├── config/           # DB, env, and Redis configurations
│   ├── controllers/      # Route controllers (auth, vehicle, onboarding, admin, alerts, etc.)
│   ├── middleware/        # JWT auth, RBAC authorization, rate limiters
│   ├── models/           # DB access queries (gpsModel, vehicleModel, etc.)
│   ├── modules/          # Encapsulated sub-systems (profile, reports)
│   ├── routes/           # Router registrations (auth, vehicle, admin, alerts, etc.)
│   ├── services/         # External service integrations (email, FCM push notifications)
│   │   └── fcmService.js # Firebase Cloud Messaging push notification dispatcher
│   └── subscribers/      # Redis channel subscribers (location, alerts + FCM dispatch)
├── database/             # Postgres initial schema, seeds, and SQL migrations
│   ├── schema.sql        # Full base database tables declaration
│   ├── seed.sql          # Sample seed data for local development
│   └── *.sql             # Standalone migration files (devices, audit, geofence, etc.)
├── frontend/             # Vite + React web application
│   ├── src/
│   │   ├── api/          # Axios API clients (vehicleApi, alertsApi, adminApi, etc.)
│   │   ├── pages/
│   │   │   ├── user/     # Customer-facing pages (Dashboard, Tracking, Alerts, etc.)
│   │   │   └── admin/    # Admin pages (Vehicles, Orgs, Users, Geofences, etc.)
│   │   └── components/   # Shared UI components (Sidebar, Topbar, Modals, etc.)
│   └── public/           # Static asset files
├── scripts/              # Command-line tools (init, simulator, migration runner)
├── tcp-server/           # TCP net socket daemon
│   ├── parser/           # Telemetry packet parsers (BSTPL, AIS140, Concox, Alerts)
│   └── server.js         # Tri-port TCP listeners and client socket managers
├── ecosystem.config.js   # PM2 configuration for production process management
├── deploy.sh             # EC2 deployment automation script
└── .env.example          # Sample environment configuration template
```

---

## 🗄️ Database Schema & TimescaleDB Optimization

The system operates on **19 relational tables** with cascades, indices, and auto-updating triggers:

### Core Hierarchy & Fleet
* **`organizations`**: Tenants configured in a three-tier tree structure (`super` → `dealer` → `customer`).
* **`users`**: Platform administrators and customers. Stores encrypted credentials, username, and reset tokens.
* **`groups`**: Logical clusters created by Dealers to partition user-vehicle access.
* **`vehicles`**: Physical assets equipped with GPS modules. Tied to an IMEI, licence expiration date, and optional metadata.
* **`devices`**: Registered tracking hardware models linked to organizational nodes.
* **`vehicle_groups`** / **`user_groups`**: Many-to-many relationship mappings.

### Geofences & Routes
* **`geofences`**: Geographical zones defined as circles (latitude/longitude/radius) or polygons (JSON coordinates).
* **`routes`**: Predefined path paths with a tolerance radius (meters) to monitor path deviations.
* **`vehicle_geofences`** / **`vehicle_routes`**: Relationship mappings for geofence/route assignments.

### Telemetry & Diagnostics (TimescaleDB Optimized)
* **`gps_points`**: High-frequency telemetry writes (lat, lng, speed, direction, odometer, ignition, fuel, alerts).
  > [!TIP]
  > In production, this table is a **TimescaleDB Hypertable** partitioned into 7-day chunks. Columnar compression applies to chunks older than 14 days, and a retention policy drops telemetry older than 180 days. Continuous aggregates (`gps_points_hourly` and `gps_points_daily`) accelerate analytical queries.
* **`vehicle_latest_state`**: A denormalized, single-row-per-vehicle table for fast dashboard reads.
* **`alerts`**: Telemetry warning events with type, location, timestamp, and `is_read` status.
* **`raw_packets`**: Debugging logs of unparsed TCP streams and parsed JSON payloads (auto-cleaned after 7 days).
* **`audit_logs`**: Audit trail of all organization, vehicle, and configuration changes.
* **`organization_profiles`**: White-label configuration (logos, favicons, map settings, notification channels).

### Alert Notification System (New)
* **`user_alert_preferences`**: Per-user JSONB toggles controlling which alert types (overspeed, geofence, ignition, SOS, etc.) are active for push notifications.
* **`user_fcm_tokens`**: Per-device FCM tokens for Firebase push notifications. Supports multiple devices per user.

---

## ⚙️ Configuration & Environment Variables

Create a `.env` file in the root directory. Copy properties from `.env.example`:

| Variable | Description | Default Value |
| :--- | :--- | :--- |
| `DB_HOST` | PostgreSQL Database Server Host | `127.0.0.1` |
| `DB_PORT` | PostgreSQL Database Connection Port | `5432` |
| `DB_NAME` | PostgreSQL Database Name | `fueltracks` |
| `DB_USER` | PostgreSQL Username | `postgres` |
| `DB_PASS` | PostgreSQL Password | `postgres` |
| `PG_POOL_MAX` | Max database connections in the PG pool | `20` |
| `REDIS_HOST` | Redis Server Host | `127.0.0.1` |
| `REDIS_PORT` | Redis Server Port | `6379` |
| `JWT_SECRET` | Cryptographic key for signing JSON Web Tokens | *Required in Prod (min 32 chars)* |
| `JWT_EXPIRES_IN` | Token expiration timeline | `24h` |
| `TCP_PORT` | Port for accepting BSTPL-17 device streams | `5000` |
| `AIS140_TCP_PORT` | Port for accepting AIS140 device streams | `5001` |
| `CONCOX_TCP_PORT` | Port for accepting Concox binary streams | `5002` |
| `API_PORT` | Port for REST API and WebSockets | `3001` |
| `NODE_ENV` | Application mode (`development` / `production`) | `development` |
| `CORS_ORIGIN` | Allowed CORS domain endpoints (comma separated) | `*` |
| `BREVO_SENDER_EMAIL` | Sender email address for transaction emails | `info@fueltracks.in` |
| `BREVO_API_KEY` | API key for Brevo Email Service | *(Optional in Dev)* |
| `FRONTEND_URL` | Base URL of React Frontend application | `http://localhost:5173` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase Admin SDK service account JSON (stringified) for FCM push notifications | *(Optional — FCM disabled if not set)* |

> [!IMPORTANT]
> `FIREBASE_SERVICE_ACCOUNT_JSON` must be the **entire contents** of your Firebase service account JSON file, minified to a single line. The server auto-initializes Firebase Admin SDK on first use and gracefully skips FCM dispatch if this variable is absent.

---

## 🚀 Installation & Setup

### 1. Prerequisites
Ensure you have **Node.js (v18+)**, **PostgreSQL (15+)** with the TimescaleDB extension (`sudo apt install timescaledb-2-postgresql-15`), and **Redis** active.

### 2. Node Modules Setup
Run from the root directory to install all dependencies:
```bash
npm install
```

To install frontend dependencies:
```bash
npm --prefix frontend install
```

### 3. Database Setup

#### Option A: Fresh Database Installation (Destructive)
```bash
npm run db:init
```

#### Option B: Run Outstanding Migrations (Safe)
```bash
npm run db:migrate
```

#### Option C: TimescaleDB Initialization (Production)
```bash
npm run db:timescale
# Or: sudo -u postgres psql -d fueltracks -f database/timescale_migration.sql
```

> [!NOTE]
> The new `user_alert_preferences`, `user_fcm_tokens` tables and the `alerts.is_read` column are **auto-created on server boot** via `IF NOT EXISTS` migrations — no manual SQL needed.

---

## 🏃 Running the Application

* **Start REST API Backend (Port 3001)**:
  ```bash
  npm run start:api
  ```
  *(Dev hot-reload: `npm run dev:api`)*

* **Start TCP Socket Receiver (Ports 5000, 5001, 5002)**:
  ```bash
  npm run start:tcp
  ```
  *(Dev hot-reload: `npm run dev:tcp`)*

* **Start React Web Frontend (Port 5173)**:
  ```bash
  npm run start:frontend
  ```

* **Run System Smoke Test**:
  ```bash
  npm run smoke-test
  ```

---

## 🧪 Device Telemetry Simulator

* **Simulate BSTPL-17 (Port 5000)**:
  ```bash
  npm run sim:bstpl
  ```

* **Simulate AIS140 / tNavIC (Port 5001)**:
  ```bash
  npm run sim:ais140
  ```

* **Simulate Concox V5 / GT800 (Port 5002)**:
  ```bash
  npm run sim:concox
  ```

---

## 🛠️ Production Deployment & Process Management

### Process Management (PM2)
```bash
# Start backend API & TCP server instances
npm run pm2:start

# Reload services with zero-downtime
npm run pm2:reload

# Inspect output logs
npm run pm2:logs
```

### Deployment Script
[deploy.sh](deploy.sh) is configured for Ubuntu (AWS EC2):
1. Pulls latest code from Git.
2. Runs `npm install` (picks up new dependencies like `firebase-admin`).
3. Builds frontend production bundle.
4. Restarts PM2 processes.
5. Runs DB migrations and TimescaleDB alignments.
6. Configures Nginx reverse proxies:
   - `api.fueltracks.in` → Port 3001 (WebSockets upgrade enabled).
   - `app.fueltracks.in` → `frontend/dist` static build.
7. Auto-provisions SSL via Certbot (Let's Encrypt).

---

## 🔔 Alert & Notification System

FuelTracks includes a fully integrated alert and push notification system:

### How It Works
1. GPS device triggers an event (overspeed, SOS, geofence entry, ignition, etc.).
2. TCP daemon parses the packet and publishes to the Redis `alerts` channel.
3. `alertSubscriber.js` consumes the event and:
   - Saves the alert to the `alerts` table.
   - Dispatches Email/WhatsApp notifications via the org's notification profile.
   - Emits `alert:new` via Socket.io to `vehicle:<id>` and `org:<orgId>` rooms (real-time web feed).
   - Queries `user_fcm_tokens` to find devices of org users who have that alert type **enabled** in `user_alert_preferences`, then calls Firebase FCM to deliver push notifications to the Flutter mobile app.

### User-Facing Features (Web)
- **Alert History tab**: Paginated, filterable list of all org alerts with unread/read status. Mark individual or all alerts as read.
- **Notification Settings tab**: Per-user toggle switches grouped by Critical / Warning / Info to control which alert types trigger push notifications.
- **Live Feed tab**: Real-time Socket.io stream of incoming alerts for the session, with a connection status indicator.
- **Toast popups**: Non-intrusive alert toasts appear across all pages when a new alert fires.

### API Endpoints (`/api/alerts`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/alerts` | Paginated alerts for the user's org. Supports `?page`, `?limit`, `?alertType` |
| `PUT` | `/api/alerts/:id/read` | Mark a single alert as read |
| `PUT` | `/api/alerts/read-all` | Mark all org alerts as read |
| `GET` | `/api/alerts/preferences` | Get the calling user's notification preference toggles |
| `PUT` | `/api/alerts/preferences` | Update notification preference toggles |
| `POST` | `/api/alerts/fcm-token` | Register an FCM device token (called by Flutter app on login) |
| `DELETE` | `/api/alerts/fcm-token` | Remove an FCM token (called on logout) |

---

## 🧪 REST API Endpoints

### 🔐 Authentication
* **POST** `/api/auth/login` — Login. Returns JWT Token + profile.
* **POST** `/api/auth/logout` — Logout active session.
* **GET** `/api/auth/me` — Retrieve active user session.
* **POST** `/api/auth/forgot-password` — Request a password reset token.
* **POST** `/api/auth/reset-password` — Reset password using token.

### 🚚 Vehicles & Fleet
* **GET** `/api/vehicles` — List vehicles with live positions and connectivity states.
* **GET** `/api/vehicles/:id` — Single vehicle details.
* **POST** `/api/vehicles` — Register a vehicle (unique 15-digit IMEI required).
* **PUT** `/api/vehicles/:id` — Update vehicle details.
* **DELETE** `/api/vehicles/:id` — Delete vehicle.
* **POST** `/api/vehicles/:id/migrate` — Migrate vehicle to another org.
* **GET** `/api/vehicles/:id/history` — Historical GPS logs (`startDate`, `endDate`, `page`, `limit`).
* **GET** `/api/vehicles/:id/route` — GPS path series for route drawing.
* **GET** `/api/vehicles/:id/report` — Fleet analytics (distance, speed, engine runtime).
* **GET** `/api/vehicles/:id/alerts` — Recent telemetry alert logs.
* **GET** `/api/vehicles/:id/messages` — Raw diagnostic packet logs.

### 🏢 Tenant & Admin Operations (`/api/admin/*`)
* **GET / POST / PUT / DELETE** `/api/admin/orgs` — Organizations (tenant tree).
* **GET / POST / PUT / DELETE** `/api/admin/users` — Platform users.
* **GET / POST / PUT / DELETE** `/api/admin/groups` — Device segmentation groups.
* **GET** `/api/admin/devices` — Registered tracking devices.
* **POST** `/api/admin/onboard/devices` — Mass IMEI onboarding.
* **GET** `/api/admin/billing/expired` — Out-of-licence vehicles.
* **PATCH** `/api/admin/orgs/:id/device-limits` — Subscription thresholds.
* **GET / POST / PUT / DELETE** `/api/admin/renewal-plans` — Payment plans.
* **GET** `/api/admin/renewal-transactions` — Payment records.

### 🗺️ Geofencing & Route Boundaries (`/api/admin/*`)
* **GET / POST / PUT / DELETE** `/api/admin/geofences` — CRUD Geofences (Polygon / Circle).
* **POST** `/api/admin/geofences/:id/assign` — Assign geofence to vehicles.
* **GET / POST / PUT / DELETE** `/api/admin/routes` — CRUD route paths.
* **POST** `/api/admin/routes/:id/assign` — Assign route corridor to vehicles.

### 🔔 Alerts & Notifications (`/api/alerts/*`)
* **GET** `/api/alerts` — Paginated alert history for the user's org.
* **PUT** `/api/alerts/:id/read` — Mark single alert as read.
* **PUT** `/api/alerts/read-all` — Mark all alerts as read.
* **GET** `/api/alerts/preferences` — Get user notification preferences.
* **PUT** `/api/alerts/preferences` — Update notification preferences.
* **POST** `/api/alerts/fcm-token` — Register FCM device token.
* **DELETE** `/api/alerts/fcm-token` — Remove FCM device token.

### 📊 Reports (`/api/reports/*`)
* **GET** `/api/reports/trip` — Trip summaries.
* **GET** `/api/reports/distance` — Daily distance metrics.
* **GET** `/api/reports/activity` — Engine run duration and states.
* **GET** `/api/reports/route-history` — Historical path trace.
* **GET** `/api/reports/ignition` — Ignition status intervals.
* **GET** `/api/reports/overspeeding` — Speed limit violations.
* **GET** `/api/reports/stoppages` — Stoppage duration logs.
* **GET** `/api/reports/consolidated` — Multi-vehicle aggregated report.
* **GET** `/api/reports/individual` — High-resolution single-asset stats.
* **GET** `/api/reports/dashboard` — Live counts and KPIs.

### ⚙️ Organization Settings & White-Labeling (`/api/profile/*`)
* **GET** `/api/profile` — Fetch white-label theme, logos, and org profile.
* **PUT** `/api/profile` — Update white-label settings.
* **POST** `/api/profile/logo` — Upload organization logo.
* **POST** `/api/profile/favicon` — Upload custom tab icon.
* **POST** `/api/profile/background` — Upload branded auth background.
* **POST** `/api/profile/change-password` — Update user password.
* **GET** `/api/profile/audit` — User modification audit trail.
