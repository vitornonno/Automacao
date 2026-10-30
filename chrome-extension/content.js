/* global CleaningLeadExtractor, CleaningQuoteEngine, CleaningCleanerAvailability, chrome */
(function contentModule() {
  'use strict';

  const BUILD_VERSION = '0.1.37';
  let companyOverride = null;
  let discountPercent = '';
  let lead = null;
  let originalServiceType = null;
  let quote = null;
  let queueMode = false;
  let queueReviews = new Map();
  let queueFeedback = '';
  let activeRoute = null;
  let queuedRoute = null;
  let debugEvents = [];
  let debugVisible = false;
  let debugCopyFeedback = '';
  let missingServiceRetry = null;
  let existingReview = null;
  let availability = null;
  let selectedAvailability = new Set();
  let serviceChangeInFlight = false;
  let lastManualServiceValue = '';
  let manualServiceOverride = null;
  let manualServiceOverrideLeadId = null;
  let lastStoredManualOverride = null;
  let confirmationFeedback = '';
  let requestedDetails = new Set();
  let detailsRequestOpen = false;
  let panelEdited = false;
  const servicePickerNonce = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

  function manualServiceOverrideKey(leadId) {
    return leadId ? `manualServiceOverride:${leadId}` : null;
  }

  function logDebug(event, detail = {}) {
    debugEvents = [{ at: new Date().toLocaleTimeString(), event, detail }, ...debugEvents].slice(0, 60);
  }
  function captureSnapshot(currentLead, currentQuote) {
    return {
      buildVersion: BUILD_VERSION,
      route: currentRoute(),
      activeRoute,
      queuedRoute,
      lead: currentLead ? {
        captureSource: currentLead.captureSource,
        companyName: currentLead.companyName,
        customerName: currentLead.customerName,
        serviceType: currentLead.serviceType,
        frequency: currentLead.frequency,
        squareFeet: currentLead.squareFeet,
        bedrooms: currentLead.bedrooms,
        bathrooms: currentLead.bathrooms,
        cleaningProducts: currentLead.cleaningProducts,
        extraServices: currentLead.extraServices
      } : null,
      quote: currentQuote ? {
        status: currentQuote.status,
        service: currentQuote.service,
        size: currentQuote.size,
        company: currentQuote.company,
        discount: currentQuote.discount || null,
        recurringCleaning: currentQuote.recurringCleaning || null
      } : null,
      discountInput: { percentage: discountPercent || null, appliesTo: currentQuote?.service || null },
      manualCleaningTypeControl: {
        displayedValue: root.querySelector?.('[data-field="serviceType"]')?.value || manualServiceOverride || null,
        lastObservedValue: lastManualServiceValue || null,
        recalculationInFlight: serviceChangeInFlight,
        storedOverride: manualServiceOverride || null,
        storageKey: manualServiceOverrideKey(currentLead?.id)
      },
      existingReview: existingReview ? { state: existingReview.state, savedAt: existingReview.savedAt, updatedAt: existingReview.updatedAt } : null,
      events: debugEvents
    };
  }
  function debugMarkup() {
    if (!debugVisible) return '';
    return `<section class="debug"><strong>Verbose debug</strong><br><button type="button" data-action="copy-debug">Copy debug</button><small role="status" aria-live="polite">${escapeHtml(debugCopyFeedback)}</small><pre>${escapeHtml(JSON.stringify(captureSnapshot(lead, quote), null, 2))}</pre></section>`;
  }

  const root = document.createElement('aside');
  root.id = 'cleaning-quote-assistant';
  function mountRoot() {
    // Keep the assistant inside the document body. Yelp installs global event
    // handling around its application root; mounting beside it under <html>
    // made native controls visually change without consistently delivering
    // their events to this content script.
    const container = document.body || document.documentElement;
    if (root.parentElement !== container) container.append(root);
  }
  let panelDrag = null;
  root.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('header') || event.target.closest('button')) return;
    const rect = root.getBoundingClientRect();
    panelDrag = { offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
    root.style.left = `${rect.left}px`;
    root.style.top = `${rect.top}px`;
    root.style.right = 'auto';
    event.preventDefault();
  });
  window.addEventListener('pointermove', (event) => {
    if (!panelDrag) return;
    const maxLeft = Math.max(0, window.innerWidth - root.offsetWidth);
    const maxTop = Math.max(0, window.innerHeight - root.offsetHeight);
    root.style.left = `${Math.min(maxLeft, Math.max(0, event.clientX - panelDrag.offsetX))}px`;
    root.style.top = `${Math.min(maxTop, Math.max(0, event.clientY - panelDrag.offsetY))}px`;
  });
  window.addEventListener('pointerup', () => { panelDrag = null; });

  function currentRoute() { return `${location.origin}${location.pathname}${location.search}`; }
  function reviewKey(leadId) { return leadId ? `lead:${leadId}` : null; }
  function validReview(review) {
    return Boolean(review && typeof review.id === 'string' && review.lead && review.quote && ['approved', 'adjusted', 'pending_human_approval', 'discarded'].includes(review.state));
  }
  function isYelpLeadPage() {
    return /(^|\.)yelp\.com(\.br)?$/i.test(location.hostname)
      && /^\/leads_center\/[^/]+\/leads\/[^/?#]+/.test(location.pathname);
  }
  function refreshLeadPanel(force = false) {
    const route = currentRoute();
    if (!isYelpLeadPage()) {
      activeRoute = route;
      root.remove();
      return;
    }
    if (!force && route === activeRoute && root.isConnected) return;
    if (force && route === activeRoute && panelEdited && root.isConnected) return;
    activeRoute = route;
    companyOverride = null;
    discountPercent = '';
    queueMode = false;
    queueFeedback = '';
    existingReview = null;
    availability = null;
    selectedAvailability = new Set();
    confirmationFeedback = '';
    lead = CleaningLeadExtractor.extractLead();
    if (manualServiceOverrideLeadId && manualServiceOverrideLeadId !== lead?.id) {
      manualServiceOverride = null;
      manualServiceOverrideLeadId = null;
    }
    originalServiceType = lead?.serviceType || null;
    if (manualServiceOverride && lead?.id === manualServiceOverrideLeadId) applyManualServiceType(manualServiceOverride);
    requestedDetails = new Set(['squareFeet', 'bedrooms', 'bathrooms'].filter((field) => !String(lead?.[field] || '').trim()));
    detailsRequestOpen = false;
    quote = CleaningQuoteEngine.calculateQuote(lead, { discountPercent });
    logDebug('Capture attempt', captureSnapshot(lead, quote).lead || {});
    if (!root.isConnected) mountRoot();
    render();
    loadExistingReview(route, lead?.id);
    restoreStoredManualServiceOverride(route, lead?.id);
    ensureCleaningType(route);
  }

  async function restoreStoredManualServiceOverride(route, leadId) {
    const key = manualServiceOverrideKey(leadId);
    if (!key) return;
    try {
      const stored = (await chrome.storage.local.get(key))[key];
      if (currentRoute() !== route || lead?.id !== leadId || !stored?.serviceId || !CleaningQuoteEngine.INITIAL_LEAD_SERVICE_IDS.includes(stored.serviceId)) return;
      const revision = `${stored.serviceId}:${stored.updatedAt || ''}`;
      if (revision === lastStoredManualOverride) return;
      lastStoredManualOverride = revision;
      logDebug('Stored manual cleaning type restored', { selected: stored.serviceId });
      await recalculate({ serviceId: stored.serviceId });
    } catch {
      // The native selector remains available if local storage cannot be read.
    }
  }
  async function loadExistingReview(route, leadId) {
    const key = reviewKey(leadId);
    if (!key) return;
    const records = await chrome.storage.local.get(key);
    if (currentRoute() !== route || lead?.id !== leadId) return;
    existingReview = validReview(records[key]) ? records[key] : null;
    if (records[key] && !existingReview) logDebug('Incomplete saved review ignored', {});
    if (existingReview) logDebug('Existing lead review found', { state: existingReview.state, savedAt: existingReview.savedAt });
    render();
  }
  function ensureCleaningType(route) {
    clearTimeout(missingServiceRetry);
    if (CleaningQuoteEngine.resolveService(lead?.serviceType, lead?.frequency)) {
      logDebug('Cleaning type resolved', { service: quote?.service, source: lead?.captureSource });
      return;
    }
    logDebug('Cleaning type missing; retry scheduled', { delayMs: 750, serviceType: lead?.serviceType, frequency: lead?.frequency });
    missingServiceRetry = setTimeout(() => {
      if (currentRoute() !== route || !isYelpLeadPage()) return;
      const retryLead = CleaningLeadExtractor.extractLead();
      const retryQuote = CleaningQuoteEngine.calculateQuote(retryLead);
      logDebug('Cleaning type retry', captureSnapshot(retryLead, retryQuote).lead || {});
      if (CleaningQuoteEngine.resolveService(retryLead?.serviceType, retryLead?.frequency)) {
        lead = retryLead;
        originalServiceType = lead.serviceType || null;
        quote = retryQuote;
        logDebug('Cleaning type resolved after retry', { service: quote.service, source: lead.captureSource });
        render();
        loadExistingReview(route, lead.id);
        return;
      }
      ensureCleaningType(route);
    }, 750);
  }
  function scheduleLeadRefresh() {
    const routeAtNavigation = currentRoute();
    if (!isYelpLeadPage()) {
      activeRoute = routeAtNavigation;
      root.remove();
      return;
    }
    // Yelp may update only the URL fragment while interacting with a control.
    // currentRoute intentionally excludes that fragment, so there is no new
    // lead to capture in this case.
    if (routeAtNavigation === activeRoute && root.isConnected) return;
    if (queuedRoute === routeAtNavigation) return;
    queuedRoute = routeAtNavigation;
    panelEdited = false;
    activeRoute = routeAtNavigation;
    queueMode = false;
    quote = null;
    availability = null;
    selectedAvailability = new Set();
    confirmationFeedback = '';
    detailsRequestOpen = false;
    if (!root.isConnected) mountRoot();
    root.innerHTML = '<header><span>Lead estimate</span><button data-action="close" aria-label="Close">×</button></header><section class="result"><p><strong>Loading lead data…</strong><small>Waiting for Yelp to finish loading this lead.</small></p></section>';
    [3000, 4500, 6000].forEach((delay) => setTimeout(() => {
      if (currentRoute() === routeAtNavigation) refreshLeadPanel(true);
      if (delay === 6000 && queuedRoute === routeAtNavigation) queuedRoute = null;
    }, delay));
  }

  function formatHours(hours) { return Number.isInteger(hours) ? String(hours) : hours.toFixed(1); }
  function minutes(time) { const [hour, minute] = String(time).split(':').map(Number); return hour * 60 + minute; }
  function clock(value) { const hour = Math.floor(value / 60); const minute = value % 60; const suffix = hour >= 12 ? 'PM' : 'AM'; const shown = hour % 12 || 12; return `${shown}:${String(minute).padStart(2, '0')} ${suffix}`; }
  function ceilHalfHour(value) { return Math.ceil(value / 30) * 30; }
  function isSunday(date) { return new Date(`${date}T12:00:00`).getDay() === 0; }
  function dateRange(start, end) { const values = []; const date = new Date(`${start}T12:00:00Z`); const last = new Date(`${end}T12:00:00Z`); while (date <= last) { values.push(date.toISOString().slice(0, 10)); date.setUTCDate(date.getUTCDate() + 1); } return values; }
  function priceDurationMinutes(price) {
    const rawHours = Number(price || 0) / 100;
    const hours = quote?.company === 'kacs'
      ? CleaningQuoteEngine.roundToNearestHalfHour(rawHours)
      : Math.ceil(rawHours * 2) / 2;
    return Math.round(hours * 60);
  }
  function quoteDurationMinutes() { return quote?.estimatedHours ? Math.round(quote.estimatedHours.maximum * 60) : priceDurationMinutes(quote?.priceRange?.maximum || quote?.amount); }
  async function routeMinutes(origin, destination) { const response = await chrome.runtime.sendMessage({ type: 'ROUTE_RELAY_REQUEST', request: { origin, destination } }); if (!response?.ok) throw new Error(response?.error || 'Route lookup failed.'); return Math.ceil(response.route.durationSeconds / 60); }
  async function findAvailability() {
    const requestedRoute = currentRoute();
    const requestedLeadId = lead?.id;
    const requestedQuote = quote;
    availability = { status: 'loading' }; render();
    try {
      const availabilityStorageKey = CleaningCleanerAvailability.storageKey(quote.company);
      const saved = await chrome.storage.local.get([`prestoJobs:${quote.company}`, availabilityStorageKey]);
      const snapshot = saved[`prestoJobs:${quote.company}`];
      if (!snapshot?.jobs?.length) throw new Error('Read this company’s Presto schedule first.');
      if (!CleaningCleanerAvailability.isCurrentSnapshot(snapshot)) throw new Error('The Presto scan is outdated. Read the current schedule again.');
      if (!lead.location) throw new Error('Lead location is unavailable.');
      const geocode = await chrome.runtime.sendMessage({ type: 'GEOCODE_RELAY_REQUEST', query: lead.location });
      if (!geocode?.ok) throw new Error(geocode?.error || 'Could not locate the lead.');
        const destination = geocode.location; const duration = quoteDurationMinutes();
        if (!Number.isFinite(duration) || duration <= 0) throw new Error('A service duration or usable price is required to calculate availability.');
      const grouped = Object.groupBy(snapshot.jobs, (job) => job.date);
      const importedAvailability = saved[availabilityStorageKey];
      const cleaners = [...new Set(snapshot.jobs.flatMap((job) => Array.isArray(job.cleaners) ? job.cleaners : []).filter(Boolean))];
      // These companies have one operational route for quoting availability.
      // Do not treat a secondary/helper assignment as an independent team.
      const primaryCleaner = { kacs: 'Rafael', jheys: 'Jheyce' }[quote.company] || null;
      const scheduleCleaners = primaryCleaner ? [primaryCleaner] : cleaners;
      const workdayStart = CleaningCleanerAvailability.DAY_START;
      if (!scheduleCleaners.length) throw new Error('This Presto scan has no cleaner assignments. Reload the extension and read the schedule again.');
        const options = []; const unavailableDays = []; const availabilityDebug = [];
      for (const day of dateRange(snapshot.range.start, snapshot.range.end)) {
          // Same-day openings need a live clock and additional lead time; do not offer past slots.
          if (day <= CleaningCleanerAvailability.todayInCalifornia()) continue;
          if (isSunday(day)) {
            unavailableDays.push(day);
            availabilityDebug.push({ day, result: 'unavailable', reason: 'Sunday — service is not offered.' });
            continue;
          }
          const dayJobs = grouped[day] || [];
          const importedSlots = CleaningCleanerAvailability.safeImportedSlots(importedAvailability, day, duration, dayJobs);
          options.push(...importedSlots);
          const scheduledJobs = primaryCleaner
            ? dayJobs.filter((job) => !Array.isArray(job.cleaners) || !job.cleaners.length || job.cleaners.includes(primaryCleaner))
            : dayJobs;
          if (scheduledJobs.some((job) => !job.startTime || !job.coordinates || !Number.isFinite(job.price) || job.price <= 0 || !Array.isArray(job.cleaners) || !job.cleaners.length)) {
            if (!importedSlots.length) unavailableDays.push(day);
            availabilityDebug.push({ day, result: 'unavailable', reason: 'A Rafael job is missing a location, price, or cleaner assignment.' });
            continue;
          }
          const cleaner = primaryCleaner
            ? primaryCleaner
            : [...scheduleCleaners].sort((left, right) => dayJobs.filter((job) => job.cleaners.includes(left)).length - dayJobs.filter((job) => job.cleaners.includes(right)).length)[0];
          const jobs = scheduledJobs.filter((job) => job.cleaners.includes(cleaner)).sort((a, b) => minutes(a.startTime) - minutes(b.startTime));
        const candidates = [];
          if (!jobs.length) {
            candidates.push({ cleaner, start: workdayStart, previous: null, next: null });
            availabilityDebug.push({ day, cleaner, result: 'candidate', start: workdayStart, reason: 'No scheduled jobs for this cleaner; no between-job route is required.' });
            options.push({ day, cleaner, start: workdayStart, previous: null, next: null });
            continue;
          }
        for (let i = 0; i <= jobs.length; i += 1) {
          const previous = jobs[i - 1]; const next = jobs[i]; let start = workdayStart;
            let routeBefore = null; let routeAfter = null;
            let previousEnd = null; let previousDuration = null;
            if (previous) {
              previousDuration = priceDurationMinutes(previous.price);
              previousEnd = minutes(previous.startTime) + previousDuration;
              routeBefore = await routeMinutes(previous.coordinates, destination);
              start = Math.max(workdayStart, previousEnd + 30 + routeBefore);
            }
          start = ceilHalfHour(start);
            if (next) {
              routeAfter = await routeMinutes(destination, next.coordinates);
              const serviceEnd = start + duration;
              const after = serviceEnd + 30 + routeAfter;
              if (after > minutes(next.startTime)) {
                availabilityDebug.push({ day, result: 'rejected', start, serviceEnd, previousJob: previous?.customerName || null, nextJob: next.customerName, routeBefore, routeAfter, reason: `Would reach next job at ${clock(after)}; it starts at ${clock(minutes(next.startTime))}.` });
                continue;
              }
            }
            if (start + duration <= 1140) {
              candidates.push({
                cleaner,
                start,
                previous: previous ? { customerName: previous.customerName, startTime: previous.startTime, duration: previousDuration, end: previousEnd, travelToLead: routeBefore } : null,
                next: next ? { customerName: next.customerName, startTime: next.startTime, travelFromLead: routeAfter } : null
              });
              availabilityDebug.push({ day, cleaner, result: 'candidate', start, serviceEnd: start + duration, previousJob: previous?.customerName || null, nextJob: next?.customerName || null, routeBefore, routeAfter });
            } else {
              availabilityDebug.push({ day, result: 'rejected', start, previousJob: previous?.customerName || null, nextJob: next?.customerName || null, routeBefore, routeAfter, reason: 'Service would end after 7:00 PM.' });
            }
        }
          const first = candidates.sort((a, b) => a.start - b.start)[0]; if (first === undefined) { if (!importedSlots.length) unavailableDays.push(day); } else options.push({ day, ...first });
      }
        if (currentRoute() !== requestedRoute || lead?.id !== requestedLeadId || quote !== requestedQuote) return;
        options.sort((left, right) => left.day.localeCompare(right.day) || left.start - right.start || String(left.cleaner).localeCompare(String(right.cleaner)));
        const displayedOptions = options.slice(0, 3);
        const hiddenCompatibleOptions = options.slice(3);
        availability = { status: 'ready', approximateLocation: geocode.location.label, duration, options: displayedOptions, compatibleTotal: options.length, hiddenCompatibleOptions, unavailableDays, calculation: availabilityDebug };
        selectedAvailability = new Set(availability.options.map(availabilityKey));
        logDebug('Availability calculated', { company: snapshot.company?.name || quote.company, location: geocode.location.label, duration, options: availability.options, unavailableDays, calculation: availabilityDebug });
    } catch (error) { if (currentRoute() !== requestedRoute || lead?.id !== requestedLeadId || quote !== requestedQuote) return; availability = { status: 'error', error: error.message }; }
    render();
  }
  function displayQuote(result) {
    if (result.status === 'ready_for_review' && result.quoteType === 'time_only') {
      return `<strong>${formatHours(result.estimatedHours.minimum)}–${formatHours(result.estimatedHours.maximum)} hours</strong><small>Hourly pricing recommended. No dollar total is shown to the lead.</small>`;
    }
    if (result.status === 'ready_for_review') {
      const minimum = result.priceRange?.minimum ?? result.amount;
      const maximum = result.priceRange?.maximum ?? result.amount;
      const duration = quoteDurationMinutes();
      const durationText = Number.isFinite(duration) && duration > 0 ? `${formatHours(duration / 60)} hours` : 'unavailable';
      return `<strong>$${minimum}–$${maximum}</strong><small>Estimated cleaning time: ${durationText} (used for availability).</small><small>Preliminary price range. Review required.</small>`;
    }
    if (result.status === 'missing_size') return '<strong>Details needed</strong><small>Ask the client for the number of bedrooms and bathrooms before estimating.</small>';
    return `<strong>Manual review required</strong><small>${result.reason || 'Complete the missing lead details.'}</small>`;
  }
  function availabilityDay(date) {
    return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`));
  }
  function availabilityKey(item) { return `${item.day}|${item.start}|${item.cleaner || 'rafael'}`; }
  function allAvailabilityOptions() {
    if (availability?.status !== 'ready') return [];
    return [...(availability.options || []), ...(availability.hiddenCompatibleOptions || [])];
  }
  function selectedAvailabilitySlots() {
    if (availability?.status !== 'ready') return null;
    return allAvailabilityOptions()
      .filter((item) => selectedAvailability.has(availabilityKey(item)))
      .map((item) => ({ day: item.day, start: item.start, duration: availability.duration }));
  }
  function availabilityContext(item) {
    const previous = item.previous;
    const next = item.next;
    if (previous) {
      const onward = next ? `<div><span>Then to ${escapeHtml(next.customerName || 'next job')}</span><b>${next.travelFromLead} min</b></div>` : '';
      return `<div class="availability-route"><div><span>Last job · ${escapeHtml(previous.customerName || 'Unnamed')}</span><b>${clock(minutes(previous.startTime))}–${clock(previous.end)}</b></div><div><span>Drive to this lead</span><b>${previous.travelToLead} min</b></div>${onward}</div>`;
    }
    if (next) return `<div class="availability-route"><div><span>Drive to ${escapeHtml(next.customerName || 'next job')}</span><b>${next.travelFromLead} min</b></div></div>`;
    return '<div class="availability-route availability-open"><span>Open day — no route between jobs is needed.</span></div>';
  }
  function availabilityMarkup() {
    if (availability?.status === 'loading') return '<section class="result"><p><strong>Calculating availability…</strong></p></section>';
    if (availability?.status === 'error') return `<section class="result"><p><strong>Availability unavailable</strong><small>${escapeHtml(availability.error)}</small></p></section>`;
    if (availability?.status === 'ready') {
      const company = CleaningQuoteEngine.COMPANIES[quote.company]?.name || 'Selected company';
      const slot = (item, index) => {
        const key = availabilityKey(item);
        return `<article class="availability-slot ${selectedAvailability.has(key) ? 'is-selected' : ''}"><label class="availability-slot-top"><input type="checkbox" data-availability-key="${escapeHtml(key)}" ${selectedAvailability.has(key) ? 'checked' : ''}><span class="availability-rank">${index + 1}</span><strong>${availabilityDay(item.day)}</strong><span class="availability-time"><span class="availability-window-label">Arrival window</span><span class="availability-window">${clock(item.start)}–${clock(item.start + 30)}</span></span></label><div class="availability-end">Estimated end: <strong>${clock(item.start + availability.duration)}</strong>${item.cleaner ? ` · Team: <strong>${escapeHtml(item.cleaner)}</strong>` : ''}</div>${availabilityContext(item)}</article>`;
      };
      const slots = availability.options.map(slot).join('') || '<p class="availability-empty">No compatible slots were found in this 20-day window.</p>';
      const unavailable = availability.unavailableDays.length ? `${availability.unavailableDays.length} days were not compatible` : 'All eligible days had a compatible gap';
      const hidden = availability.hiddenCompatibleOptions?.length || 0;
      const moreCompatible = hidden ? `<details class="availability-summary availability-extra"><summary>${hidden} more compatible day${hidden === 1 ? '' : 's'} — choose any to include</summary><div class="availability-slots">${availability.hiddenCompatibleOptions.map((item, index) => slot(item, availability.options.length + index)).join('')}</div></details>` : '';
      return `<section class="result availability"><div class="availability-head"><strong>Availability · ${company}</strong><small>${escapeHtml(availability.approximateLocation)} · ${availability.duration} min service estimate</small><em>Showing the next ${availability.options.length} of ${availability.compatibleTotal} compatible days. Select the dates to include in the quote.</em></div><div class="availability-slots">${slots}</div>${moreCompatible}<details class="availability-summary"><summary>${unavailable}</summary><small>${availability.unavailableDays.map(availabilityDay).join(' · ') || 'No unavailable days.'}</small></details></section>`;
    }
    return '';
  }
  function canSaveForApproval(result) {
    return result.status === 'ready_for_review' || (Object.hasOwn(CleaningQuoteEngine.COMPANIES, result.company) && result.status === 'missing_size');
  }
  function reviewHasWrongCompany(review) {
    return Boolean(review?.quote?.company && quote?.company && review.quote.company !== quote.company);
  }
  function reviewHasMoreCompleteDetails(review) {
    const descriptiveUpdate = ['cleaningProducts', 'extraServices'].some((field) => {
      const current = String(lead?.[field] || '').trim();
      const saved = String(review?.lead?.[field] || '').trim();
      return current.length > saved.length;
    });
    const sizeChanged = ['squareFeet', 'bedrooms', 'bathrooms'].some((field) => {
      const current = String(lead?.[field] || '').trim();
      const saved = String(review?.lead?.[field] || '').trim();
      return Boolean(current) && current !== saved;
    });
    return descriptiveUpdate || sizeChanged;
  }
  function canRegenerateReview() { return Boolean(existingReview) && (existingReview.state === 'discarded' || reviewHasWrongCompany(existingReview) || reviewHasMoreCompleteDetails(existingReview)); }
  function blocksSaveForApproval() { return Boolean(existingReview) && !canRegenerateReview(); }
  function canCopyApprovedMessage() {
    return quote?.status === 'ready_for_review' || (Object.hasOwn(CleaningQuoteEngine.COMPANIES, quote?.company) && quote?.status === 'missing_size');
  }
  function input(label, value, key, type = 'text') {
    return `<label>${label}<input data-field="${key}" type="${type}" value="${escapeHtml(value ?? '')}"></label>`;
  }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  }
  function serviceSelector(value) {
    const normalized = CleaningQuoteEngine.normalizeService(value);
    const current = normalized === 'move_in_out' ? '' : CleaningQuoteEngine.resolveService(value, lead.frequency) || '';
    const availableServices = CleaningQuoteEngine.INITIAL_LEAD_SERVICE_IDS;
    const options = Object.entries(CleaningQuoteEngine.SERVICES).filter(([id]) => availableServices.includes(id))
      .map(([id, label]) => `<option value="${id}" ${id === current ? 'selected' : ''}>${label}</option>`).join('');
    const moveTypeNote = normalized === 'move_in_out'
      ? `<iframe class="move-prompt" title="Choose Move-in or Move-out" src="${chrome.runtime.getURL(`service-picker.html?mode=prompt&nonce=${encodeURIComponent(servicePickerNonce)}`)}"></iframe>`
      : '';
    // The Da Silva Yelp account consumes native form events fired inside the
    // page. Its picker lives in an extension document, so Yelp cannot cancel
    // its selection while the assistant keeps the same single-list workflow.
    if (quote?.company === 'dasilva') {
      const pickerUrl = chrome.runtime.getURL(`service-picker.html?nonce=${encodeURIComponent(servicePickerNonce)}&selected=${encodeURIComponent(current)}`);
      return `<label>Cleaning type<iframe class="service-picker" title="Cleaning type" src="${pickerUrl}"></iframe>${moveTypeNote}</label>`;
    }
    return `<label>Cleaning type<select data-field="serviceType"><option value="">Select cleaning type</option>${options}</select>${moveTypeNote}</label>`;
  }
  function conversationText() {
    const conversation = document.querySelector('main') || document.body;
    return conversation?.innerText || '';
  }
  function followUpButtons() {
    if (!canCopyApprovedMessage()) return '<button disabled>Copy follow-up</button>';
    const followUps = CleaningQuoteMessages.followUpStatus(quote.company, lead, conversationText());
    if (!Array.isArray(followUps)) {
      const suggestion = followUps.suggestedSituation
        ? `<small>Suggested from this chat: Situation ${followUps.suggestedSituation}. Confirm whether the client replied before choosing Situation 1 or 3.</small>`
        : '<small>Review the chat and select the matching situation before copying a follow-up.</small>';
      const situations = followUps.situations.map((situation) => `<details class="details-request" ${situation.number === followUps.suggestedSituation ? 'open' : ''}><summary><strong>Situation ${situation.number}: ${escapeHtml(situation.title)}</strong></summary><small>${escapeHtml(situation.signals)}</small><div>${situation.messages.map((item) => `<button data-action="copy-follow-up" data-follow-up-situation="${situation.number}" data-follow-up-stage="${item.stage}" ${item.sent ? 'disabled' : ''}>${item.sent ? `Follow-up ${item.stage} sent` : `Copy follow-up ${item.stage}`}</button>`).join('')}</div></details>`).join('');
      return `<section class="details-request follow-up-situations"><strong>Follow-up situations</strong>${suggestion}${situations}</section><button data-action="copy-archiving">Copy archiving</button>`;
    }
    const buttons = followUps.map((followUp) => `<button data-action="copy-follow-up" data-follow-up-number="${followUp.number}" ${followUp.sent ? 'disabled' : ''}>${followUp.sent ? `Follow-up ${followUp.number} sent` : `Copy follow-up ${followUp.number}`}</button>`).join('');
    return `${buttons}<button data-action="copy-archiving">Copy archiving</button>`;
  }
  function detailsRequestMarkup() {
    if (!detailsRequestOpen) return '';
    const options = [
      ['squareFeet', 'Square footage'],
      ['bedrooms', 'Bedrooms'],
      ['bathrooms', 'Bathrooms'],
      ['photos', 'Photos of main areas']
    ];
    return `<section class="details-request"><strong>Request more details</strong><small>Choose exactly what you want to ask the client for, even if some details are already present.</small><div>${options.map(([field, label]) => `<label><input type="checkbox" data-request-detail="${field}" ${requestedDetails.has(field) ? 'checked' : ''}>${label}</label>`).join('')}</div></section>`;
  }
  function render() {
    if (queueMode) { renderQueue(); return; }
    const saveLabel = blocksSaveForApproval()
      ? 'Already confirmed'
      : canRegenerateReview()
        ? 'Confirm updated quote'
        : quote.status === 'missing_size' ? 'Request details' : 'Confirm quote';
    const reviewMessage = existingReview
      ? existingReview.state === 'discarded'
        ? '<p class="existing-review">This lead was discarded. You can generate a new request for approval if the details have changed.</p>'
        : reviewHasWrongCompany(existingReview)
          ? '<p class="existing-review">A previous request used different company pricing. You can generate a corrected request.</p>'
          : reviewHasMoreCompleteDetails(existingReview)
            ? '<p class="existing-review">More lead details are now available. You can generate a corrected request.</p>'
          : `<p class="existing-review">This quote was already ${escapeHtml(existingReview.state.replaceAll('_', ' '))}. Open the saved quotes list to copy its message again.</p>`
      : '';
    const copyLabel = availability?.status === 'ready'
      ? `Copy quote message (${selectedAvailability.size} date${selectedAvailability.size === 1 ? '' : 's'})`
      : 'Copy quote message';
    const primaryAction = quote.status === 'missing_size'
      ? detailsRequestOpen
        ? `<button data-action="copy-details-request" ${requestedDetails.size ? '' : 'disabled'}>Copy selected details request</button>`
        : '<button data-action="open-details-request">Request details</button>'
      : `<button data-action="save" ${!canSaveForApproval(quote) || blocksSaveForApproval() ? 'disabled' : ''}>${saveLabel}</button>`;
    const detailsAction = detailsRequestOpen
      ? `<button data-action="copy-details-request" ${requestedDetails.size ? '' : 'disabled'}>Copy selected details request</button>`
      : '<button data-action="open-details-request">Request details</button>';
    root.innerHTML = `
        <header><span>Lead estimate <small>v${BUILD_VERSION}</small></span><div><button type="button" data-action="debug" aria-expanded="${debugVisible}">Debug</button><button data-action="close" aria-label="Close">×</button></div></header>
      <section class="lead-fields">
        ${input('Company name', lead.companyName, 'companyName')}
        ${input('Customer name', lead.customerName, 'customerName')}
        <label>Company pricing<select data-field="companyOverride"><option value="">Auto-detect</option>${Object.entries(CleaningQuoteEngine.COMPANIES).map(([key, company]) => `<option value="${key}" ${companyOverride === key ? 'selected' : ''}>${escapeHtml(company.name)}</option>`).join('')}</select></label>
        ${quote.company !== 'unknown' ? `<label>Discount %<input data-field="discountPercent" type="number" min="0" max="100" step="1" value="${escapeHtml(discountPercent)}" placeholder="Optional"></label>` : ''}
        ${serviceSelector(lead.serviceType)}
        ${input('Square feet', lead.squareFeet, 'squareFeet', 'number')}
        ${input('Bedrooms', lead.bedrooms, 'bedrooms', 'number')}
        ${input('Bathrooms', lead.bathrooms, 'bathrooms', 'number')}
      </section>
      <section class="result"><p>${displayQuote(quote)}</p><dl><div><dt>Detected company</dt><dd>${escapeHtml(CleaningQuoteEngine.COMPANIES[quote.company]?.name || 'Not recognized')}</dd></div><div><dt>Size band</dt><dd>${quote.size.band ? `up to ${quote.size.band} sq. ft.` : 'Not resolved'}</dd></div><div><dt>Source</dt><dd>${quote.size.source || 'Manual review'}</dd></div><div><dt>Status</dt><dd>${quote.status.replaceAll('_', ' ')}</dd></div></dl></section>
        ${availabilityMarkup()}${detailsRequestMarkup()}${confirmationFeedback ? `<p class="existing-review">${escapeHtml(confirmationFeedback)}</p>` : ''}${reviewMessage}<footer><button data-action="copy-approved" ${canCopyApprovedMessage() ? '' : 'disabled'}>${copyLabel}</button>${quote.status === 'missing_size' ? '' : detailsAction}${followUpButtons()}<button data-action="availability" ${quote.status !== 'ready_for_review' ? 'disabled' : ''}>Find availability</button>${primaryAction}</footer>${debugMarkup()}`;
    bindPanelControls();
    lastManualServiceValue = root.querySelector('[data-field="serviceType"]')?.value || '';
  }
  async function renderQueue() {
    const records = await chrome.storage.local.get(null);
    const reviews = Object.entries(records).filter(([key]) => key.startsWith('lead:')).map(([, value]) => value)
      .sort((a, b) => new Date(b.updatedAt || b.savedAt) - new Date(a.updatedAt || a.savedAt));
    queueReviews = new Map(reviews.map((review) => [review.id, review]));
    const cards = reviews.length ? reviews.map((review) => {
      const itemQuote = review.quote || {};
      const result = itemQuote.quoteType === 'time_only' && itemQuote.estimatedHours
        ? `${itemQuote.estimatedHours.minimum}–${itemQuote.estimatedHours.maximum} hours`
        : itemQuote.quoteType === 'fixed_price' ? `$${itemQuote.priceRange?.minimum ?? itemQuote.amount}–$${itemQuote.priceRange?.maximum ?? itemQuote.amount}` : 'Manual review required';
      const company = CleaningQuoteEngine.COMPANIES[itemQuote.company]?.name || 'Unknown company';
      const customerName = review.lead?.customerName || 'Client name unavailable';
      const actions = review.state === 'pending_human_approval'
        ? `<div class="queue-actions"><button data-review-state="approved">Approve</button><button data-review-state="adjusted">Adjust</button><button class="quiet" data-review-state="discarded">Discard</button></div>` : '';
      return `<article class="queue-card" data-review-id="${escapeHtml(review.id)}"><div><strong>${escapeHtml(customerName)}</strong><span>${escapeHtml(review.state || 'pending_human_approval').replaceAll('_', ' ')}</span></div><p class="queue-company">${company}</p><p>${escapeHtml(itemQuote.serviceLabel || 'Service needs review')}</p><b>${result}</b>${actions}</article>`;
    }).join('') : '<p class="queue-empty">No saved leads yet.</p>';
    root.innerHTML = `<header><span>Approval queue</span><div><button type="button" data-action="debug" aria-expanded="${debugVisible}">Debug</button><button data-action="back" aria-label="Back">‹</button><button data-action="close" aria-label="Close">×</button></div></header><section class="queue-list">${queueFeedback ? `<p class="queue-feedback">${escapeHtml(queueFeedback)}</p>` : ''}${cards}</section>${debugMarkup()}`;
  }
  async function updateReviewState(id, state) {
    const key = `lead:${id}`;
    const records = await chrome.storage.local.get(key);
    if (!records[key]) return;
    await chrome.storage.local.set({ [key]: { ...records[key], state, updatedAt: new Date().toISOString() } });
  }
  async function syncApprovedMessage({ invalidateAvailability = false } = {}) {
    if (invalidateAvailability) {
      availability = null;
      selectedAvailability = new Set();
    }
    if (!canCopyApprovedMessage() || !validReview(existingReview) || !['approved', 'adjusted'].includes(existingReview.state)) return false;
    const slots = selectedAvailabilitySlots();
    const reviewToCopy = {
      ...existingReview,
      lead: { ...lead },
      quote,
      availability: slots === null ? (invalidateAvailability ? [] : existingReview.availability || []) : slots,
      availabilitySearch: slots === null
        ? (invalidateAvailability ? null : existingReview.availabilitySearch || null)
        : { compatibleTotal: availability.compatibleTotal || 0 },
      updatedAt: new Date().toISOString()
    };
    await chrome.storage.local.set({ [reviewKey(lead.id)]: reviewToCopy });
    existingReview = reviewToCopy;
    try {
      await navigator.clipboard.writeText(CleaningQuoteMessages.approvedMessage(reviewToCopy));
      confirmationFeedback = invalidateAvailability
        ? 'Quote and clipboard message updated. Recalculate availability before offering dates.'
        : 'Approved message updated in the clipboard.';
      return true;
    } catch {
      confirmationFeedback = 'Quote updated, but the approved message could not be copied.';
      return false;
    }
  }
  function applyManualServiceType(serviceId) {
    const selectedServiceType = CleaningQuoteEngine.SERVICES[serviceId] || null;
    const isRecurringLead = Boolean(CleaningQuoteEngine.recurringCleaningFrequency(originalServiceType, lead.frequency));
    // The selector displays First Cleaning for recurring leads, but the
    // original Yelp wording carries the cadence needed for recurring rates.
    if (serviceId === 'first_cleaning' && isRecurringLead) lead.serviceType = originalServiceType;
    else {
      lead.serviceType = selectedServiceType;
    }
    if (selectedServiceType) {
      manualServiceOverride = serviceId;
      manualServiceOverrideLeadId = lead?.id || null;
    }
  }
  function bindManualServiceControl() {
    const selector = root.querySelector('[data-field="serviceType"]');
    if (!selector) return;
    const applySelection = async (event) => {
      event.stopPropagation();
      if (serviceChangeInFlight) return;
      serviceChangeInFlight = true;
      try {
        await recalculate({ serviceId: event.currentTarget.value });
      } catch {
        confirmationFeedback = 'Could not apply the selected cleaning type.';
        render();
      } finally {
        serviceChangeInFlight = false;
      }
    };
    // Chrome normally emits both events for a select; some Yelp page states
    // only surface input. Handle either one, while applying it once.
    selector.addEventListener('input', applySelection);
    selector.addEventListener('change', applySelection);
  }
  function bindPanelControls() {
    bindManualServiceControl();
  }
  function refreshCustomerNameForCopy() {
    const field = root.querySelector('[data-field="customerName"]');
    const entered = field?.value.trim();
    if (entered) lead.customerName = CleaningLeadExtractor.firstName(entered);
    else {
      const current = CleaningLeadExtractor.extractLead();
      lead.customerName = current?.id === lead.id ? current.customerName || null : null;
    }
    if (field) field.value = lead.customerName || '';
    return Boolean(lead.customerName);
  }
  async function recalculate({ serviceId = null } = {}) {
    panelEdited = true;
    root.querySelectorAll('[data-field]').forEach((field) => {
      if (field.dataset.field === 'companyOverride') companyOverride = field.value || null;
      else if (field.dataset.field === 'discountPercent') discountPercent = field.value.trim();
      else if (field.dataset.field === 'serviceType') { if (!serviceId) applyManualServiceType(field.value); }
      else lead[field.dataset.field] = field.value || null;
    });
    if (serviceId) applyManualServiceType(serviceId);
    quote = CleaningQuoteEngine.calculateQuote(lead, { companyOverride, discountPercent });
    logDebug('Manual cleaning type applied', { selected: serviceId || root.querySelector('[data-field="serviceType"]')?.value || null, service: quote.service, status: quote.status });
    await syncApprovedMessage({ invalidateAvailability: true });
    render();
  }
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === 'SHOW_UPDATE_RELOAD_NOTICE') {
      if (!document.getElementById('cleaning-update-reload-notice')) {
        const notice = document.createElement('div');
        notice.id = 'cleaning-update-reload-notice';
        notice.setAttribute('role', 'status');
        notice.textContent = 'Extensão atualizada. Atualize esta página para usar a nova versão.';
        Object.assign(notice.style, { position: 'fixed', bottom: '16px', right: '16px', zIndex: '2147483647', padding: '12px 16px', background: '#174a8b', color: '#fff', borderRadius: '8px', boxShadow: '0 4px 16px #0004', font: '14px Arial, sans-serif' });
        (document.body || document.documentElement).append(notice);
      }
      sendResponse({ ok: true });
      return undefined;
    }
    if (message?.type !== 'SET_ACTIVE_LEAD_SERVICE' && message?.type !== 'PICKER_SERVICE_APPLY') return undefined;
    if (message.type === 'PICKER_SERVICE_APPLY' && message.nonce !== servicePickerNonce) {
      sendResponse({ ok: false, error: 'Invalid selector session.' });
      return undefined;
    }
    if (!CleaningQuoteEngine.INITIAL_LEAD_SERVICE_IDS.includes(message.serviceId) || !lead || !root.isConnected) {
      sendResponse({ ok: false, error: 'The current lead is not ready for a manual service selection.' });
      return undefined;
    }
    serviceChangeInFlight = true;
    recalculate({ serviceId: message.serviceId })
      .then(() => sendResponse({ ok: quote?.status === 'ready_for_review', status: quote?.status }))
      .catch((error) => sendResponse({ ok: false, error: error.message || 'Could not apply the service type.' }))
      .finally(() => { serviceChangeInFlight = false; });
    return true;
  });
  // Yelp can swallow a select's change event, but it cannot prevent the
  // browser from updating the selected value. Observe that native value and
  // recalculate from it; this keeps the control in the panel rather than in
  // a floating frame.
  setInterval(() => {
    if (!root.isConnected || serviceChangeInFlight) return;
    const selector = root.querySelector('[data-field="serviceType"]');
    const selected = selector?.value || '';
    if (!selected || selected === lastManualServiceValue) return;
    lastManualServiceValue = selected;
    logDebug('Manual cleaning type observed', { selected });
    serviceChangeInFlight = true;
    void recalculate({ serviceId: selected })
      .catch(() => {
        confirmationFeedback = 'Could not apply the selected cleaning type.';
        render();
      })
      .finally(() => { serviceChangeInFlight = false; });
  }, 250);
  setInterval(() => {
    const leadId = lead?.id;
    if (!root.isConnected || !leadId || serviceChangeInFlight) return;
    const key = manualServiceOverrideKey(leadId);
    chrome.storage.local.get(key).then((records) => {
      const stored = records[key];
      const revision = stored?.serviceId && stored?.updatedAt ? `${stored.serviceId}:${stored.updatedAt}` : null;
      if (!revision || revision === lastStoredManualOverride || !CleaningQuoteEngine.INITIAL_LEAD_SERVICE_IDS.includes(stored.serviceId)) return;
      lastStoredManualOverride = revision;
      logDebug('Stored manual cleaning type observed', { selected: stored.serviceId });
      serviceChangeInFlight = true;
      void recalculate({ serviceId: stored.serviceId })
        .catch(() => { confirmationFeedback = 'Could not apply the stored cleaning type.'; render(); })
        .finally(() => { serviceChangeInFlight = false; });
    }).catch(() => {});
  }, 300);
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !lead?.id || !root.isConnected || serviceChangeInFlight) return;
    const key = manualServiceOverrideKey(lead.id);
    const stored = changes[key]?.newValue;
    if (!stored?.serviceId || !CleaningQuoteEngine.INITIAL_LEAD_SERVICE_IDS.includes(stored.serviceId)) return;
    const revision = `${stored.serviceId}:${stored.updatedAt || ''}`;
    if (revision === lastStoredManualOverride) return;
    lastStoredManualOverride = revision;
    logDebug('Stored manual cleaning type changed', { selected: stored.serviceId });
    serviceChangeInFlight = true;
    void recalculate({ serviceId: stored.serviceId })
      .catch(() => { confirmationFeedback = 'Could not apply the stored cleaning type.'; render(); })
      .finally(() => { serviceChangeInFlight = false; });
  });
  root.addEventListener('click', async (event) => {
    const action = event.target.closest?.('[data-action]')?.dataset.action;
    if (action === 'close') root.remove();
    if (action === 'debug') {
      debugVisible = !debugVisible;
      logDebug('Debug toggled', { enabled: debugVisible });
      queueMode ? renderQueue() : render();
    }
    if (action === 'copy-debug') {
      try {
        await navigator.clipboard.writeText(JSON.stringify(captureSnapshot(lead, quote), null, 2));
        debugCopyFeedback = 'Debug copied to clipboard.';
        logDebug('Debug copied to clipboard');
      } catch {
        debugCopyFeedback = 'Could not copy debug.';
      }
      const status = root.querySelector('.debug [role="status"]');
      if (status) status.textContent = debugCopyFeedback;
    }
    if (action === 'queue') { queueMode = true; render(); }
    if (action === 'back') { queueMode = false; render(); }
    if (action === 'copy-approved' && canCopyApprovedMessage()) {
      try {
        const slots = selectedAvailabilitySlots();
        const reviewToCopy = {
          ...existingReview,
          id: existingReview?.id || lead.id,
          url: location.href,
          lead: { ...lead },
          quote,
          state: existingReview?.state || 'pending_human_approval',
          savedAt: existingReview?.savedAt || new Date().toISOString(),
          availability: slots === null ? (existingReview?.availability || []) : slots,
          availabilitySearch: slots === null
            ? (existingReview?.availabilitySearch || null)
            : { compatibleTotal: availability.compatibleTotal || 0 },
          updatedAt: new Date().toISOString()
        };
        await navigator.clipboard.writeText(CleaningQuoteMessages.approvedMessage(reviewToCopy));
        await chrome.storage.local.set({ [reviewKey(lead.id)]: reviewToCopy });
        existingReview = reviewToCopy;
        confirmationFeedback = 'Quote message copied to clipboard and saved in this profile.';
      } catch {
        confirmationFeedback = 'Could not copy the approved message.';
      }
      render();
    }
    if (action === 'copy-follow-up' && canCopyApprovedMessage()) {
      const hasCustomerName = refreshCustomerNameForCopy();
      const status = CleaningQuoteMessages.followUpStatus(quote.company, lead, conversationText());
      const number = Number(event.target.dataset.followUpNumber);
      const situation = Number(event.target.dataset.followUpSituation);
      const stage = Number(event.target.dataset.followUpStage);
      const followUp = Array.isArray(status)
        ? status.find((item) => item.number === number)
        : status.situations.find((item) => item.number === situation)?.messages.find((item) => item.stage === stage);
      if (!followUp || followUp.sent) {
        confirmationFeedback = 'This follow-up already appears in this Yelp conversation.';
        logDebug('Follow-up not copied', { company: quote.company, number, reason: 'already_detected' });
      } else try {
        await navigator.clipboard.writeText(followUp.message);
        const label = Array.isArray(status) ? `Follow-up ${followUp.number}` : `Situation ${situation}, follow-up ${stage}`;
        confirmationFeedback = hasCustomerName ? `${label} copied to clipboard. Review it, then paste it into Yelp when ready.` : `${label} copied with “there”: customer name was not found. Enter it above and copy again.`;
        logDebug('Follow-up copied', { company: quote.company, number: followUp.number || stage, situation: situation || null });
      } catch {
        confirmationFeedback = 'Could not copy the follow-up.';
      }
      render();
    }
    if (action === 'copy-archiving' && canCopyApprovedMessage()) {
      try {
        const hasCustomerName = refreshCustomerNameForCopy();
        await navigator.clipboard.writeText(CleaningQuoteMessages.archivingMessage(quote.company, lead));
        confirmationFeedback = hasCustomerName ? 'Archiving message copied to clipboard. Review it, then paste it into Yelp when ready.' : 'Archiving message copied with “there”: customer name was not found. Enter it above and copy again.';
        logDebug('Archiving message copied', { company: quote.company });
      } catch {
        confirmationFeedback = 'Could not copy the archiving message.';
      }
      render();
    }
    if (action === 'copy-details-request') {
      const message = CleaningQuoteMessages.detailsRequestMessage(lead, quote.company, requestedDetails);
      if (!message) return;
      try {
        await navigator.clipboard.writeText(message);
        confirmationFeedback = 'Details request copied to clipboard.';
      } catch {
        confirmationFeedback = 'Could not copy the details request.';
      }
      render();
    }
    if (action === 'open-details-request') {
      detailsRequestOpen = true;
      confirmationFeedback = '';
      render();
    }
    if (action === 'availability') findAvailability();
    const card = event.target.closest('[data-review-id]');
    if (card && !event.target.closest('button, a')) {
      const review = queueReviews.get(card.dataset.reviewId);
      if (review) {
        try {
          await navigator.clipboard.writeText(CleaningQuoteMessages.approvedMessage(review));
          queueFeedback = 'Message copied to clipboard.';
        } catch {
          queueFeedback = 'Could not copy the message.';
        }
        renderQueue();
      }
      return;
    }
    if (event.target.dataset.reviewState) {
      const id = event.target.closest('[data-review-id]')?.dataset.reviewId;
      const state = event.target.dataset.reviewState;
      const review = queueReviews.get(id);
      if (id && review) {
        try {
          if (state === 'approved') await navigator.clipboard.writeText(CleaningQuoteMessages.approvedMessage(review));
          await updateReviewState(id, state);
          queueFeedback = state === 'approved' ? 'Approved. Message copied to clipboard.' : `Lead marked as ${state}.`;
        } catch {
          queueFeedback = state === 'approved' ? 'Could not copy the message. Approval was not changed.' : 'Could not update this lead.';
        }
        renderQueue();
      }
    }
    if (action === 'save') {
      const hasAvailability = availability?.status === 'ready' && availability.options?.length > 0;
      if (!hasAvailability) {
        const warning = availability?.status === 'ready'
          ? 'No availability was found for this lead.'
          : 'Availability has not been calculated for this lead.';
        if (!window.confirm(`${warning} Save for approval anyway?`)) return;
      }
        if (hasAvailability && selectedAvailability.size === 0 && !window.confirm('No availability dates are selected. Save for approval without dates?')) return;
      event.target.disabled = true;
      const key = reviewKey(lead.id);
      if (!key) {
        event.target.textContent = 'Lead ID unavailable';
        return;
      }
      try {
        const records = await chrome.storage.local.get(key);
        if (validReview(records[key]) && records[key].state !== 'discarded' && !reviewHasWrongCompany(records[key]) && !reviewHasMoreCompleteDetails(records[key])) {
          existingReview = records[key];
          event.target.textContent = 'Already confirmed';
          render();
          return;
        }
        const now = new Date().toISOString();
        const selectedSlots = selectedAvailabilitySlots() || [];
        const availabilitySearch = availability?.status === 'ready'
          ? { compatibleTotal: availability.compatibleTotal || 0 }
          : null;
        const review = { id: lead.id, lead, quote, availability: selectedSlots, availabilitySearch, state: 'approved', savedAt: now, updatedAt: now, url: location.href };
        await navigator.clipboard.writeText(CleaningQuoteMessages.approvedMessage(review));
        await chrome.storage.local.set({ [key]: review });
        existingReview = review;
        confirmationFeedback = 'Quote confirmed. Message copied to clipboard.';
        render();
      } catch {
        event.target.textContent = 'Save failed';
        event.target.disabled = false;
      }
    }
  });
  // Handle the manual cleaning selector during capture. This is intentionally
  // separate from the generic change handler below: Yelp can consume bubbling
  // events from controls it did not create, while a capture listener on our
  // panel still receives the native select change.
  root.addEventListener('change', (event) => {
    const serviceSelector = event.target.closest?.('[data-field="serviceType"]');
    if (!serviceSelector) return;
    event.stopImmediatePropagation();
    if (serviceChangeInFlight) return;
    serviceChangeInFlight = true;
    void recalculate({ serviceId: serviceSelector.value })
      .catch(() => {
        confirmationFeedback = 'Could not apply the selected cleaning type.';
        render();
      })
      .finally(() => { serviceChangeInFlight = false; });
  }, true);
  root.addEventListener('change', (event) => {
    const requestedDetail = event.target.closest('[data-request-detail]');
    if (requestedDetail) {
      if (requestedDetail.checked) requestedDetails.add(requestedDetail.dataset.requestDetail);
      else requestedDetails.delete(requestedDetail.dataset.requestDetail);
      render();
      return;
    }
    const checkbox = event.target.closest('[data-availability-key]');
    if (checkbox) {
      if (checkbox.checked) selectedAvailability.add(checkbox.dataset.availabilityKey);
      else selectedAvailability.delete(checkbox.dataset.availabilityKey);
      checkbox.closest('.availability-slot')?.classList.toggle('is-selected', checkbox.checked);
      void syncApprovedMessage();
      const copyButton = root.querySelector('[data-action="copy-approved"]');
      if (copyButton && availability?.status === 'ready') {
        const count = selectedAvailability.size;
        copyButton.textContent = `Copy approved message (${count} date${count === 1 ? '' : 's'})`;
      }
      return;
    }
    if (event.target.closest('[data-field]')) void recalculate();
  });
  const originalPushState = history.pushState;
  history.pushState = function patchedPushState(...args) {
    const result = originalPushState.apply(this, args);
    scheduleLeadRefresh();
    return result;
  };
  const originalReplaceState = history.replaceState;
  history.replaceState = function patchedReplaceState(...args) {
    const result = originalReplaceState.apply(this, args);
    scheduleLeadRefresh();
    return result;
  };
  window.addEventListener('popstate', scheduleLeadRefresh);
  let observedRoute = currentRoute();
  setInterval(() => {
    const route = currentRoute();
    if (route !== observedRoute) {
      observedRoute = route;
      scheduleLeadRefresh();
    }
  }, 400);
  let extractionTimer = null;
  const yelpLoadObserver = new MutationObserver((mutations) => {
    if (queuedRoute || !isYelpLeadPage() || !root.isConnected || mutations.every((mutation) =>
      root.contains(mutation.target) || (mutation.addedNodes.length > 0 && [...mutation.addedNodes].every((node) => node.id === 'cleaning-update-reload-notice')))) return;
    if (quote?.status === 'ready_for_review') return;
    clearTimeout(extractionTimer);
    extractionTimer = setTimeout(() => {
      if (!isYelpLeadPage() || quote?.status === 'ready_for_review') return;
      const refreshedLead = CleaningLeadExtractor.extractLead();
      const refreshedQuote = CleaningQuoteEngine.calculateQuote(refreshedLead);
      if (refreshedQuote.status === 'ready_for_review') {
        lead = refreshedLead;
        quote = refreshedQuote;
        render();
        loadExistingReview(currentRoute(), lead.id);
      }
    }, 250);
  });
  yelpLoadObserver.observe(document.documentElement, { childList: true, subtree: true });
  refreshLeadPanel(true);
})();
