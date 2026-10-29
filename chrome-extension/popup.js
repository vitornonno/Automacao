/* global chrome, CleaningXlsxImporter, CleaningCleanerAvailability */
'use strict';

const reviewsElement = document.querySelector('#reviews');
const summaryElement = document.querySelector('#summary');
const relayUrlElement = document.querySelector('#relay-url');
const relayTokenElement = document.querySelector('#relay-token');
const relayStatusElement = document.querySelector('#relay-status');
const prestoStatusElement = document.querySelector('#presto-status');
const prestoDebugOutput = document.querySelector('#presto-debug-output');
let prestoDebug = null;
let selectedFilter = 'all';
const activeLeadServiceElement = document.querySelector('#active-lead-service');
const activeLeadServiceStatusElement = document.querySelector('#active-lead-service-status');
const checkUpdateButton = document.querySelector('#check-update');
const updateStatusElement = document.querySelector('#update-status');
const UPDATE_STATE_KEY = 'extensionUpdateStatus';

function showUpdateStatus(status) {
  const version = chrome.runtime.getManifest().version;
  updateStatusElement.textContent = status?.message || `Versão instalada: ${version}.`;
}

chrome.storage.local.get(UPDATE_STATE_KEY)
  .then((records) => showUpdateStatus(records[UPDATE_STATE_KEY]))
  .catch(() => showUpdateStatus(null));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[UPDATE_STATE_KEY]) showUpdateStatus(changes[UPDATE_STATE_KEY].newValue);
});
checkUpdateButton.addEventListener('click', async () => {
  checkUpdateButton.disabled = true;
  updateStatusElement.textContent = 'Verificando atualizações…';
  try {
    const response = await chrome.runtime.sendMessage({ type: 'CHECK_EXTENSION_UPDATE' });
    if (!response?.ok) updateStatusElement.textContent = response?.error || 'Não foi possível iniciar a verificação.';
  } catch {
    // The popup is closed by runtime.reload after a successful update. Its
    // result is saved in chrome.storage and remains visible on next opening.
    const records = await chrome.storage.local.get(UPDATE_STATE_KEY).catch(() => ({}));
    showUpdateStatus(records[UPDATE_STATE_KEY] || { message: 'Não foi possível iniciar a verificação.' });
  } finally {
    checkUpdateButton.disabled = false;
  }
});

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
      price: job.price,
      cleaners: job.cleaners || []
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
  const snapshots = await chrome.storage.local.get(Object.keys(CleaningQuoteEngine.COMPANIES).map((company) => `prestoJobs:${company}`));
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
    <p class="company">${CleaningQuoteEngine.COMPANIES[quote.company]?.name || 'Unknown company'}</p>
    <p class="service">${escapeHtml(quote.serviceLabel || 'Service needs review')}</p>
    <p class="result">${result(review)}</p>
    <dl><div><dt>Source</dt><dd>${escapeHtml(lead.platform || 'Unknown')}</dd></div><div><dt>Size band</dt><dd>${quote.size?.band ? `Up to ${quote.size.band} sq. ft.` : 'Not resolved'}</dd></div><div><dt>Saved</dt><dd>${escapeHtml(date(review.savedAt))}</dd></div></dl>
    <div class="actions">
      ${href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">Open lead</a>` : ''}
      ${review.state === 'pending_human_approval' ? '<button data-state="approved">Approve</button><button data-state="adjusted">Mark adjusted</button><button class="quiet" data-state="discarded">Discard</button>' : ''}
      <button class="quiet" data-remove-lead="true">Remove</button>
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
  if (event.target.dataset.removeLead && reviewCard) {
    const id = reviewCard.dataset.id;
    const name = reviewCard.querySelector('strong')?.textContent || 'this lead';
    if (!window.confirm(`Remove ${name} from the local queue? This cannot be undone.`)) return;
    event.target.disabled = true;
    try {
      await chrome.storage.local.remove(`lead:${id}`);
      await loadReviews();
      summaryElement.textContent = `${name} removed from the local queue.`;
    } catch {
      summaryElement.textContent = 'Could not remove this lead from the local queue.';
      event.target.disabled = false;
    }
    return;
  }
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
activeLeadServiceElement.addEventListener('change', async () => {
  const serviceId = activeLeadServiceElement.value;
  if (!serviceId) return;
  activeLeadServiceElement.disabled = true;
  activeLeadServiceStatusElement.textContent = 'Applying to the active Yelp lead…';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https:\/\/biz\.yelp\.com(?:\.br)?\/leads_center\//.test(tab.url || '')) throw new Error('Open the target Yelp lead tab first.');
    const leadId = tab.url.match(/\/leads\/([^/?#]+)/)?.[1];
    if (!leadId) throw new Error('Could not identify the current Yelp lead.');
    await chrome.storage.local.set({ [`manualServiceOverride:yelp:${leadId}`]: { serviceId, updatedAt: Date.now() } });
    // Message the current content script immediately. The saved value remains
    // as a reliable fallback while Yelp is re-rendering the lead page.
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'SET_ACTIVE_LEAD_SERVICE', serviceId });
    if (!response?.ok) throw new Error(response?.error || 'The lead could not accept the selected cleaning type.');
    activeLeadServiceStatusElement.textContent = `${serviceId === 'move_in' ? 'Move-in' : 'Move-out'} applied to the active lead.`;
  } catch (error) {
    activeLeadServiceStatusElement.textContent = error.message || 'Could not apply the service type.';
  } finally {
    activeLeadServiceElement.disabled = false;
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

const cleanerAvailabilityCompanyElement = document.querySelector('#cleaner-availability-company');
const cleanerAvailabilityYearElement = document.querySelector('#cleaner-availability-year');
const cleanerAvailabilityFileElement = document.querySelector('#cleaner-availability-file');
const cleanerAvailabilityStatusElement = document.querySelector('#cleaner-availability-status');

function cleanerAvailabilityLabel(config) {
  if (!config?.windows?.length) return 'No cleaner availability schedule imported.';
  const cleaners = [...new Set(config.windows.map((window) => window.cleaner))];
  const dates = config.windows.map((window) => window.day).sort();
  return `${config.windows.length} availability window${config.windows.length === 1 ? '' : 's'} imported for ${cleaners.join(', ')} (${dates[0]} to ${dates.at(-1)}).`;
}
async function loadCleanerAvailabilityStatus() {
  const company = cleanerAvailabilityCompanyElement.value;
  const key = CleaningCleanerAvailability.storageKey(company);
  const stored = await chrome.storage.local.get(key);
  cleanerAvailabilityStatusElement.textContent = cleanerAvailabilityLabel(stored[key]);
}
cleanerAvailabilityYearElement.value = String(new Date().getFullYear());
cleanerAvailabilityCompanyElement.addEventListener('change', loadCleanerAvailabilityStatus);
document.querySelector('#import-cleaner-availability').addEventListener('click', async (event) => {
  const file = cleanerAvailabilityFileElement.files?.[0];
  if (!file) {
    cleanerAvailabilityStatusElement.textContent = 'Choose an Excel schedule first.';
    return;
  }
  event.target.disabled = true;
  cleanerAvailabilityStatusElement.textContent = 'Importing cleaner availability…';
  try {
    const company = cleanerAvailabilityCompanyElement.value;
    const config = await CleaningXlsxImporter.parseCleanerAvailabilityWorkbook(await file.arrayBuffer(), {
      company,
      year: Number(cleanerAvailabilityYearElement.value) || new Date().getFullYear()
    });
    config.sourceFileName = file.name;
    await chrome.storage.local.set({ [CleaningCleanerAvailability.storageKey(company)]: config });
    cleanerAvailabilityStatusElement.textContent = cleanerAvailabilityLabel(config);
    cleanerAvailabilityFileElement.value = '';
  } catch (error) {
    cleanerAvailabilityStatusElement.textContent = error.message || 'Could not import that Excel schedule.';
  } finally {
    event.target.disabled = false;
  }
});
document.querySelector('#clear-cleaner-availability').addEventListener('click', async () => {
  const company = cleanerAvailabilityCompanyElement.value;
  if (!window.confirm(`Clear the imported cleaner availability for ${company.toUpperCase()}?`)) return;
  await chrome.storage.local.remove(CleaningCleanerAvailability.storageKey(company));
  cleanerAvailabilityFileElement.value = '';
  await loadCleanerAvailabilityStatus();
});

const manualQuoteElement = document.querySelector('#manual-quote');
const manualSummaryElement = document.querySelector('#manual-quote-summary');
const manualAvailabilityElement = document.querySelector('#manual-availability');
const manualFields = {
  company: document.querySelector('#manual-company'), name: document.querySelector('#manual-name'),
  service: document.querySelector('#manual-service'), squareFeet: document.querySelector('#manual-square-feet'),
  bedrooms: document.querySelector('#manual-bedrooms'), bathrooms: document.querySelector('#manual-bathrooms'),
  discount: document.querySelector('#manual-discount'),
  location: document.querySelector('#manual-location'), extraServices: document.querySelector('#manual-extra-services'),
  products: document.querySelector('#manual-products')
};
let manualAvailability = null;
let selectedManualAvailability = new Set();
const MANUAL_DRAFT_KEY = 'manualQuoteDraft';

function manualLead() {
  const company = manualFields.company.value;
  return {
    id: `manual:${crypto.randomUUID()}`,
    platform: 'manual',
    companyName: CleaningQuoteEngine.COMPANIES[company]?.name || null,
    customerName: manualFields.name.value.trim() || null,
    serviceType: CleaningQuoteEngine.SERVICES[manualFields.service.value],
    squareFeet: manualFields.squareFeet.value.trim() || null,
    bedrooms: manualFields.bedrooms.value.trim() || null,
    bathrooms: manualFields.bathrooms.value.trim() || null,
    location: manualFields.location.value.trim() || null,
    extraServices: manualFields.extraServices.value.trim() || null,
    cleaningProducts: manualFields.products.value.trim() || null
  };
}
function manualQuote() { return CleaningQuoteEngine.calculateQuote(manualLead(), { companyOverride: manualFields.company.value, discountPercent: manualFields.discount.value.trim() }); }
function manualDuration(quote) {
  if (quote.estimatedHours) return Math.round(quote.estimatedHours.maximum * 60);
  const hours = Number(quote.priceRange?.maximum || quote.amount || 0) / 100;
  return Math.round(Math.ceil(hours * 2) / 2 * 60);
}
function manualClock(value) { const hour = Math.floor(value / 60); const minute = value % 60; return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`; }
function manualDate(value) { return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${value}T12:00:00`)); }
function manualKey(item) { return `${item.day}|${item.start}|${item.cleaner || 'rafael'}`; }
function manualPriceDuration(price, company) {
  const hours = Number(price || 0) / 100;
  return Math.round((company === 'kacs' ? CleaningQuoteEngine.roundToNearestHalfHour(hours) : Math.ceil(hours * 2) / 2) * 60);
}
function manualQuoteDescription(quote) {
  if (quote.status === 'ready_for_review' && quote.estimatedHours) return `${quote.estimatedHours.minimum}–${quote.estimatedHours.maximum} hours · KACS hourly estimate`;
  if (quote.status === 'ready_for_review') {
    const duration = manualDuration(quote);
    return `$${quote.priceRange.minimum}–$${quote.priceRange.maximum} · preliminary estimate\nEstimated cleaning time: ${duration > 0 ? `${duration / 60} hours` : 'unavailable'} (used for availability)`;
  }
  if (quote.status === 'missing_size') return 'Size details needed — a request-for-details message can still be copied.';
  return quote.reason || 'Complete the details needed for this quote.';
}
function renderManualQuote() {
  const quote = manualQuote();
  manualSummaryElement.textContent = manualQuoteDescription(quote);
  if (!manualAvailability) manualAvailabilityElement.innerHTML = '';
  return quote;
}
function resetManualAvailability() {
  manualAvailability = null;
  selectedManualAvailability = new Set();
  renderManualQuote();
}
async function saveManualDraft() {
  const draft = Object.fromEntries(Object.entries(manualFields).map(([key, field]) => [key, field.value]));
  await chrome.storage.local.set({ [MANUAL_DRAFT_KEY]: draft });
}
async function loadManualDraft() {
  const stored = await chrome.storage.local.get(MANUAL_DRAFT_KEY);
  const draft = stored[MANUAL_DRAFT_KEY];
  if (!draft) return;
  Object.entries(manualFields).forEach(([key, field]) => { if (typeof draft[key] === 'string') field.value = draft[key]; });
}
function manualRelay(message, timeoutMs = 15000) {
  return Promise.race([
    chrome.runtime.sendMessage(message),
    new Promise((_, reject) => setTimeout(() => reject(new Error('The route relay did not respond in time. Check the relay settings and try again.')), timeoutMs))
  ]);
}
function manualSelectedSlots() {
  if (!manualAvailability?.options) return [];
  return manualAvailability.options.filter((slot) => selectedManualAvailability.has(manualKey(slot))).map((slot) => ({ day: slot.day, start: slot.start, duration: manualAvailability.duration }));
}
function renderManualAvailability() {
  if (!manualAvailability) return;
  if (manualAvailability.error) {
    manualAvailabilityElement.innerHTML = `<p class="manual-availability-note">${escapeHtml(manualAvailability.error)}</p>`;
    return;
  }
  if (!manualAvailability.options.length) {
    manualAvailabilityElement.innerHTML = `<p class="manual-location-confirmed">Location confirmed: ${escapeHtml(manualAvailability.approximateLocation)}</p><p class="manual-availability-note">No compatible openings were found in the scanned schedule. The copied message will request the client’s preferred day and time.</p>`;
    return;
  }
  manualAvailabilityElement.innerHTML = `<p class="manual-location-confirmed">Location confirmed: ${escapeHtml(manualAvailability.approximateLocation)}</p>${manualAvailability.options.map((slot) => {
    const key = manualKey(slot);
    return `<label class="manual-slot"><input type="checkbox" data-manual-availability="${escapeHtml(key)}" ${selectedManualAvailability.has(key) ? 'checked' : ''}><span><strong>${manualDate(slot.day)} · ${manualClock(slot.start)}–${manualClock(slot.start + 30)}</strong><small>Estimated end: ${manualClock(slot.start + manualAvailability.duration)}${slot.cleaner ? ` · Team: ${escapeHtml(slot.cleaner)}` : ''}</small></span></label>`;
  }).join('')}`;
}
async function manualRouteMinutes(origin, destination) {
  const response = await manualRelay({ type: 'ROUTE_RELAY_REQUEST', request: { origin, destination } });
  if (!response?.ok) throw new Error(response?.error || 'Route lookup failed.');
  return Math.ceil(response.route.durationSeconds / 60);
}
async function findManualAvailability() {
  const quote = manualQuote();
  const lead = manualLead();
  const inputSnapshot = JSON.stringify(Object.fromEntries(Object.entries(manualFields).map(([key, field]) => [key, field.value])));
  if (quote.status !== 'ready_for_review') throw new Error('Complete a supported service and home size before finding availability.');
  if (!lead.location) throw new Error('Enter the service address or locality first.');
  const saved = await chrome.storage.local.get(`prestoJobs:${quote.company}`);
  const snapshot = saved[`prestoJobs:${quote.company}`];
  if (!snapshot?.jobs?.length) throw new Error('Read this company’s Presto schedule first.');
  if (!CleaningCleanerAvailability.isCurrentSnapshot(snapshot)) throw new Error('The Presto scan is outdated. Read the current schedule again.');
  const geocode = await manualRelay({ type: 'GEOCODE_RELAY_REQUEST', query: lead.location, region: 'california' });
  if (!geocode?.ok) throw new Error(geocode?.error || 'Could not locate that address.');
  const destination = geocode.location;
  const duration = manualDuration(quote);
  const availabilityKey = CleaningCleanerAvailability.storageKey(quote.company);
  const importedAvailability = (await chrome.storage.local.get(availabilityKey))[availabilityKey];
  const byDay = Object.groupBy(snapshot.jobs, (job) => job.date);
  const cleaners = [...new Set(snapshot.jobs.flatMap((job) => Array.isArray(job.cleaners) ? job.cleaners : []).filter(Boolean))];
  // These companies have one operational route for quoting availability.
  // Do not treat a secondary/helper assignment as an independent team.
  const primaryCleaner = { kacs: 'Rafael', jheys: 'Jheyce' }[quote.company] || null;
  const scheduleCleaners = primaryCleaner ? [primaryCleaner] : cleaners;
  const workdayStart = CleaningCleanerAvailability.DAY_START;
  if (!scheduleCleaners.length) throw new Error('This Presto scan has no cleaner assignments. Reload the extension and read the schedule again.');
  const startDate = new Date(`${snapshot.range.start}T12:00:00Z`);
  const endDate = new Date(`${snapshot.range.end}T12:00:00Z`);
  const options = [];
  const totalDays = Math.round((endDate - startDate) / 86400000) + 1;
  let currentDay = 0;
  for (let cursor = new Date(startDate); cursor <= endDate; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    currentDay += 1;
    manualAvailabilityElement.innerHTML = `<p class="manual-location-confirmed">Location confirmed: ${escapeHtml(destination.label)}</p><p class="manual-availability-note">Calculating availability… ${currentDay} of ${totalDays} days checked.</p>`;
    const day = cursor.toISOString().slice(0, 10);
    if (day <= CleaningCleanerAvailability.todayInCalifornia()) continue;
    if (new Date(`${day}T12:00:00`).getDay() === 0) continue;
    const dayJobs = byDay[day] || [];
    options.push(...CleaningCleanerAvailability.safeImportedSlots(importedAvailability, day, duration, dayJobs));
    const scheduledJobs = primaryCleaner
      ? dayJobs.filter((job) => !Array.isArray(job.cleaners) || !job.cleaners.length || job.cleaners.includes(primaryCleaner))
      : dayJobs;
    if (scheduledJobs.some((job) => !job.coordinates || !Number.isFinite(job.price) || !job.startTime || !Array.isArray(job.cleaners) || !job.cleaners.length)) continue;
    const cleaner = primaryCleaner
      ? primaryCleaner
      : [...scheduleCleaners].sort((left, right) => dayJobs.filter((job) => job.cleaners.includes(left)).length - dayJobs.filter((job) => job.cleaners.includes(right)).length)[0];
    const jobs = scheduledJobs.filter((job) => job.cleaners.includes(cleaner)).sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
    for (let index = 0; index <= jobs.length; index += 1) {
      const previous = jobs[index - 1]; const next = jobs[index];
      let start = workdayStart;
      if (previous) {
        const [hour, minute] = previous.startTime.split(':').map(Number);
        start = Math.max(workdayStart, hour * 60 + minute + manualPriceDuration(previous.price, quote.company) + 30 + await manualRouteMinutes(previous.coordinates, destination));
      }
      start = Math.ceil(start / 30) * 30;
      if (start + duration > 1140) continue;
      if (next) {
        const [hour, minute] = next.startTime.split(':').map(Number);
        const arrival = start + duration + 30 + await manualRouteMinutes(destination, next.coordinates);
        if (arrival > hour * 60 + minute) continue;
      }
      options.push({ day, start, cleaner });
      break;
    }
  }
  options.sort((left, right) => left.day.localeCompare(right.day) || left.start - right.start || String(left.cleaner).localeCompare(String(right.cleaner)));
  if (inputSnapshot !== JSON.stringify(Object.fromEntries(Object.entries(manualFields).map(([key, field]) => [key, field.value])))) throw new Error('Quote details changed. Search availability again.');
  manualAvailability = { options, duration, compatibleTotal: options.length, approximateLocation: destination.label };
  selectedManualAvailability = new Set(options.slice(0, 3).map(manualKey));
}

document.querySelector('#manual-quote-toggle').addEventListener('click', () => {
  manualQuoteElement.hidden = !manualQuoteElement.hidden;
  if (!manualQuoteElement.hidden) renderManualQuote();
});
Object.values(manualFields).forEach((field) => {
  const changed = () => { resetManualAvailability(); saveManualDraft(); };
  field.addEventListener('input', changed);
  field.addEventListener('change', changed);
});
manualAvailabilityElement.addEventListener('change', (event) => {
  const key = event.target.dataset.manualAvailability;
  if (!key) return;
  if (event.target.checked) selectedManualAvailability.add(key); else selectedManualAvailability.delete(key);
});
document.querySelector('#manual-find-availability').addEventListener('click', async (event) => {
  event.target.disabled = true;
  manualAvailability = null;
  manualAvailabilityElement.innerHTML = '<p class="manual-availability-note">Calculating availability…</p>';
  try {
    await findManualAvailability();
  } catch (error) {
    manualAvailability = { error: error.message || 'Could not calculate availability.' };
  } finally {
    renderManualAvailability();
    event.target.disabled = false;
  }
});
document.querySelector('#manual-copy-message').addEventListener('click', async () => {
  const lead = manualLead(); const quote = manualQuote();
  const review = {
    id: lead.id, lead, quote, state: 'manual',
    availability: manualSelectedSlots(),
    availabilitySearch: manualAvailability && !manualAvailability.error ? { compatibleTotal: manualAvailability.compatibleTotal } : null
  };
  try {
    await navigator.clipboard.writeText(CleaningQuoteMessages.approvedMessage(review));
    manualSummaryElement.textContent = 'Quote message copied to clipboard.';
  } catch {
    manualSummaryElement.textContent = 'Could not copy the quote message.';
  }
});
loadReviews();
loadRelaySettings();
loadLastPrestoScan();
loadCleanerAvailabilityStatus();
loadManualDraft().then(renderManualQuote);
