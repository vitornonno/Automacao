/* global chrome */
'use strict';

function text(element) {
  return String(element?.textContent || '').replace(/\s+/g, ' ').trim();
}

function timeFromEvent(element) {
  const match = text(element).match(/\b([01]?\d|2[0-3]):[0-5]\d\b/);
  return match ? match[0] : null;
}

function todayInCalifornia() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function availabilityEndDate() {
  const now = new Date();
  const californiaToday = todayInCalifornia();
  const [year, month, day] = californiaToday.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 19));
  return date.toISOString().slice(0, 10);
}

function isAvailabilityDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date || '') && date >= todayInCalifornia() && date <= availabilityEndDate();
}

function detectedCompany() {
  const name = text(document.querySelector('a[href="/dashboard/settings/company"] .v-list-item__title'));
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/\bkacs\b/.test(normalized)) return { key: 'kacs', name };
  if (/\bjhey.?s\b/.test(normalized)) return { key: 'jheys', name };
  return { key: null, name: name || null };
}

function calendarSnapshot() {
  const days = new Map();
  document.querySelectorAll('[data-date] .service-label[id^="event-"]').forEach((event) => {
    const day = event.closest('[data-date]')?.dataset.date;
    if (!isAvailabilityDate(day)) return;
    const id = event.id.replace(/^event-/, '');
    const eventText = text(event);
    const time = timeFromEvent(event);
    const customerName = eventText.replace(/^([01]?\d|2[0-3]):[0-5]\d\s*/, '').trim() || null;
    const jobs = days.get(day) || [];
    jobs.push({ id, time, customerName });
    days.set(day, jobs);
  });
  return [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, jobs]) => ({
    date,
    jobCount: jobs.length,
    jobs: jobs.sort((a, b) => String(a.time).localeCompare(String(b.time)))
  }));
}

function visibleEvents() {
  return [...document.querySelectorAll('[data-date] .service-label[id^="event-"]')]
    .map((element) => ({
      element,
      date: element.closest('[data-date]')?.dataset.date || null,
      id: element.id.replace(/^event-/, ''),
      time: timeFromEvent(element),
      customerName: text(element).replace(/^([01]?\d|2[0-3]):[0-5]\d\s*/, '').trim() || null
    }))
    .filter((event) => isAvailabilityDate(event.date))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

function coordinatesFromMapLink() {
  const link = [...document.querySelectorAll('a[href*="maps.google.com"]')]
    .find((item) => /[?&]q=-?\d/.test(item.href));
  const match = link?.href.match(/[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  return match ? { latitude: Number(match[1]), longitude: Number(match[2]), link: link.href } : null;
}

function moneyValue(value) {
  const raw = String(value || '').replace(/[^\d,.-]/g, '');
  if (!raw) return null;
  const comma = raw.lastIndexOf(',');
  const dot = raw.lastIndexOf('.');
  let normalized = raw;
  if (comma > dot) normalized = raw.replace(/\./g, '').replace(',', '.');
  else if (dot > comma && comma !== -1) normalized = raw.replace(/,/g, '');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function selectedJobDetails() {
  const mapLink = [...document.querySelectorAll('a[href*="maps.google.com"]')]
    .find((item) => /[?&]q=-?\d/.test(item.href));
  const coordinates = coordinatesFromMapLink();
  const locationRow = mapLink?.closest('.card-info-row');
  const priceMatch = document.body.innerText.match(/Price:\s*\$\s*([\d,.]+)/i);
  return {
    address: text(locationRow?.querySelector('.card-info-column-text')) || null,
    coordinates,
    price: priceMatch ? moneyValue(priceMatch[1]) : null
  };
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function debugEvent(events, event, detail = {}) {
  events.push({ at: new Date().toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour12: false }), event, detail });
}

function windowCrossesMonth() {
  return todayInCalifornia().slice(0, 7) !== availabilityEndDate().slice(0, 7);
}

function calendarNavigationButton(direction) {
  const icon = direction === 'next' ? '.fa-chevron-right' : '.fa-chevron-left';
  return [...document.querySelectorAll('.services-calendar-container .main-app-bar button')]
    .find((button) => button.querySelector(icon)) || null;
}

function mergeById(records) {
  return [...new Map(records.map((record) => [record.id || record.date, record])).values()]
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

async function withNextMonthIfNeeded(read, debug) {
  debugEvent(debug, 'Availability window', { start: todayInCalifornia(), end: availabilityEndDate(), crossesMonth: windowCrossesMonth() });
  const currentMonthRecords = await read();
  debugEvent(debug, 'Current month read', { records: currentMonthRecords.length });
  if (!windowCrossesMonth()) return currentMonthRecords;
  const nextButton = calendarNavigationButton('next');
  const previousButton = calendarNavigationButton('previous');
  if (!nextButton || !previousButton) {
    debugEvent(debug, 'Month navigation unavailable', { hasNext: Boolean(nextButton), hasPrevious: Boolean(previousButton) });
    return currentMonthRecords;
  }
  debugEvent(debug, 'Navigating to next month');
  nextButton.click();
  await sleep(1000);
  try {
    const nextMonthRecords = await read();
    debugEvent(debug, 'Next month read', { records: nextMonthRecords.length });
    return mergeById([...currentMonthRecords, ...nextMonthRecords]);
  } finally {
    previousButton.click();
    await sleep(750);
    debugEvent(debug, 'Restored original month');
  }
}

async function waitForCardToOpen(eventId, timeoutMilliseconds = 3000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMilliseconds) {
    const event = document.getElementById(`event-${eventId}`);
    const selected = event?.closest('.v-event')?.classList.contains('selected-event');
    const hasMap = Boolean(document.querySelector('a[href*="maps.google.com?q="]'));
    if (selected && hasMap) return true;
    await sleep(100);
  }
  return false;
}

async function visibleJobSnapshot(debug) {
  const jobs = [];
  for (const event of visibleEvents()) {
    debugEvent(debug, 'Opening job card', { id: event.id, date: event.date, time: event.time, customerName: event.customerName });
    const liveEvent = document.getElementById(`event-${event.id}`) || event.element;
    liveEvent.click();
    const loaded = await waitForCardToOpen(event.id);
    if (loaded) await sleep(900);
    const details = loaded ? selectedJobDetails() : { address: null, coordinates: null, price: null };
    debugEvent(debug, loaded ? 'Job card captured' : 'Job card timed out', { id: event.id, loaded, hasCoordinates: Boolean(details.coordinates), hasPrice: Number.isFinite(details.price) });
    jobs.push({
      id: event.id,
      date: event.date,
      startTime: event.time,
      customerName: event.customerName,
      ...details
    });
  }
  return jobs;
}

async function jobSnapshot() {
  const debug = [];
  const jobs = await withNextMonthIfNeeded(() => visibleJobSnapshot(debug), debug);
  return { jobs, debug };
}

async function calendarWindowSnapshot() {
  const debug = [];
  const days = await withNextMonthIfNeeded(async () => calendarSnapshot(), debug);
  return { days, debug };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'READ_PRESTO_CALENDAR') {
    const company = detectedCompany();
    calendarWindowSnapshot().then(({ days, debug }) => sendResponse({
      ok: true,
      source: 'presto_calendar_dom',
      capturedAt: new Date().toISOString(),
      company,
      days,
      debug,
      range: { start: todayInCalifornia(), end: availabilityEndDate() }
    })).catch((error) => sendResponse({ ok: false, error: error.message || 'Could not read calendar.' }));
    return true;
  }
  if (message.type === 'SCAN_PRESTO_JOBS') {
    const company = detectedCompany();
    jobSnapshot().then(({ jobs, debug }) => sendResponse({ ok: true, source: 'presto_job_cards_dom', capturedAt: new Date().toISOString(), company, jobs, debug, range: { start: todayInCalifornia(), end: availabilityEndDate() } }))
      .catch((error) => sendResponse({ ok: false, error: error.message || 'Could not scan job cards.' }));
    return true;
  }
  return undefined;
});
