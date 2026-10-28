const fs = require('fs');
const importer = require('./xlsx-import.js');
require('./cleaner-availability.js');

function check(condition, message) { if (!condition) throw new Error(message); }

(async () => {
  const rollover = importer.headerDates(['Cleaner', '31/12', '01/01', '02/01'], 2026, null).filter(Boolean);
  check(rollover.map((entry) => entry.date).join(',') === '2026-12-31,2027-01-01,2027-01-02', 'All dates after a year rollover must retain the new year.');
  const nextBlock = importer.headerDates(['Cleaner', '05/01'], rollover.at(-1).year, rollover.at(-1).month);
  check(nextBlock[1].date === '2027-01-05', 'The new year must carry over to later worksheet blocks.');
  const workbook = fs.readFileSync('../docs/Disponibilidade_Cleaners_KACS.xlsx');
  const config = await importer.parseCleanerAvailabilityWorkbook(workbook.buffer.slice(workbook.byteOffset, workbook.byteOffset + workbook.byteLength), { company: 'kacs', year: 2026 });
  check(config.windows.length === 12, 'The KACS cleaner workbook should import all twelve availability windows.');
  check(config.windows.some((window) => window.cleaner === 'Miurish' && window.day === '2026-10-21' && window.start === 510 && window.end === 1140), 'A Dia todo entry should import as an 8:30 AM–7:00 PM window.');
  check(config.windows.some((window) => window.cleaner === 'Leidiane' && window.day === '2026-10-19' && window.start === 750 && window.end === 1140), 'An A partir das entry should import through the end of the operating day.');
  const slots = globalThis.CleaningCleanerAvailability.importedSlots(config, '2026-10-21', 240);
  check(globalThis.CleaningCleanerAvailability.safeImportedSlots(config, '2026-10-21', 240, [{ cleaners: ['miurish'] }]).length === 0, 'An imported cleaner with an existing job must not be offered without routing.');
  check(globalThis.CleaningCleanerAvailability.safeImportedSlots(config, '2026-10-21', 240, [{ cleaners: [] }]).length === 0, 'An unassigned job must block uncertain imported availability.');
  check(slots.length === 1 && slots[0].cleaner === 'Miurish' && slots[0].start === 510, 'Imported slots must be offered no earlier than 8:30 AM when the full service duration fits.');
  check(globalThis.CleaningCleanerAvailability.importedSlots(config, '2026-10-22', 240).length === 1, 'A three-hour imported window must not be offered for a four-hour service.');
  console.log('Cleaner availability import checks passed.');
})().catch((error) => { console.error(error); process.exit(1); });
