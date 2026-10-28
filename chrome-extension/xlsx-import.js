/* global DecompressionStream */
(function xlsxImportModule(root) {
  'use strict';

  const textDecoder = new TextDecoder();

  function xmlText(value) {
    return String(value || '')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#(x[\da-f]+|\d+);/gi, (_, code) => String.fromCodePoint(String(code).toLowerCase().startsWith('x') ? parseInt(code.slice(1), 16) : parseInt(code, 10)));
  }

  async function inflate(bytes, method) {
    if (method === 0) return bytes;
    if (method !== 8 || typeof DecompressionStream === 'undefined') throw new Error('This Excel file uses an unsupported compression format.');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function unzip(buffer) {
    const data = new Uint8Array(buffer);
    const view = new DataView(buffer);
    let end = -1;
    for (let index = data.length - 22; index >= Math.max(0, data.length - 65557); index -= 1) {
      if (view.getUint32(index, true) === 0x06054b50) { end = index; break; }
    }
    if (end < 0) throw new Error('The selected file is not a valid Excel workbook.');
    const entries = new Map();
    let cursor = view.getUint32(end + 16, true);
    const count = view.getUint16(end + 10, true);
    for (let index = 0; index < count; index += 1) {
      if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('The Excel workbook directory could not be read.');
      const method = view.getUint16(cursor + 10, true);
      const compressedSize = view.getUint32(cursor + 20, true);
      const nameLength = view.getUint16(cursor + 28, true);
      const extraLength = view.getUint16(cursor + 30, true);
      const commentLength = view.getUint16(cursor + 32, true);
      const localOffset = view.getUint32(cursor + 42, true);
      const name = textDecoder.decode(data.slice(cursor + 46, cursor + 46 + nameLength));
      if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error('The Excel workbook contains an invalid file entry.');
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      entries.set(name, textDecoder.decode(await inflate(data.slice(start, start + compressedSize), method)));
      cursor += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
  }

  function sharedStrings(xml) {
    if (!xml) return [];
    return [...xml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map((match) => xmlText(match[1]));
  }

  function columnIndex(reference) {
    return [...String(reference || '').match(/^[A-Z]+/i)?.[0] || 'A'].reduce((total, letter) => total * 26 + letter.toUpperCase().charCodeAt(0) - 64, 0) - 1;
  }

  function worksheetRows(xml, strings) {
    const rows = [];
    for (const rowMatch of xml.matchAll(/<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g)) {
      const values = [];
      for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
        const attributes = cellMatch[1]; const body = cellMatch[2];
        const reference = /\br="([A-Z]+\d+)"/i.exec(attributes)?.[1];
        const type = /\bt="([^"]+)"/.exec(attributes)?.[1];
        const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        const inline = /<is>([\s\S]*?)<\/is>/.exec(body)?.[1];
        const value = type === 's' ? strings[Number(raw)] : type === 'inlineStr' ? xmlText(inline) : xmlText(raw);
        values[columnIndex(reference)] = value;
      }
      rows.push(values);
    }
    return rows;
  }

  function minutes(value) {
    const match = /(?:\b(?:from|das)\s*)?(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\b/i.exec(String(value || ''));
    if (!match) return null;
    let hour = Number(match[1]) % 12;
    if (match[3].toUpperCase() === 'PM') hour += 12;
    return hour * 60 + Number(match[2] || 0);
  }

  function windowsFromCell(value) {
    const normalized = String(value || '').trim();
    if (!normalized || /^[—–-]$/.test(normalized)) return [];
    if (/dia\s+todo/i.test(normalized)) return [{ start: 510, end: 1140 }];
    const times = [...normalized.matchAll(/\d{1,2}(?::\d{2})?\s*(?:AM|PM)/gi)].map((match) => minutes(match[0])).filter(Number.isFinite);
    if (!times.length) return [];
    return [{ start: times[0], end: times[1] || 1140 }].filter((window) => window.end > window.start);
  }

  function headerDates(row, year, previousMonth) {
    let lastMonth = previousMonth;
    let resolvedYear = year;
    return row.map((value) => {
      const match = /(\d{1,2})\/(\d{1,2})/.exec(String(value || ''));
      if (!match) return null;
      const day = Number(match[1]); const month = Number(match[2]);
      if (Number.isFinite(lastMonth) && month < lastMonth) resolvedYear += 1;
      lastMonth = month;
      return { date: `${resolvedYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, month, year: resolvedYear };
    });
  }

  async function parseCleanerAvailabilityWorkbook(buffer, { company = 'kacs', year = new Date().getFullYear() } = {}) {
    const files = await unzip(buffer);
    const sheet = [...files.entries()].find(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))?.[1];
    if (!sheet) throw new Error('No worksheet was found in this Excel file.');
    const rows = worksheetRows(sheet, sharedStrings(files.get('xl/sharedStrings.xml')));
    const windows = [];
    let priorMonth = null;
    let currentYear = Number(year);
    for (let index = 0; index < rows.length; index += 1) {
      const header = rows[index];
      if (!/^cleaner$/i.test(String(header?.[0] || '').trim())) continue;
      const dates = headerDates(header, currentYear, priorMonth);
      const foundDates = dates.filter(Boolean);
      if (foundDates.length) { priorMonth = foundDates.at(-1).month; currentYear = foundDates.at(-1).year; }
      for (let rowIndex = index + 1; rowIndex < rows.length && !/^cleaner$/i.test(String(rows[rowIndex]?.[0] || '').trim()); rowIndex += 1) {
        const cleaner = String(rows[rowIndex]?.[0] || '').trim();
        if (!cleaner) continue;
        dates.forEach((headerDate, column) => {
          if (!headerDate) return;
          windowsFromCell(rows[rowIndex]?.[column]).forEach((window) => windows.push({ cleaner, day: headerDate.date, ...window }));
        });
      }
    }
    if (!windows.length) throw new Error('No cleaner availability windows were found. Check the Cleaner and date headers in the spreadsheet.');
    return { company, importedAt: new Date().toISOString(), year: Number(year), windows };
  }

  const api = { parseCleanerAvailabilityWorkbook, headerDates };
  root.CleaningXlsxImporter = api;
  if (typeof module !== 'undefined') module.exports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
