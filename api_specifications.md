# Fleet Alerts API Specification

This document outlines the exact API routes, JSON schemas, and real-time socket events your backend needs to implement for the Fuel Tracks app's **Alerts** feature to work seamlessly.

## 1. REST Endpoints

### 1.1. Get Historical Alerts
Fetches a paginated list of alerts for the user's vehicles.

- **Endpoint:** `GET /api/v1/alerts` (or your equivalent alerts route)
- **Query Parameters:**
  - `page`: Integer (default: 1)
  - `limit`: Integer (default: 30)
  - `type`: String (optional, e.g., `sos`, `overspeed`, `geofence_enter`)
- **Response Format:**
```json
{
  "success": true,
  "data": [
    {
      "id": "64a2b1c...",
      "type": "overspeed",
      "title": "Overspeeding Alert",
      "message": "Vehicle MH-12-AB-1234 exceeded 80 km/h.",
      "vehicleId": "v_89123",
      "vehicleName": "Truck 01",
      "latitude": 19.0760,
      "longitude": 72.8777,
      "address": "Mumbai Highway, India",
      "speed": 85.5,
      "createdAt": "2026-07-30T10:30:00Z",
      "isRead": false
    }
  ],
  "meta": {
    "hasMore": true,
    "total": 142
  }
}
```

> [!NOTE] 
> The app is extremely flexible when parsing the JSON payload. For instance, the ID can be `id` or `_id`, and the vehicle info can be embedded inside a `vehicle` sub-object or flattened at the root.

### 1.2. Mark Alert as Read
When a user taps an alert in the app, it must be marked as read in the database.

- **Endpoint:** `PUT /api/v1/alerts/:id/read`
- **Response Format:** `200 OK`

### 1.3. Mark All Alerts as Read
When a user taps the "Mark read" button in the header.

- **Endpoint:** `PUT /api/v1/alerts/read-all`
- **Response Format:** `200 OK`

---

## 2. Real-Time Socket Events

To make the app update live without the user pulling to refresh, your backend must emit socket events to connected clients whenever a new alert occurs.

### Event: `alert:new` or `geofence:event`
When a vehicle triggers an event (like hard braking or theft), emit this event to the user's socket room.

**Socket Payload:**
```json
{
  "id": "64a2b1d...",
  "type": "sos",
  "title": "Panic Button Pressed",
  "message": "Immediate attention required for Vehicle MH-12-AB-1234.",
  "vehicleId": "v_89123",
  "vehicleName": "Truck 01",
  "latitude": 19.0760,
  "longitude": 72.8777,
  "createdAt": "2026-07-30T10:35:00Z",
  "isRead": false
}
```

---

## 3. Supported Alert Types (`type` field)

The frontend uses the `type` field to assign the correct icon and severity color (Critical/Red, Warning/Orange, Info/Blue). Your backend should emit one of the following exact string values:

> [!IMPORTANT]
> **Critical (Red):** `sos`, `panic`, `crash`, `accident`, `tow`, `power_cut`, `theft`, `theft_alarm`
> **Warning (Orange):** `overspeed`, `harsh_braking`, `harsh_acceleration`, `geofence_enter`, `geofence_exit`, `low_battery`
> **Info (Blue):** `ignition_on`, `ignition_off`, `idle`, `stoppage`, `moving`, `stopped`

---

## 4. Background Push Notifications (FCM)

**THIS IS REQUIRED FOR ALERTS WHEN THE APP IS CLOSED.** 

Sockets disconnect when the user closes the app or locks their phone. To ensure the user's phone still rings/vibrates, your backend **must** send a Firebase Cloud Messaging (FCM) payload to the user's device token whenever a critical alert happens.

**FCM Message Payload Format:**
Your backend must send this via the Firebase Admin SDK to the Google FCM servers:

```json
{
  "message": {
    "token": "DEVICE_FCM_TOKEN_STORED_IN_YOUR_DB",
    "notification": {
      "title": "Overspeeding Alert",
      "body": "Vehicle MH-12-AB-1234 exceeded 80 km/h."
    },
    "data": {
      "click_action": "FLUTTER_NOTIFICATION_CLICK",
      "type": "overspeed",
      "vehicleId": "v_89123",
      "alertId": "64a2b1c..."
    },
    "android": {
      "priority": "high",
      "notification": {
        "sound": "default",
        "channel_id": "critical_alerts_channel"
      }
    },
    "apns": {
      "payload": {
        "aps": {
          "sound": "default",
          "content-available": 1
        }
      }
    }
  }
}
```

> [!NOTE] 
> The `notification` block triggers the physical banner and sound on the phone when the app is closed. The `data` block is passed into the app when the user taps the notification, allowing the app to route them directly to the specific vehicle or alert!
