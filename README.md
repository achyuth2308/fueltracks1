# FuelTracks Backend System

A multi-tenant, high-concurrency GPS tracking backend for BSTPL-17 devices. 

## Features
- **TCP Server (Port 5000)**: Receives ASCII packets from GPS devices, parses coordinate strings (DDM to Decimal Degrees), validates, and caches status in Redis.
- **REST API Server (Port 3001)**: Provides multi-tenant resource management (Organizations, Users, Groups, Vehicles), vehicle tracking logs, polyline routes, reports, and alert logs.
- **Live WebSockets (Socket.io)**: Emits real-time position updates to listening client sessions (room-based: `vehicle:<id>` or `org:<org_id>`).
- **Background workers**: Uses Redis Pub/Sub to decouple packet reception (TCP daemon) from DB write/Socket broadcast cycles.

---

## Technical Stack
- Node.js (Express, Net, Socket.io)
- PostgreSQL 15+ (Location tracking logs, schemas, historical logs)
- Redis / Memurai (Live state caching, Pub/Sub tracking channels)

---

## Directory Structure
```
fueltracks/
├── tcp-server/           # TCP daemon for device socket streams
├── backend/              # Express API & socket.io publisher
├── database/             # PostgreSQL tables schema and seeds
├── scripts/              # Device simulator tool for testing
└── .env                  # Configuration variables
```

---

## Getting Started

### 1. Prerequisite setup
Make sure you have **PostgreSQL** and **Redis** (or Memurai on Windows) running.

Create a database named `fueltracks` in PostgreSQL:
```sql
CREATE DATABASE fueltracks;
```

Update the database connection details in `.env` if your username or password is not `postgres`.

### 2. Install dependencies
From the `fueltracks` folder (containing `package.json`), install all node modules:
```bash
npm install
```

### 3. Initialize Database Schema
Run the SQL schema and seed files inside pgAdmin, or run the utility script (if `psql` command is in path):
```bash
npm run db:init
```

### 4. Running the Servers
You can launch the components using these npm scripts:

- **Run TCP Server (Port 5000)**:
  ```bash
  npm run start:tcp
  ```
- **Run Backend REST API (Port 3001)**:
  ```bash
  npm run start:api
  ```
- **Run Device Simulator (Mock devices sending tracks)**:
  ```bash
  npm run simulator
  ```

---

## Testing / Verification

### REST API Endpoints

#### Authentication
- **POST** `/api/auth/login`
  - Body: `{ "email": "dealer@abclogistics.com", "password": "password123" }`
  - Returns: JWT Token (`accessToken`) + User profile.

- **GET** `/api/auth/me`
  - Headers: `Authorization: Bearer <token>`

#### Fleet Vehicles
- **GET** `/api/vehicles` — Returns all active vehicles with their live coordinates and connection statuses.
- **POST** `/api/vehicles` — Registers a vehicle. *Must include a unique 15-digit IMEI*.
  - Body: `{ "imei": "865006049210220", "name": "Truck Gamma", "plate": "MH12XY9999", "model": "TATA 1618" }`
- **GET** `/api/vehicles/:id/history` — GPS point history for a vehicle (supports query parameters `startDate`, `endDate`, `page`, `limit`).
- **GET** `/api/vehicles/:id/route` — GPS point coordinates strictly for path polylines.
- **GET** `/api/vehicles/:id/report` — Analytics breakdown (total distance travelled, max speed, engine runtime hours).

#### Tenant Management
- **GET** `/api/admin/orgs` — Managed organizations list.
- **GET** `/api/admin/users` — Staff users list.
- **GET** `/api/admin/groups` — Custom fleets/sub-regions created by Dealers.
