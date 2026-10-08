# TCP Daemon (GPS Ingestion Server)

The TCP server is a standalone Node.js process (`tcp-server/server.js`) responsible for maintaining raw, persistent socket connections with hardware GPS trackers. It operates independently of the REST API.

## 1. Port Mappings & Protocols
The daemon runs multiple isolated `net.createServer` instances simultaneously to support different manufacturer protocols.

- **Port 5000: BSTPL-17 Protocol**
  - **Format:** Comma-separated string terminated with `#`.
  - **Parsing:** Handled by `tcp-server/parser/bstplParser.js`.

- **Port 5001: AIS140 / tNavIC Protocol**
  - **Format:** Comma-separated string terminated with `*`.
  - **Parsing:** Standardized Indian government compliance protocol.

- **Port 5002: Concox Protocol**
  - **Format:** Hexadecimal binary buffers.
  - **Parsing:** Handled by `tcp-server/parser/concoxParser.js`. Requires responding with ACK (Acknowledgement) packets to login, heartbeat, and alarm messages to keep the device from disconnecting.

## 2. Ingestion & Decoupling Flow
1. **Receive:** A raw byte buffer is received on a socket.
2. **Parse:** The appropriate protocol parser decodes the buffer into a standard JSON object containing IMEI, Lat, Lng, Speed, Ignition, and Device Time.
3. **Database Logging (Raw):** 
   - Before any business logic is applied, the raw unparsed hex/string is inserted into the `raw_packets` table for diagnostic and auditing purposes.
4. **Redis Pub/Sub (Decoupling):**
   - The parsed JSON is published to a Redis channel.
   - The TCP process immediately frees up to handle the next packet.
   - Background subscribers (running in the REST API process, e.g., `locationSubscriber.js`) listen to Redis, process the data, save it to the `gps_data` table in TimescaleDB, and emit Socket.io events to web clients.

## 3. Operational Constraints
- **Exec Mode:** The PM2 process MUST be run in `fork` mode (`instances: 1`). Hardware TCP connections rely on persistent socket state; running in `cluster` mode causes load balancers to route packets from the same device to different worker threads, instantly breaking multi-packet protocols (like Concox).
- **Scale:** If a single core bottlenecks at high scale (10,000+ devices), horizontal scaling requires a sophisticated Layer 4 Load Balancer (like HAProxy) configured with IP Hashing / sticky sessions to ensure devices always reconnect to the same TCP worker.
