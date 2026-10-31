// ============================================================
// WHATSAPP INTEGRATION TEST: TEMPLATES & PARAMETER SANITIZATION
// Validates templates.json structure, placeholder counts, Meta 132000
// error prevention, and parameter sanitization.
// ============================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const WhatsAppService = require('../../backend/services/whatsappService');

const templatesJsonPath = path.join(__dirname, '..', '..', 'backend', 'whatsapp', 'templates.json');

test('Template Schema: templates.json structure and Meta compliance', () => {
  assert.ok(fs.existsSync(templatesJsonPath), 'templates.json must exist');

  const raw = fs.readFileSync(templatesJsonPath, 'utf8');
  const templates = JSON.parse(raw);

  assert.ok(Array.isArray(templates), 'templates.json must be an array');
  assert.equal(templates.length, 3, 'Must define exactly 3 templates');

  const requiredNames = ['fuel_refill_alert', 'fuel_theft_alert', 'daily_fleet_report'];
  for (const name of requiredNames) {
    const t = templates.find(tpl => tpl.name === name);
    assert.ok(t, `Template "${name}" must be present in templates.json`);
    assert.equal(t.category, 'UTILITY', `Template "${name}" category must be UTILITY`);
    assert.equal(t.language, 'en', `Template "${name}" language must be "en"`);

    const bodyComp = t.components.find(c => c.type === 'BODY');
    assert.ok(bodyComp, `Template "${name}" must contain a BODY component`);
    assert.ok(bodyComp.text, `Template "${name}" body text must not be empty`);

    // Match all {{1}}, {{2}}, etc.
    const matches = bodyComp.text.match(/\{\{(\d+)\}\}/g) || [];
    const paramNumbers = matches.map(m => parseInt(m.replace(/\D/g, ''), 10));

    // Ensure parameters are 1-indexed and sequential without gaps
    const maxParam = Math.max(...paramNumbers);
    assert.equal(paramNumbers.length, maxParam, `Template "${name}" placeholders must be sequential without gaps`);

    for (let i = 1; i <= maxParam; i++) {
      assert.ok(paramNumbers.includes(i), `Template "${name}" is missing {{${i}}}`);
    }

    // Verify example data in template matches parameter count
    const exampleParams = bodyComp.example?.body_text?.[0] || [];
    assert.equal(exampleParams.length, maxParam, `Template "${name}" example body_text count (${exampleParams.length}) must match placeholders count (${maxParam})`);
  }
});

test('Template Definitions: Exact parameter counts per template', () => {
  const templates = JSON.parse(fs.readFileSync(templatesJsonPath, 'utf8'));

  const refill = templates.find(t => t.name === 'fuel_refill_alert');
  const theft = templates.find(t => t.name === 'fuel_theft_alert');
  const daily = templates.find(t => t.name === 'daily_fleet_report');

  const countPlaceholders = (tpl) => (tpl.components.find(c => c.type === 'BODY').text.match(/\{\{(\d+)\}\}/g) || []).length;

  assert.equal(countPlaceholders(refill), 6, 'fuel_refill_alert must have exactly 6 parameters');
  assert.equal(countPlaceholders(theft), 7, 'fuel_theft_alert must have exactly 7 parameters');
  assert.equal(countPlaceholders(daily), 9, 'daily_fleet_report must have exactly 9 parameters');
});

test('Parameter Sanitization: sanitizeTemplateParam against Meta 132000 errors', () => {
  const sanitize = WhatsAppService.sanitizeTemplateParam;

  // 1. Null / undefined / empty string replaces with '-'
  assert.equal(sanitize(null), '-');
  assert.equal(sanitize(undefined), '-');
  assert.equal(sanitize(''), '-');
  assert.equal(sanitize('   '), '-');

  // 2. Newlines, carriage returns, and tabs converted to single spaces
  assert.equal(
    sanitize("Line 1\nLine 2\r\nLine 3\tTab"),
    "Line 1 Line 2 Line 3 Tab"
  );

  // 3. 4+ consecutive spaces compressed to max 3
  assert.equal(
    sanitize("Word1    Word2       Word3"),
    "Word1   Word2   Word3"
  );

  // 4. Strings exceeding 1024 characters safely truncated
  const longStr = 'X'.repeat(1200);
  const sanitizedLong = sanitize(longStr);
  assert.equal(sanitizedLong.length, 1024);
  assert.ok(sanitizedLong.endsWith('...'));

  // 5. Normal strings trimmed
  assert.equal(sanitize('  MH12AB1234  '), 'MH12AB1234');
  assert.equal(sanitize(45.5), '45.5');
});

