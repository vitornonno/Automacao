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
  function todayInCalifornia() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }
  function isCurrentSnapshot(snapshot) {
    if (!snapshot?.capturedAt || !snapshot?.range?.start || !snapshot?.range?.end) return false;
    const captured = new Date(snapshot.capturedAt);
    return Number.isFinite(captured.getTime()) && new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(captured) === todayInCalifornia() && snapshot.range.start === todayInCalifornia();
  }

  // An imported window does not specify where the cleaner starts or ends.
  // A scheduled job makes routing uncertain, so do not offer that window.
  function safeImportedSlots(config, day, duration, jobs) {
    if (jobs.some((job) => !Array.isArray(job.cleaners) || !job.cleaners.length)) return [];
    return importedSlots(config, day, duration).filter((slot) => !jobs.some((job) => job.cleaners.some((name) => String(name).trim().toLowerCase() === String(slot.cleaner).trim().toLowerCase())));
  }

  root.CleaningCleanerAvailability = { DAY_START, importedSlots, safeImportedSlots, storageKey, todayInCalifornia, isCurrentSnapshot };
}(typeof globalThis !== 'undefined' ? globalThis : this));
