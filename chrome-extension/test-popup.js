'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(`${__dirname}/popup.html`, 'utf8');
const ids = [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
const elements = Object.fromEntries(ids.map((id) => [id, {
  value: '', textContent: '', innerHTML: '', hidden: false, dataset: {},
  classList: { toggle() {} }, addEventListener(type, fn) { this[type] = fn; }
}]));
const saved = { 'lead:test': { id: 'test', lead: { customerName: 'Test' }, quote: { quoteType: 'fixed_price', amount: 0 }, state: 'pending_human_approval', savedAt: 'invalid' } };
const context = {
  document: { querySelector(selector) { return elements[selector.slice(1)] || null; }, querySelectorAll() { return []; } },
  chrome: { runtime: { getManifest: () => ({ version: 'test' }), sendMessage: async () => ({ ok: true }) }, storage: {
    local: { get: async (key) => key == null ? saved : {}, set: async () => {}, remove: async () => {} }, onChanged: { addListener() {} }
  } },
  CleaningQuoteEngine: { COMPANIES: {}, SERVICES: {}, calculateQuote: () => ({ status: 'missing_size' }) },
  CleaningCleanerAvailability: { storageKey: () => 'availability' },
  navigator: { clipboard: { writeText: async () => {} } }, window: { confirm: () => true },
  console, Intl, Date, Number, Object, String, Set, JSON, Promise, setTimeout, crypto: { randomUUID: () => 'test' }
};
vm.runInNewContext(fs.readFileSync(`${__dirname}/popup.js`, 'utf8'), context);
setImmediate(() => {
  assert.match(elements.reviews.innerHTML, /Copy message/);
  assert.match(elements.reviews.innerHTML, /\$0–\$0/);
  assert.match(elements.reviews.innerHTML, /Unknown date/);
  assert.doesNotMatch(html, /active-lead-service/);
  console.log('Popup initialization and saved quote checks passed.');
});
