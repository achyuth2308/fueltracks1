# Third-Party Integrations & Webhooks

FuelTracks supports pushing real-time GPS and telemetry data to external third-party systems.

## 1. Generic Webhook System (`backend/services/webhookService.js`)
FuelTracks provides a generic webhook engine that allows API clients (like external OMS systems) to register their own callback URLs.

- **Trigger:** Whenever a raw GPS point is parsed by the TCP Server, it is published to a Redis channel. The `locationSubscriber.js` reads this and invokes `webhookService.dispatch(vehicle, payload)`.
- **Registration:** Third parties use `POST /api/v1/webhooks` to register their endpoints.
- **Payload:** Dispatches a structured JSON payload (`location.update`) containing latitude, longitude, speed, ignition state, and device time.
- **Resilience:** The webhook dispatch is fire-and-forget. It does not block the TCP ingestion pipeline.

## 2. Hardcoded Integrations: Coromandel / Sathyadeva (`backend/services/sclenPushService.js`)
Due to specific business requirements, FuelTracks has a hardcoded, dedicated integration for **Sathyadeva Cement / Coromandel (SCLEN)**.

- **Trigger:** Also triggered by `locationSubscriber.js` simultaneously with generic webhooks.
- **Logic:** 
  - `sclenPushService.js` checks if the incoming vehicle belongs to the Sathyadeva Organization/Group.
  - If it matches, it constructs a legacy XML/JSON structure specifically expected by the Coromandel `SCLEN` endpoint.
  - It pushes the data via an `axios.post` to the `COROMANDEL_ENDPOINT` environment variable.
- **⚠️ Important Operational Note:** 
  - Historically, this service included a synchronous reverse-geocoding call (`getAddress()`) to Nominatim. Under heavy load (19 vehicles reporting simultaneously), this caused the Node event loop to stall, timing out the Geocoder, and exhausting V8 heap memory (OOM Crash / 502 Bad Gateway).
  - **Current State [2026-09-29]:** The SCLEN push has been temporarily **paused** (`return;` added to the top of the function) because the Coromandel endpoint (`115.112.241.148`) is completely offline/timing out. This was causing massive backpressure and exhausting the Postgres connection pool. Cement OMS remains unaffected.
