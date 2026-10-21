/* global chrome */
'use strict';

const reviewsElement = document.querySelector('#reviews');
const summaryElement = document.querySelector('#summary');
const relayUrlElement = document.querySelector('#relay-url');
const relayTokenElement = document.querySelector('#relay-token');
const relayStatusElement = document.querySelector('#relay-status');
const prestoStatusElement = document.querySelector('#presto-status');
const prestoDebugOutput = document.querySelector('#presto-debug-output');
let prestoDebug = null;
let selectedFilter = 'pending_human_approval';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}
function date(value) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Unknown date';
}
function stateLabel(state) {
  return ({ pending_human_approval: 'Pending approval', approved: 'Approved', adjusted: 'Adjusted', discarded: 'Discarded' })[state] || state;
}
function renderPrestoDebug(response) {
  prestoDebug = {
    capturedAt: response.capturedAt,
    company: response.company,
    range: response.range,
    source: response.source,
    availability: {
      status: 'not_calculated',
      unavailableDays: null,
      reason: 'Requires the lead address and estimated duration.'
    },
    jobs: (response.jobs || []).map((job) => ({
      id: job.id,
      date: job.date,
      startTime: job.startTime,
      customerName: job.customerName,
      coordinates: job.coordinates,
      price: job.price
    })),
    events: response.debug || []
  };
  prestoDebugOutput.textContent = JSON.stringify(prestoDebug, null, 2);
}
function prestoStatus(response, restored = false) {
  const withCoordinates = (response.jobs || []).filter((job) => job.coordinates).length;
  const prefix = restored ? 'Last saved scan — ' : '';
  prestoStatusElement.textContent = `${prefix}${response.company?.name || 'Presto'}: ${(response.jobs || []).length} visible jobs read; ${withCoordinates} with route coordinates.`;
}
async function loadLastPrestoScan() {
  const snapshots = await chrome.storage.local.get(['prestoJobs:kacs', 'prestoJobs:jheys']);
  const latest = Object.values(snapshots)
    .filter((snapshot) => snapshot?.capturedAt && Array.isArray(snapshot.jobs))
    .sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt))[0];
  if (!latest) return;
  renderPrestoDebug(latest);
  prestoStatus(latest, true);
}
function result(review) {
  const quote = review.quote;
  if (quote.quoteType === 'time_only' && quote.estimatedHours) return `${quote.estimatedHours.minimum}–${quote.estimatedHours.maximum} hours`;
  if (quote.quoteType === 'fixed_price' && quote.amount) return `$${quote.priceRange?.minimum ?? quote.amount}–$${quote.priceRange?.maximum ?? quote.amount}`;
  return 'Manual review required';
}
function card(review) {
  const lead = review.lead || {};
  const quote = review.quote || {};
  const href = review.url || lead.url;
  return `<article class="review" data-id="${escapeHtml(review.id)}">
    <div class="card-header"><strong>${escapeHtml(lead.customerName || 'Client name unavailable')}</strong><span class="state ${review.state}">${stateLabel(review.state)}</span></div>
    <p class="company">${quote.company === 'kacs' ? 'KACS' : "Jhey's Cleaning"}</p>
    <p class="service">${escapeHtml(quote.serviceLabel || 'Service needs review')}</p>
    <p class="result">${result(review)}</p>
    <dl><div><dt>Source</dt><dd>${escapeHtml(lead.platform || 'Unknown')}</dd></div><div><dt>Size band</dt><dd>${quote.size?.band ? `Up to ${quote.size.band} sq. ft.` : 'Not resolved'}</dd></div><div><dt>Saved</dt><dd>${escapeHtml(date(review.savedAt))}</dd></div></dl>
    <div class="actions">
      ${href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">Open lead</a>` : ''}
      ${review.state === 'pending_human_approval' ? '<button data-state="approved">Approve</button><button data-state="adjusted">Mark adjusted</button><button class="quiet" data-state="discarded">Discard</button>' : ''}
    </div>
  </article>`;
}
async function loadReviews() {
  const records = await chrome.storage.local.get(null);
  const reviews = Object.entries(records).filter(([key]) => key.startsWith('lead:')).map(([, value]) => value)
    .sort((a, b) => new Date(b.updatedAt || b.savedAt) - new Date(a.updatedAt || a.savedAt));
  const visible = selectedFilter === 'all' ? reviews : reviews.filter((review) => review.state === selectedFilter);
  summaryElement.textContent = selectedFilter === 'all' ? `${reviews.length} saved lead${reviews.length === 1 ? '' : 's'}` : `${visible.length} pending approval`;
  reviewsElement.innerHTML = visible.length ? visible.map(card).join('') : '<p class="empty">No leads in this queue.</p>';
}
reviewsElement.addEventListener('click', async (event) => {
  const state = event.target.dataset.state;
  const reviewCard = event.target.closest('[data-id]');
  if (!state && reviewCard && !event.target.closest('button, a')) {
    const records = await chrome.storage.local.get(`lead:${reviewCard.dataset.id}`);
    const review = records[`lead:${reviewCard.dataset.id}`];
    if (!review) return;
    try {
      await navigator.clipboard.writeText(CleaningQuoteMessages.approvedMessage(review));
      summaryElement.textContent = 'Message copied to clipboard.';
    } catch {
      summaryElement.textContent = 'Could not copy the message.';
    }
    return;
  }
  if (!state) return;
  const id = event.target.closest('[data-id]')?.dataset.id;
  if (!id) return;
  event.target.disabled = true;
  const response = await chrome.runtime.sendMessage({ type: 'UPDATE_REVIEW_STATE', id, state });
  if (!response?.ok) event.target.disabled = false;
  await loadReviews();
});
document.querySelector('#refresh').addEventListener('click', loadReviews);
document.querySelector('#clear-queue').addEventListener('click', async (event) => {
  const records = await chrome.storage.local.get(null);
  const keys = Object.keys(records).filter((key) => key.startsWith('lead:'));
  if (!keys.length) {
    summaryElement.textContent = 'The queue is already empty.';
    return;
  }
  if (!window.confirm(`Clear all ${keys.length} saved lead${keys.length === 1 ? '' : 's'} from the local queue? This cannot be undone.`)) return;
  event.target.disabled = true;
  try {
    await chrome.storage.local.remove(keys);
    await loadReviews();
    summaryElement.textContent = `${keys.length} saved lead${keys.length === 1 ? '' : 's'} removed from the local queue.`;
  } catch {
    summaryElement.textContent = 'Could not clear the local queue.';
  } finally {
    event.target.disabled = false;
  }
});
document.querySelectorAll('.filter').forEach((button) => button.addEventListener('click', () => {
  selectedFilter = button.dataset.filter;
  document.querySelectorAll('.filter').forEach((item) => item.classList.toggle('active', item === button));
  loadReviews();
}));
async function loadRelaySettings() {
  const { routeRelay } = await chrome.storage.local.get('routeRelay');
  relayUrlElement.value = routeRelay?.url || 'https://cleaning-route-relay.jvnonno54.workers.dev';
  relayTokenElement.value = routeRelay?.token || '';
}
document.querySelector('#save-relay').addEventListener('click', async () => {
  const url = relayUrlElement.value.trim().replace(/\/+$/, '');
  const token = relayTokenElement.value.trim();
  if (!/^https:\/\/[\w.-]+\.workers\.dev$/i.test(url) || !token) {
    relayStatusElement.textContent = 'Enter a valid Workers URL and extension token.';
    return;
  }
  await chrome.storage.local.set({ routeRelay: { url, token } });
  relayStatusElement.textContent = 'Relay configuration saved locally.';
});
document.querySelector('#toggle-relay-token').addEventListener('click', (event) => {
  const hidden = relayTokenElement.type === 'password';
  relayTokenElement.type = hidden ? 'text' : 'password';
  event.target.textContent = hidden ? 'Hide token' : 'Show token';
});
document.querySelector('#copy-relay-token').addEventListener('click', async () => {
  const token = relayTokenElement.value;
  if (!token) {
    relayStatusElement.textContent = 'No token is saved in this Chrome profile.';
    return;
  }
  try {
    await navigator.clipboard.writeText(token);
    relayStatusElement.textContent = 'Extension token copied to clipboard.';
  } catch {
    relayStatusElement.textContent = 'Could not copy the extension token.';
  }
});
document.querySelector('#test-relay').addEventListener('click', async (event) => {
  event.target.disabled = true;
  relayStatusElement.textContent = 'Testing…';
  const response = await chrome.runtime.sendMessage({ type: 'TEST_ROUTE_RELAY' });
  relayStatusElement.textContent = response?.ok ? 'Connection confirmed.' : response?.error || 'Connection failed.';
  event.target.disabled = false;
});
document.querySelector('#scan-presto').addEventListener('click', async (event) => {
  event.target.disabled = true;
  prestoStatusElement.textContent = 'Reading visible schedule and job details…';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https:\/\/app\.bepresto\.com\//.test(tab.url || '')) throw new Error('Open the Presto calendar tab first.');
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'SCAN_PRESTO_JOBS' });
    if (!response?.ok) throw new Error(response?.error || 'Could not read the job cards.');
    if (!response.company?.key) throw new Error(`Company not recognized${response.company?.name ? `: ${response.company.name}` : ''}.`);
    await chrome.storage.local.set({ [`prestoJobs:${response.company.key}`]: response });
    renderPrestoDebug(response);
    prestoStatus(response);
  } catch (error) {
    prestoStatusElement.textContent = error.message || 'Could not read job details.';
  } finally {
    event.target.disabled = false;
  }
});
document.querySelector('#copy-presto-debug').addEventListener('click', async () => {
  if (!prestoDebug) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(prestoDebug, null, 2));
    prestoStatusElement.textContent = 'Presto debug copied to clipboard.';
  } catch {
    prestoStatusElement.textContent = 'Could not copy Presto debug.';
  }
});
loadReviews();
loadRelaySettings();
loadLastPrestoScan();
