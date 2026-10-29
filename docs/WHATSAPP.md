# FuelTracks WhatsApp Integration Guide (Meta WhatsApp Cloud API)

This document provides setup, operation, verification, and rollback instructions for automated WhatsApp notifications on FuelTracks.

---

## 1. Meta Developer Portal Setup

### 1.1 Meta App & WhatsApp Business Account
1. Go to the [Meta for Developers Portal](https://developers.facebook.com/).
2. Create or select a Business App.
3. Add the **WhatsApp** product to your app.
4. Note your **Phone Number ID** and **WhatsApp Business Account ID (WABA ID)** from the WhatsApp > API Setup section.

### 1.2 Permanent System User Token
1. In Meta Business Manager, go to **Business Settings > Users > System Users**.
2. Create an Admin System User (e.g. `fueltracks-bot`).
3. Generate a permanent token with the following permissions:
   - `whatsapp_business_messaging` (to dispatch messages via Cloud API)
   - `whatsapp_business_management` (to create and inspect message templates)
4. Store this token safely as `WHATSAPP_ACCESS_TOKEN`. Never commit it to git or log it in server logs.

### 1.3 Webhook Setup
1. In Meta App Dashboard, navigate to **WhatsApp > Configuration > Webhook**.
2. Click **Edit** and set:
   - **Callback URL**: `https://api.fueltracks.in/api/webhooks/whatsapp`
   - **Verify Token**: Any secure random string (matches `WHATSAPP_VERIFY_TOKEN` in `.env`).
3. Click **Verify and Save**.
4. In Webhook fields, click **Manage** and subscribe to:
   - `messages` (receives incoming opt-out / opt-in replies like `STOP`, `START`, and message delivery/read statuses).

---

## 2. Environment Variables

Add the following variables to `.env` on production:

```env
# WhatsApp Meta Cloud API
WHATSAPP_ENABLED=true
WHATSAPP_ACCESS_TOKEN=EAAG...YOUR_PERMANENT_SYSTEM_USER_TOKEN
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_WABA_ID=123456789012345
WHATSAPP_APP_SECRET=your_meta_app_secret_here
WHATSAPP_VERIFY_TOKEN=fueltracks_webhook_verify_secret_token
WHATSAPP_API_VERSION=v21.0
WHATSAPP_RATE_PER_SEC=20
```

### Security & Privacy Rules:
- All full phone numbers are masked in console and outbox logs to their last 4 digits (e.g. `********6914`).
- Access tokens and secrets are never logged.
- When `WHATSAPP_ENABLED=false`, messages stay `queued` in the database outbox, nothing is sent, and expired messages are skipped on re-enable. Mock mode is non-production only (`NODE_ENV !== 'production'`).

---

## 3. Template Submission

FuelTracks uses pre-approved Meta `UTILITY` category templates:
1. `fuel_refill_alert`
2. `fuel_theft_alert`
3. `daily_fleet_report`

### Submit templates to Meta WABA:
```bash
node scripts/whatsappSubmitTemplates.js
```

### Check template approval status:
```bash
node scripts/whatsappSubmitTemplates.js --status
```

---

## 4. Architecture & Data Flow

```
[TCP Packet / GPS Telemetry]
        │
        ▼
locationSubscriber.js ──> FuelEventAggregator (Redis Refill Session State Machine)
        │
        ├─> Single packet theft (Drop >= threshold + Stationary)
        └─> Finalized refill alert ('fuel_refill_final')
        │
        ▼
alertSubscriber.js
        │ (Saves alert to DB)
        ▼
notificationService.enqueueWhatsAppAlert()
        │
        ▼
[Postgres whatsapp_messages Outbox Table] (status: queued)
        │
        ▼
whatsappWorker.js (Runs inside API via setInterval every 3s, FOR UPDATE SKIP LOCKED)
        │
        ▼
Meta Graph API (POST https://graph.facebook.com/v21.0/{PHONE_ID}/messages)
        │
        ▼
Customer WhatsApp Device
```

### Key Safety Protections:
- **Transactional Outbox (`whatsapp_messages`)**: Alerts survive Redis or API process restarts without data loss.
- **Idempotency**: Unique constraint `UNIQUE(event_type, event_ref, recipient_id)` prevents duplicate sends.
- **Opt-in Enforced**: The system will never dispatch a WhatsApp message unless `opt_in = true` and explicit consent was confirmed.
- **Defensive Error Handling**: All WhatsApp calls run wrapped in try/catch — failures never block alert persistence or GPS packet ingestion.

---

## 5. Deployment Steps

1. Pull latest code on server:
   ```bash
   git pull origin main
   ```
2. Run database migrations:
   ```bash
   npm run db:migrate
   ```
   (Ensures `whatsapp_recipients`, `whatsapp_messages`, and `whatsapp_org_settings` tables exist).
3. Reload PM2 services:
   ```bash
   npm run pm2:reload
   ```

---

## 6. Manual Testing Checklist

### 6.1 Local Unit & Integration Tests
Run the built-in Node test suite:
```bash
npm test
```
Verifies:
- Phone normalizer (E.164 conversion & masking)
- Webhook HMAC-SHA256 signature verification
- WhatsAppService mock mode & phone guard
- Fuel alert parameter builders & daily report window
- Refill session state machine with slosh filters
- Worker exponential backoff calculation

### 6.2 Manual Test Using Meta Test Number
1. In Meta Developer Portal under **WhatsApp > API Setup**, add your personal phone number as an allowed recipient.
2. In FuelTracks UI under **Organization Settings > WhatsApp**, add your phone number with explicit consent checked.
3. Simulate a finalized refill or send a test alert using `simulator`:
   ```bash
   node scripts/deviceSimulator.js bstpl
   ```
4. Verify message status in UI **Message Outbox Log**:
   - Status transitions from `queued` -> `sent` -> `delivered` -> `read`.
5. Reply `STOP` from WhatsApp:
   - Check webhook logs: `[WHATSAPP-WEBHOOK] Received opt-out command "STOP"`.
   - Verify recipient status in UI automatically flips to `Opted Out`.
6. Reply `START` from WhatsApp:
   - Verify recipient status automatically flips back to `Opted In`.

---

## 7. Emergency Rollback

If WhatsApp Cloud API experiences downtime or Meta token expires:
1. In `.env`, set:
   ```env
   WHATSAPP_ENABLED=false
   ```
2. Reload API with updated environment:
   ```bash
   pm2 reload fueltracks-api --update-env
   ```
3. Outbox worker pauses sending: messages stay `queued` in `whatsapp_messages`, nothing is sent, and expired ones are skipped on re-enable. Mock mode is non-production only. In-app alerts, FCM, SMS, and Email alerts continue functioning normally without interruption.

4. Check queued backlog in PostgreSQL:
   ```sql
   SELECT event_type, status, COUNT(*)
   FROM whatsapp_messages
   WHERE status = 'queued'
   GROUP BY event_type, status;
   ```

