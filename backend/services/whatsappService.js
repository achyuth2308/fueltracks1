// ============================================================
// WHATSAPP SERVICE — Meta WhatsApp Cloud API Client
// Handles template message dispatch, token-bucket rate limiting,
// and mock mode fallback.
// ============================================================

'use strict';

const http = require('http');
const https = require('https');
const axios = require('axios');
const env = require('../config/env');
const { normalizePhone, maskPhone } = require('../utils/phone');

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50, keepAliveMsecs: 30000 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50, keepAliveMsecs: 30000 });

/**
 * Sanitizes template parameters against Meta's strict formatting rules:
 * - No empty string (replaces with '-')
 * - No newlines, tabs, or carriage returns
 * - No 4+ consecutive spaces
 * - Max length 1024 chars
 */
function sanitizeTemplateParam(param) {
  if (param == null || param === '') return '-';
  let str = String(param)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {4,}/g, '   ')
    .trim();
  if (!str) return '-';
  if (str.length > 1024) str = str.slice(0, 1021) + '...';
  return str;
}

// ─── Token Bucket Rate Limiter ──────────────────────────────
class TokenBucket {
  constructor(ratePerSec) {
    this.capacity = ratePerSec || 20;
    this.tokens = this.capacity;
    this.fillRate = this.capacity; // tokens per second
    this.lastRefill = Date.now();
  }

  refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.fillRate);
    this.lastRefill = now;
  }

  async acquire() {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    const waitMs = Math.ceil(((1 - this.tokens) / this.fillRate) * 1000);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return this.acquire();
  }
}

const rateLimiter = new TokenBucket(env.WHATSAPP_RATE_PER_SEC);

const WhatsAppService = {
  /**
   * Check whether real Meta WhatsApp API is configured and enabled
   */
  isConfigured() {
    return Boolean(
      env.WHATSAPP_ENABLED &&
      env.WHATSAPP_ACCESS_TOKEN &&
      env.WHATSAPP_PHONE_NUMBER_ID
    );
  },

  /**
   * Send a pre-approved template message via Meta WhatsApp Cloud API
   *
   * @param {Object} options
   * @param {string} options.to - Raw or normalized destination phone
   * @param {string} options.name - WhatsApp template name (e.g. fuel_refill_alert)
   * @param {string} [options.language='en'] - Template language code
   * @param {Array<string|number>} [options.bodyParams=[]] - Positional body variables {{1}}, {{2}}
   * @param {Object} [options.headerDocument=null] - Optional document header { link, filename }
   * @param {Array<Object>} [options.buttons=null] - Optional dynamic button parameters
   * @returns {Promise<{ ok: boolean, wamid?: string, error_code?: string|number, error_message?: string, mock?: boolean }>}
   */
  async sendTemplate({ to, name, language = 'en', bodyParams = [], headerDocument = null, buttons = null }) {
    const normalizedTo = normalizePhone(to);
    if (!normalizedTo) {
      return {
        ok: false,
        error_code: 'INVALID_PHONE',
        error_message: `Cannot normalize destination phone: ${maskPhone(to)}`
      };
    }

    const masked = maskPhone(normalizedTo);

    // Mock Mode when WHATSAPP_ENABLED is false or credentials missing
    if (!this.isConfigured()) {
      if (env.NODE_ENV === 'production') {
        throw new Error('[WHATSAPP] Mock mode is strictly prohibited in production. Valid Meta WhatsApp credentials are required.');
      }
      const mockWamid = `mock-wamid-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      console.log(`[WHATSAPP-MOCK] Dispatched template "${name}" to ${masked} (params: ${JSON.stringify(bodyParams)})`);
      return {
        ok: true,
        wamid: mockWamid,
        mock: true
      };
    }

    // Rate Limiter
    await rateLimiter.acquire();

    // Construct Meta Cloud API components with sanitized parameters
    const components = [];

    if (headerDocument && typeof headerDocument === 'object') {
      components.push({
        type: 'header',
        parameters: [
          {
            type: 'document',
            document: {
              link: headerDocument.link,
              filename: sanitizeTemplateParam(headerDocument.filename || 'report.pdf')
            }
          }
        ]
      });
    }

    if (Array.isArray(bodyParams) && bodyParams.length > 0) {
      components.push({
        type: 'body',
        parameters: bodyParams.map(param => ({
          type: 'text',
          text: sanitizeTemplateParam(param)
        }))
      });
    }

    if (Array.isArray(buttons) && buttons.length > 0) {
      buttons.forEach((btn, idx) => {
        components.push({
          type: 'button',
          sub_type: btn.sub_type || 'url',
          index: String(btn.index !== undefined ? btn.index : idx),
          parameters: btn.parameters || []
        });
      });
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: normalizedTo,
      type: 'template',
      template: {
        name,
        language: { code: language },
        components
      }
    };

    const baseUrl = env.WHATSAPP_API_BASE_URL || process.env.WHATSAPP_API_BASE_URL || 'https://graph.facebook.com';
    if (env.NODE_ENV === 'production' && !baseUrl.startsWith('https://')) {
      throw new Error(`[WHATSAPP] Insecure HTTP URL prohibited in production: ${baseUrl}`);
    }
    const url = `${baseUrl}/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

    try {
      const response = await axios.post(url, payload, {
        httpAgent,
        httpsAgent,
        headers: {
          'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const wamid = response.data?.messages?.[0]?.id;
      console.log(`[WHATSAPP] Sent template "${name}" to ${masked} (wamid: ${wamid})`);
      return {
        ok: true,
        wamid: wamid || 'UNKNOWN_WAMID'
      };
    } catch (err) {
      const metaError = err.response?.data?.error || {};
      const errorCode = metaError.code || err.code || 'HTTP_ERROR';
      const errorMessage = metaError.message || err.message || 'WhatsApp Cloud API call failed';

      console.error(`[WHATSAPP] Failed to send template "${name}" to ${masked}: [${errorCode}] ${errorMessage}`);

      return {
        ok: false,
        error_code: errorCode,
        error_message: errorMessage,
        subcode: metaError.error_subcode,
        status: err.response?.status
      };
    }
  },

  sanitizeTemplateParam
};

module.exports = WhatsAppService;
