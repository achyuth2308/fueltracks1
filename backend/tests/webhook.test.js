const { test, describe } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { verifySignature } = require('../controllers/whatsappWebhookController');

describe('WhatsApp Webhook Signature Verification', () => {
  const secret = 'test-whatsapp-secret-12345';

  test('valid signature returns true', () => {
    const bodyObj = { object: 'whatsapp_business_account', entry: [] };
    const rawBody = Buffer.from(JSON.stringify(bodyObj));
    const hmac = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    const req = {
      headers: {
        'x-hub-signature-256': `sha256=${hmac}`
      },
      rawBody,
      body: bodyObj
    };

    assert.strictEqual(verifySignature(req, secret), true);
  });

  test('tampered body returns false', () => {
    const rawBody = Buffer.from(JSON.stringify({ test: 'real' }));
    const tamperedBody = Buffer.from(JSON.stringify({ test: 'tampered' }));
    const hmac = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    const req = {
      headers: {
        'x-hub-signature-256': `sha256=${hmac}`
      },
      rawBody: tamperedBody,
      body: { test: 'tampered' }
    };

    assert.strictEqual(verifySignature(req, secret), false);
  });

  test('missing signature header returns false when secret configured', () => {
    const req = {
      headers: {},
      rawBody: Buffer.from('{}')
    };
    assert.strictEqual(verifySignature(req, secret), false);
  });
});
