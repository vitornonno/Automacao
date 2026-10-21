const fs = require('fs');
const importer = require('./xlsx-import.js');
require('./cleaner-availability.js');

function check(condition, message) { if (!condition) throw new Error(message); }

(async () => {
  const workbook = fs.readFileSync('../docs/Disponibilidade_Cleaners_KACS.xlsx');
  const config = await importer.parseCleanerAvailabilityWorkbook(workbook.buffer.slice(workbook.byteOffset, workbook.byteOffset + workbook.byteLength), { company: 'kacs', year: 2026 });
  check(config.windows.length === 10, 'The KACS cleaner workbook should import all ten availability windows.');
  check(config.windows.some((window) => window.cleaner === 'Miurish' && window.day === '2026-10-21' && window.start === 480 && window.end === 1140), 'A Dia todo entry should import as an 8:00 AM–7:00 PM window.');
  check(config.windows.some((window) => window.cleaner === 'Leidiane' && window.day === '2026-10-19' && window.start === 750 && window.end === 1140), 'An A partir das entry should import through the end of the operating day.');
  const slots = globalThis.CleaningCleanerAvailability.importedSlots(config, '2026-10-21', 240);
  check(slots.length === 1 && slots[0].cleaner === 'Miurish' && slots[0].start === 480, 'Imported slots must be offered only when the full service duration fits.');
  check(globalThis.CleaningCleanerAvailability.importedSlots(config, '2026-10-22', 240).length === 1, 'A three-hour imported window must not be offered for a four-hour service.');
  console.log('Cleaner availability import checks passed.');
})().catch((error) => { console.error(error); process.exit(1); });
