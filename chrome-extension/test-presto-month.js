'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
let label = '';
const context = { document: { querySelector: () => ({ textContent: label }) }, chrome: { runtime: { onMessage: { addListener() {} } } }, Intl, Date, setTimeout };
vm.createContext(context);
vm.runInContext(fs.readFileSync(`${__dirname}/presto-content.js`, 'utf8'), context);
for (const [input, expected] of [['out 2026', '2026-10'], ['Oct 2026', '2026-10'], ['outubro 2026', '2026-10'], ['Fev. 2026', '2026-02'], ['December 2026', '2026-12'], ['dez 2026', '2026-12'], ['set 2026', '2026-09'], ['unknown 2026', null]]) {
  label = input;
  assert.equal(context.displayedCalendarMonth(), expected, input);
}
(async () => {
  label = 'out 2026';
  context.todayInCalifornia = () => '2026-10-30';
  context.availabilityEndDate = () => '2026-11-18';
  context.sleep = async () => {};
  context.calendarNavigationButton = (direction) => ({ click() { label = direction === 'next' ? 'nov 2026' : 'out 2026'; } });
  const reads = [];
  const result = await context.withNextMonthIfNeeded(async () => { reads.push(label); return [{ id: label, date: label }]; }, []);
  assert.deepEqual(reads, ['out 2026', 'nov 2026']);
  assert.equal(result.length, 2);
  assert.equal(label, 'out 2026');
  console.log('Presto calendar month checks passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
