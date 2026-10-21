(function cleanerAvailabilityModule(root) {
  'use strict';

  function importedSlots(config, day, duration) {
    return (config?.windows || [])
      .filter((window) => window.day === day && Number.isFinite(window.start) && Number.isFinite(window.end))
      .filter((window) => window.start + duration <= window.end)
      .map((window) => ({ day, start: window.start, cleaner: window.cleaner, previous: null, next: null, source: 'imported_cleaner_availability' }));
  }

  function storageKey(company) { return `cleanerAvailability:${company}`; }

  root.CleaningCleanerAvailability = { importedSlots, storageKey };
}(typeof globalThis !== 'undefined' ? globalThis : this));
