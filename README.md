# FuelTracks - Fleet Tracking & Management System

A multi-tenant, high-concurrency GPS tracking platform for B2B logistics and fleet management. It features a multi-port TCP daemon that ingests raw telemetry packets from **BSTPL-17**, **AIS140/tNavIC**, and **Concox (V5/VL149/GT800)** GPS devices, parses GPS coordinates (converting DDM and decimal formats to standardized decimal degrees), buffers records in Redis, and asynchronously writes to a PostgreSQL database (optimized with TimescaleDB) and publishes real-time WebSocket events.

---

## 🏗️ System Architecture & Components

FuelTracks consists of four primary components:
1. **TCP Daemon ([tcp-server/server.js](file:///c:/Users/madhu/OneDrive/Desktop/fueltracks1/tcp-server/server.js))**: Runs isolated net socket listeners on separate ports side-by-side:
   - **Port 5000** for **BSTPL-17** devices (terminated with `#`).
   - **Port 5001** for **AIS140 / tNavIC** devices (terminated with `*`).
   - **Port 5002** for **Concox** devices (binary protocol, parses login/heartbeat/alarm buffers and responds with custom ACK packets).
   It parses raw data, validates IMEI identification, pushes to Redis Pub/Sub channels for decoupling, and writes diagnostic logs into `raw_packets`.
2. **REST API Server ([backend/server.js](file:///c:/Users/madhu/OneDrive/Desktop/fueltracks1/backend/server.js))**: An Express.js backend (Port 3001) that handles multi-tenant authentication, RBAC administration (Superadmins, Dealers, Customers), CRUD of vehicles, devices, organizations, groups, custom reporting logs, geofences, billing, and audits.
3. **WebSockets Publisher**: Managed via Socket.io inside the Express server, subscribing to Redis channels and piping live vehicle positions and telemetry details directly to active client rooms (`vehicle:<id>` and `org:<org_id>`).
4. **Web Frontend (`frontend/`)**: A Vite-powered React single page application (SPA) with styled dashboards using Framer Motion, Leaflet maps, Recharts analytics, and Lucide icons.

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
                       │ Redis Pub/Sub
                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│                              API Server                                │
├───────────────────────────────────┬────────────────────────────────────┤
│           Socket.io               │             REST API               │
└─────────────────┬─────────────────┴──────────────────┬─────────────────┘
                   │                                    │
                   │ WebSockets (Port 3001)             │ HTTP REST
                   ▼                                    ▼
┌───────────────────────────────────┐        ┌───────────────────────────┐
│          React Frontend           │        │      PostgreSQL 15+       │
└───────────────────────────────────┘        │      (TimescaleDB)        │
                                             └───────────────────────────┘
```

---

## 📂 Directory Structure

```
fueltracks/
├── backend/              # Express REST API, controllers, and socket managers
│   ├── config/           # DB, env, and Redis configurations
│   ├── controllers/      # Route controllers (auth, vehicle, onboarding, admin, etc.)
│   ├── middleware/       # JWT auth, RBAC authorization, rate limiters, validations
│   ├── models/           # DB access queries (PG query helpers)
│   ├── modules/          # Encapsulated sub-systems (profile, reports)
│   └── routes/           # Router registrations
├── database/             # Postgres initial schema, seeds, and SQL migrations
│   ├── schema.sql        # Full base database tables declaration
│   ├── seed.sql          # Sample seed data for local development
│   ├── devices_migration.sql                 # Standalone devices migration
│   ├── audit_migration.sql                   # Standalone audit log migration
│   ├── profile_migration.sql                 # Standalone organization profiles migration
│   ├── geofence_route_migration.sql          # Geofences and routes tables schema
│   ├── timescale_migration.sql               # TimescaleDB hypertable & compression config
│   ├── forgot_password_migration.sql         # Auth reset token columns
│   ├── raw_packets_enhancement_migration.sql # Diagnostic packets schema updates
│   └── raw_packets_maintenance_migration.sql # Autocleanup & optimization indexes
├── frontend/             # Vite + React web application
│   ├── src/              # Page layouts, dashboard components, maps, hooks
│   └── public/           # Static asset files
├── scripts/              # Command-line tools (init, simulator, migration runner)
│   ├── dbInit.js                 # Base schema and seed initialization helper
│   ├── runMigrations.js          # SEQUENTIAL database migration executor
│   ├── apply_geofence_migration.js # Manual geofence schema setup runner
│   ├── seed_geofence_route.js     # Seeds mock geofences & routes for test
│   ├── change-default-passwords.js# Security utility to enforce new admin credentials
│   ├── deviceSimulator.js        # Multi-protocol telemetry load generator
│   ├── cleanupRawPackets.js      # Truncates old raw logs beyond retention
│   └── smoke-test.js             # Automated endpoint and system sanity tester
├── tcp-server/           # TCP net socket daemon
│   ├── parser/           # Telemetry packet parsers (BSTPL, AIS140, Concox binary, Alerts)
│   │   ├── ais140Parser.js
│   │   ├── alertParser.js
│   │   ├── concoxCrc.js
│   │   ├── concoxParser.js
│   │   └── normalParser.js
│   ├── utils/            # Packet verification helpers
│   ├── publisher.js      # Redis channel publisher
│   └── server.js         # Tri-port TCP listeners and client socket managers
├── ecosystem.config.js   # PM2 configuration for production process management
├── deploy.sh             # EC2 deployment automation script
└── .env.example          # Sample environment configuration template
```

---

## 🗄️ Database Schema & TimescaleDB Optimization

The system operates on **17 relational tables** with cascades, indices, and auto-updating triggers:

### Core Hierarchy & Fleet
* **`organizations`**: Tenants configured in a three-tier tree structure (`super` → `dealer` → `customer`).
* **`users`**: Platform administrators and customers. Stores encrypted credentials, username, and reset tokens.
* **`groups`**: Logical clusters created by Dealers to partition user-vehicle access.
* **`vehicles`**: Physical assets equipped with GPS modules. Tied to an IMEI, licence expiration date, and optional metadata (`odoDistance`, `licenceNo`, etc.).
* **`devices`**: Registered tracking hardware models linked to organizational nodes.
* **`vehicle_groups`** / **`user_groups`**: Many-to-many relationship mapping linking vehicles and users to groups.

### Geofences & Routes
* **`geofences`**: Geographical zones defined as circles (latitude/longitude/radius) or polygons (JSON list of coordinates).
* **`routes`**: Predefined path paths with a tolerance radius (meters) to monitor path deviations.
* **`vehicle_geofences`** / **`vehicle_routes`**: Relationship mappings tracking assignment of geofences and routes to specific vehicles.

### Telemetry & Diagnostics (TimescaleDB Optimized)
* **`gps_points`**: High-frequency writes containing telemetry (latitude, longitude, speed, direction, odometer, ignition status, fuel level, alerts). 
  > [!TIP]
  > In production, this table is converted to a **TimescaleDB Hypertable** partitioned into 7-day chunks. Columnar compression is applied to chunks older than 14 days, and a retention policy automatically drops telemetry older than 180 days. Continuous aggregates (`gps_points_hourly` and `gps_points_daily`) are enabled to accelerate analytical queries.
* **`vehicle_latest_state`**: A denormalized, single-row-per-vehicle table optimized for fast dashboard read updates.
* **`alerts`**: Telemetry warning logs (e.g., ignition status, battery low, geofence enter/exit, speed thresholds).
* **`raw_packets`**: Debugging logs that store unparsed TCP streams, packet type, and parsed JSON payload for diagnostic reviews (capped by a 7-day auto-cleanup script).
* **`audit_logs`**: System auditing that keeps audit trails of organization, vehicle, and configuration updates.
* **`organization_profiles`**: White-label configuration including brand logos, favicons, custom mapping providers, default map scopes, and SMS/Email notification configurations.

---

## ⚙️ Configuration & Environment Variables

Create a `.env` file in the root directory. Copy the properties from `.env.example`:

| Variable | Description | Default Value |
| :--- | :--- | :--- |
| `DB_HOST` | PostgreSQL Database Server Host | `127.0.0.1` |
| `DB_PORT` | PostgreSQL Database Connection Port | `5432` |
| `DB_NAME` | PostgreSQL Database Name | `fueltracks` |
| `DB_USER` | PostgreSQL Username | `postgres` |
| `DB_PASS` | PostgreSQL Password | `postgres` |
| `PG_POOL_MAX` | Max database connections in the PG pool | `20` |
| `REDIS_HOST`| Redis Server Host | `127.0.0.1` |
| `REDIS_PORT`| Redis Server Port | `6379` |
| `JWT_SECRET`| Cryptographic key for signing JSON Web Tokens | *Required in Prod (min 32 chars)* |
| `JWT_EXPIRES_IN`| Token expiration timeline | `24h` |
| `TCP_PORT`  | Port for accepting BSTPL-17 device streams | `5000` |
| `AIS140_TCP_PORT` | Port for accepting AIS140 device streams | `5001` |
| `CONCOX_TCP_PORT` | Port for accepting Concox binary streams | `5002` |
| `API_PORT`  | Port for REST API and WebSockets | `3001` |
| `NODE_ENV`  | Application mode (`development` / `production`)| `development` |
| `CORS_ORIGIN`| Allowed CORS domain endpoints (comma separated)| `*` |
| `BREVO_SENDER_EMAIL`| Sender email address for transaction emails | `info@fueltracks.in` |
| `BREVO_API_KEY`| API key for Brevo Email Service | *(Optional in Dev)* |
| `FRONTEND_URL`| Base URL of React Frontend application | `http://localhost:5173` |

---

## 🚀 Installation & Setup

### 1. Prerequisites
Ensure you have **Node.js (v18+)**, **PostgreSQL (15+)** with the TimescaleDB extension installed (`sudo apt install timescaledb-2-postgresql-15`), and **Redis** (or Memurai on Windows) active.

### 2. Node Modules Setup
Run from the root directory to install dependencies for the backend and TCP server:
```bash
npm install
```

To install frontend dependencies, execute:
```bash
npm --prefix frontend install
```

### 3. Database Setup

#### Option A: Fresh Database Installation (Destructive)
To clean, drop existing tables, and seed fresh records:
```bash
npm run db:init
```

#### Option B: Run Outstanding Database Migrations (Safe)
To update an existing database structure cleanly with added migrations (`devices`, `audit_logs`, `organization_profiles`, `geofences`, and `routes`) without deleting existing records:
```bash
npm run db:migrate
```

#### Option C: TimescaleDB Initialization (Production)
Run the script helper or execute directly on the postgres client:
```bash
npm run db:timescale
# Or execute manually:
# sudo -u postgres psql -d fueltracks -f database/timescale_migration.sql
```

---

## 🏃 Running the Application

Launch the systems using the package scripts:

* **Start REST API Backend (Port 3001)**:
  ```bash
  npm run start:api
  ```
  *(For hot-reload developer mode: `npm run dev:api`)*

* **Start TCP Socket Receiver (Ports 5000, 5001, 5002)**:
  ```bash
  npm run start:tcp
  ```
  *(For hot-reload developer mode: `npm run dev:tcp`)*

* **Start React Web Frontend (Port 5173)**:
  ```bash
  npm run start:frontend
  ```

* **Run Fleet System Smoke Test**:
  ```bash
  npm run smoke-test
  ```

* **Enforce Security Passwords**:
  ```bash
  npm run change-passwords
  ```

---

## 🧪 Device Telemetry Simulator
To test telemetry ingestion, use the simulators to send simulated location and alert packets to the socket servers:

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
The application leverages [ecosystem.config.js](file:///c:/Users/madhu/OneDrive/Desktop/fueltracks1/ecosystem.config.js) to manage, scale, and monitor background processes:
```bash
# Start backend API & TCP server instances
npm run pm2:start

# Reload services with zero-downtime
npm run pm2:reload

# Inspect output logs
npm run pm2:logs
```

### Deployment Script
[deploy.sh](file:///c:/Users/madhu/OneDrive/Desktop/fueltracks1/deploy.sh) is configured for Ubuntu environment hosting:
1. Pulls latest code from Git.
2. Performs Node modules installation and Frontend production build (`npm run build:frontend`).
3. Boosts OS system limits (`LimitNOFILE=65535`) to handle up to 15k high-concurrency socket limits.
4. Restarts PM2 processes.
5. Performs DB migrations and TimescaleDB alignments.
6. Installs and provisions Nginx configuration acting as reverse proxies:
   - `api.fueltracks.in` forwarding traffic to Port 3001 (WebSockets upgrade support enabled).
   - `app.fueltracks.in` hosting static build targets (`frontend/dist`).
7. Auto-provisions SSL credentials using Certbot (Let's Encrypt).

---

## 🧪 REST API Endpoints

### 🔐 Authentication
* **POST** `/api/auth/login` — Login endpoint. Returns JWT Token + Profile node.
* **POST** `/api/auth/logout` — Logout active session.
* **GET** `/api/auth/me` — Retrieve active user session profile details.
* **POST** `/api/auth/forgot-password` — Requests reset password token.
* **POST** `/api/auth/reset-password` — Resets account password using token verification.

### 🚚 Vehicles & Fleet
* **GET** `/api/vehicles` — List active vehicles with live positions and connectivity states.
* **GET** `/api/vehicles/:id` — Details of a single vehicle.
* **POST** `/api/vehicles` — Register a vehicle (requires a unique 15-digit IMEI).
* **PUT** `/api/vehicles/:id` — Update vehicle details.
* **DELETE** `/api/vehicles/:id` — Delete vehicle asset.
* **POST** `/api/vehicles/:id/migrate` — Migrate vehicle to another dealer/organization.
* **GET** `/api/vehicles/:id/history` — Historical coordinate logs. Supports parameters `startDate`, `endDate`, `page`, and `limit`.
* **GET** `/api/vehicles/:id/route` — GPS coordinate series filtered to optimize path routing.
* **GET** `/api/vehicles/:id/report` — Fleet analytics (distance traveled, maximum speeds, active engine runtimes).
* **GET** `/api/vehicles/:id/alerts` — Fetch recent logs of telemetry warnings.
* **GET** `/api/vehicles/:id/messages` — Diagnostics raw packets log check.

### 🏢 Tenant & Admin Operations (`/api/admin/*`)
* **GET / POST / PUT / DELETE** `/api/admin/orgs` — Manage Organizations (Tenant tree nodes).
* **GET / POST / PUT / DELETE** `/api/admin/users` — Platform users administration.
* **GET / POST / PUT / DELETE** `/api/admin/groups` — Device segmentation categories.
* **GET** `/api/admin/devices` — View registered network tracking items.
* **POST** `/api/admin/onboard/devices` — Mass onboard device IMEI credentials.
* **GET** `/api/admin/billing/expired` — Review list of offline, out-of-license vehicle lists.
* **PATCH** `/api/admin/orgs/:id/device-limits` — Manage subscription thresholds.
* **GET / POST / PUT / DELETE** `/api/admin/renewal-plans` — Manage payment/plan items.
* **GET** `/api/admin/renewal-transactions` — Review payment/billing records.

### 🗺️ Geofencing & Route Boundaries (`/api/admin/*`)
* **GET / POST / PUT / DELETE** `/api/admin/geofences` — CRUD Geofence fences (Polygon / Circle).
* **POST** `/api/admin/geofences/:id/assign` — Attach geofence logic constraint to vehicles.
* **GET** `/api/admin/geofences/:id/vehicles` — Fetch assigned vehicle mapping lists.
* **GET / POST / PUT / DELETE** `/api/admin/routes` — CRUD route paths.
* **POST** `/api/admin/routes/:id/assign` — Bind path corridor tracking logic to vehicle metrics.

### 📊 Reports (`/api/reports/*`)
* **GET** `/api/reports/trip` — Summary of trips completed.
* **GET** `/api/reports/distance` — Daily distance metrics.
* **GET** `/api/reports/activity` — Run duration and state check.
* **GET** `/api/reports/route-history` — Complete track trace of historical path.
* **GET** `/api/reports/ignition` — Ignition status intervals logs.
* **GET** `/api/reports/overspeeding` — Speed limit violations report.
* **GET** `/api/reports/stoppages` — Stoppage duration logs.
* **GET** `/api/reports/consolidated` — Compiled report aggregating multiple fleet entities.
* **GET** `/api/reports/individual` — High resolution statistics for specific asset logs.
* **GET** `/api/reports/dashboard` — Live counts and statistical parameters.

### ⚙️ Organization Settings & White-Labeling (`/api/profile/*`)
* **GET** `/api/profile` — Fetch custom theme colors, logos, and organization profile rules.
* **PUT** `/api/profile` — Update white-label settings.
* **POST** `/api/profile/logo` — Upload customized organization logo.
* **POST** `/api/profile/favicon` — Upload custom tab icon.
* **POST** `/api/profile/background` — Upload branded auth background image.
* **POST** `/api/profile/change-password` — Update user passwords.
* **GET** `/api/profile/audit` — Log user modifications audit trail details.
