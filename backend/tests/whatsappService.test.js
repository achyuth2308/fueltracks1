const { test, describe } = require('node:test');
const assert = require('node:assert');
const WhatsAppService = require('../services/whatsappService');

describe('WhatsAppService Mock Mode & Phone Guard', () => {
  test('returns mock wamid when WHATSAPP_ENABLED is false', async () => {
    // Default WHATSAPP_ENABLED is false
    const res = await WhatsAppService.sendTemplate({
      to: '9000666914',
      name: 'fuel_refill_alert',
      bodyParams: ['MH12AB1234', '45.0', '15.0', '60.0', '10:30 AM', 'Pune Station']
    });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.mock, true);
    assert.ok(res.wamid.startsWith('mock-wamid-'));
  });

  test('rejects invalid phone numbers before network call', async () => {
    const res = await WhatsAppService.sendTemplate({
      to: 'invalid-phone',
      name: 'fuel_refill_alert'
    });

    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.error_code, 'INVALID_PHONE');
  });
});

