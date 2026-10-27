(function cleanerAvailabilityModule(root) {
  'use strict';
  const DAY_START = 510; // 8:30 AM; the first offered arrival window is 8:30–9:00 AM.

  function importedSlots(config, day, duration) {
    return (config?.windows || [])
      .filter((window) => window.day === day && Number.isFinite(window.start) && Number.isFinite(window.end))
      .map((window) => ({ ...window, start: Math.max(window.start, DAY_START) }))
      .filter((window) => window.start + duration <= window.end)
      .map((window) => ({ day, start: window.start, cleaner: window.cleaner, previous: null, next: null, source: 'imported_cleaner_availability' }));
  }

  function storageKey(company) { return `cleanerAvailability:${company}`; }

  root.CleaningCleanerAvailability = { DAY_START, importedSlots, storageKey };
}(typeof globalThis !== 'undefined' ? globalThis : this));
