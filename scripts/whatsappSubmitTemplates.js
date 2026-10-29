// ============================================================
// WHATSAPP TEMPLATE SUBMISSION & STATUS SCRIPT
// Submits pre-approved UTILITY templates to Meta WhatsApp Business Account
//
// Usage:
//   node scripts/whatsappSubmitTemplates.js          # Submits templates from templates.json
//   node scripts/whatsappSubmitTemplates.js --status # Checks current status of templates
// ============================================================

'use strict';

const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const env = require('../backend/config/env');

const WABA_ID = env.WHATSAPP_WABA_ID;
const ACCESS_TOKEN = env.WHATSAPP_ACCESS_TOKEN;
const API_VERSION = env.WHATSAPP_API_VERSION || 'v21.0';

if (!WABA_ID || !ACCESS_TOKEN) {
  console.error('[WHATSAPP-TEMPLATE] Error: WHATSAPP_WABA_ID and WHATSAPP_ACCESS_TOKEN must be set in .env');
  process.exit(1);
}

const templatesPath = path.join(__dirname, '..', 'backend', 'whatsapp', 'templates.json');

async function checkStatus() {
  console.log(`[WHATSAPP-TEMPLATE] Fetching template status from Meta (WABA_ID: ${WABA_ID})...`);
  const url = `https://graph.facebook.com/${API_VERSION}/${WABA_ID}/message_templates`;

  try {
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
    });

    const templates = res.data?.data || [];
    console.log(`\nFound ${templates.length} templates on Meta WABA:`);
    console.log('------------------------------------------------------------');
    for (const t of templates) {
      console.log(`- ${t.name.padEnd(25)} | Lang: ${t.language.padEnd(5)} | Status: ${t.status}`);
      if (t.rejected_reason) {
        console.log(`  Reason: ${t.rejected_reason}`);
      }
    }
    console.log('------------------------------------------------------------');
  } catch (err) {
    const metaErr = err.response?.data?.error || {};
    console.error(`[WHATSAPP-TEMPLATE] Failed to fetch templates: [${metaErr.code}] ${metaErr.message || err.message}`);
    process.exit(1);
  }
}

async function submitTemplates() {
  if (!fs.existsSync(templatesPath)) {
    console.error(`[WHATSAPP-TEMPLATE] Error: Templates file not found at ${templatesPath}`);
    process.exit(1);
  }

  const templates = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
  console.log(`[WHATSAPP-TEMPLATE] Submitting ${templates.length} templates to Meta (WABA_ID: ${WABA_ID})...`);
  const url = `https://graph.facebook.com/${API_VERSION}/${WABA_ID}/message_templates`;

  for (const tpl of templates) {
    try {
      console.log(`\nSubmitting template: "${tpl.name}" (${tpl.language})...`);
      const res = await axios.post(url, tpl, {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      console.log(`✓ Template "${tpl.name}" submitted! ID: ${res.data?.id}, Status: ${res.data?.status || 'PENDING'}`);
    } catch (err) {
      const metaErr = err.response?.data?.error || {};
      if (metaErr.message && metaErr.message.toLowerCase().includes('already exists')) {
        console.log(`ℹ Template "${tpl.name}" already exists on Meta.`);
      } else {
        console.error(`✗ Error submitting "${tpl.name}": [${metaErr.code}] ${metaErr.message || err.message}`);
      }
    }
  }

  console.log('\n[WHATSAPP-TEMPLATE] Template submission pass complete.');
}

const isStatusCheck = process.argv.includes('--status');
if (isStatusCheck) {
  checkStatus();
} else {
  submitTemplates();
}

