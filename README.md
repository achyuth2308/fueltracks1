# FuelTracks - Fleet Tracking & Management System

A multi-tenant, high-concurrency GPS tracking platform for B2B logistics and fleet management. It features a TCP daemon that ingests raw telemetry packets from BSTPL-17 GPS devices, parses GPS coordinates (converting DDM format to Decimal Degrees), buffers records in Redis, and asynchronously updates a PostgreSQL database and publishes real-time WebSocket events.

---

## 🏗️ System Architecture & Components

FuelTracks consists of four primary components:
1. **TCP Daemon (`tcp-server/`)**: A net socket listener (defaulting to Port 5000) that accepts ASCII streams from physical or simulated GPS devices. It parses raw data, validates IMEI identification, pushes to Redis Pub/Sub channels for decoupling, and writes debug logs into `raw_packets`.
2. **REST API Server (`backend/`)**: An Express.js backend (Port 3001) that handles multi-tenant authentication, RBAC administration (Superadmins, Dealers, Customers), CRUD of vehicles, devices, organizations, groups, custom reporting logs, and audits.
3. **WebSockets Publisher**: Managed via Socket.io inside the Express server, subscribing to Redis channels and piping live vehicle positions and telemetry details directly to active client rooms (`vehicle:<id>` and `org:<org_id>`).
4. **Web Frontend (`frontend/`)**: A Vite-powered React single page application (SPA) with styled dashboards using Framer Motion, Leaflet maps, Recharts analytics, and Lucide icons.

```
                  ┌────────────────────────────────────────┐
                  │          BSTPL-17 GPS Device           │
                  └───────────────────┬────────────────────┘
                                      │
                                      │ TCP (Port 5000)
                                      ▼
                  ┌────────────────────────────────────────┐
                  │               TCP Daemon               │
                  └───────────────────┬────────────────────┘
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
│          React Frontend           │        │     PostgreSQL 15+        │
└───────────────────────────────────┘        └───────────────────────────┘
```

---

## 📂 Directory Structure

```
fueltracks/
├── backend/              # Express REST API, controllers, and socket managers
│   ├── config/           # DB, env, and Redis configurations
│   ├── controllers/      # Route controllers (auth, vehicle, onboarding, etc.)
│   ├── middleware/       # JWT auth, error handlers, and validations
│   ├── models/           # DB access queries (PG query helpers)
│   ├── modules/          # Encapsulated sub-systems (profile, reports)
│   └── routes/           # Router registrations
├── database/             # Postgres initial schema, seeds, and SQL migrations
│   ├── schema.sql        # Full database tables declaration
│   ├── seed.sql          # Sample data for local development
│   ├── devices_migration.sql   # Standalone devices migration
│   ├── audit_migration.sql     # Standalone audit log migration
│   └── profile_migration.sql   # Standalone organization profiles migration
├── frontend/             # Vite + React web application
│   ├── src/              # Page layouts, dashboard components, maps
│   └── public/           # Static asset files
├── scripts/              # Command-line tools (init, simulator, migration runner)
│   ├── dbInit.js         # Base schema and seed initialization helper
│   └── runMigrations.js  # SEQUENTIAL database migration executor
├── tcp-server/           # TCP net socket daemon
│   ├── parser/           # Telemetry packet parsers (DDM to Decimal converter)
│   └── server.js         # Port listener and Redis publisher
└── .env.example          # Sample environment configuration template
```

---

## 🗄️ Database Schema Documentation

The system operates on **13 relational tables** with cascades, indices, and auto-updating triggers:

### Core Hierarchy
* **`organizations`**: Tenants configured in a three-tier tree structure (`super` → `dealer` → `customer`).
* **`users`**: Platform administrators and customers. Stores encrypted credentials and links back to target organization nodes.
* **`groups`**: Logical clusters created by Dealers to restrict and partition user-vehicle access.

### Fleet & Devices
* **`vehicles`**: Physical assets equipped with GPS modules. Tied to an IMEI. Includes metadata (`odoDistance`, `licenceNo`, `serviceEngineer`) and licence expiration boundaries.
* **`devices`**: Registered tracking hardware models linked to organizational nodes, users, and groups.
* **`vehicle_groups`** / **`user_groups`**: Many-to-many relationship mapping linking vehicles and users to groups.

### Telemetry & Logs
* **`gps_points`**: High-frequency writes containing latitudes, longitudes, direction, speeds, odometer status, fuel levels, ignition flags, and battery voltage.
* **`vehicle_latest_state`**: A denormalized, single-row-per-vehicle table optimized for fast dashboard read updates.
* **`alerts`**: Telemetry warning logs (e.g. ignition on/off, box opens, battery low).
* **`raw_packets`**: Debugging logs that store unparsed TCP streams for diagnostic reviews.
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
| `REDIS_HOST`| Redis Server Host | `127.0.0.1` |
| `REDIS_PORT`| Redis Server Port | `6379` |
| `JWT_SECRET`| Cryptographic key for signing JSON Web Tokens | *Required in Prod* |
| `TCP_PORT`  | Port for accepting device socket streams | `5000` |
| `API_PORT`  | Port for REST API and WebSockets | `3001` |
| `NODE_ENV`  | Application mode (`development` / `production`)| `development` |
| `CORS_ORIGIN`| Allowed CORS domain endpoints | `*` |

---

## 🚀 Installation & Setup

### 1. Prerequisites
Ensure you have **Node.js (v18+)**, **PostgreSQL (15+)**, and **Redis** (or Memurai on Windows) installed and active.

### 2. Node Modules Setup
Run from the root directory to install dependencies for the backend and TCP server:
```bash
npm install
```

To install frontend dependencies, execute:
```bash
npm --prefix frontend install
```

### 3. Database Setups

#### Option A: Fresh Database Installation (Destructive)
To clean, drop existing tables, and seed fresh records:
```bash
npm run db:init
```

#### Option B: Run Outstanding Database Migrations (Safe)
To update an existing database structure cleanly with added migrations (`devices`, `audit_logs`, and `organization_profiles` tables along with the `vehicles.metadata` column) without deleting existing records:
```bash
npm run db:migrate
```

### 4. Running the Applications

Launch the systems using the package scripts:

* **Start REST API Backend (Port 3001)**:
  ```bash
  npm run start:api
  ```
  *(For hot-reload developer mode: `npm run dev:api`)*

* **Start TCP Socket Receiver (Port 5000)**:
  ```bash
  npm run start:tcp
  ```
  *(For hot-reload developer mode: `npm run dev:tcp`)*

* **Start React Web Frontend**:
  ```bash
  npm run start:frontend
  ```

* **Launch Telemetry Simulator (Mocking vehicles transmitting tracking points)**:
  ```bash
  npm run simulator
  ```

---

## 🧪 Testing / REST Endpoints

### 🔐 Authentication
* **POST** `/api/auth/login`
  * Body: `{ "email": "dealer@abclogistics.com", "password": "password123" }`
  * Returns: JWT Token (`accessToken`) + Profile node.

### 🚚 Vehicles & Fleet
* **GET** `/api/vehicles` — List active vehicles with live positions and connectivity states.
* **POST** `/api/vehicles` — Register a vehicle (requires a unique 15-digit IMEI).
  * Body: `{ "imei": "865006049210220", "name": "Truck Gamma", "plate": "MH12XY9999", "model": "TATA 1618" }`
* **GET** `/api/vehicles/:id/history` — Historical coordinate logs. Supports parameters `startDate`, `endDate`, `page`, and `limit`.
* **GET** `/api/vehicles/:id/route` — GPS coordinate series filtered to optimize path routing.
* **GET** `/api/vehicles/:id/report` — Fleet analytics (distance traveled, maximum speeds, active engine runtimes).

### ⚙️ Organization Settings
* **GET** `/api/profile` — Fetch custom theme and organization profiles.
* **PUT** `/api/profile` — Upsert organization specific configurations (mapping provider, contacts, SMS alerts).
