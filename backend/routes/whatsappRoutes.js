// ============================================================
// WHATSAPP ROUTES
// Webhook endpoints (unauthenticated) + Management endpoints (authenticated)
// ============================================================

'use strict';

const express = require('express');
const { WhatsAppWebhookController } = require('../controllers/whatsappWebhookController');
const WhatsAppRecipientController = require('../controllers/whatsappRecipientController');
const WhatsAppMessageController = require('../controllers/whatsappMessageController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

// ─── 1. Public Webhook Router ──────────────────────────────
const webhookRouter = express.Router();
webhookRouter.get('/', WhatsAppWebhookController.verify);
webhookRouter.post('/', WhatsAppWebhookController.handleEvent);

// ─── 2. Authenticated Management Router ────────────────────
const apiRouter = express.Router();
apiRouter.use(authenticate);
apiRouter.use(authorize('superadmin', 'dealer', 'customer'));

// Recipients
apiRouter.get('/recipients', WhatsAppRecipientController.getRecipients);
apiRouter.post('/recipients', WhatsAppRecipientController.createRecipient);
apiRouter.put('/recipients/:id', WhatsAppRecipientController.updateRecipient);
apiRouter.delete('/recipients/:id', WhatsAppRecipientController.deleteRecipient);

// Organization Settings (Daily Report)
apiRouter.get('/settings', WhatsAppRecipientController.getSettings);
apiRouter.put('/settings', WhatsAppRecipientController.updateSettings);

// Outbox Messages Log & Retry
apiRouter.get('/messages', WhatsAppMessageController.getMessages);
apiRouter.post('/messages/:id/retry', WhatsAppMessageController.retryMessage);
apiRouter.get('/queue-status', WhatsAppMessageController.getQueueStatus);

module.exports = {
  webhookRouter,
  apiRouter
};

