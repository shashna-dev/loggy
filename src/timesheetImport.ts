import type { TimeEntry } from './types';
import { minutesToTime, timeToMinutes } from './utils';

export interface ImportedTimesheetRow {
  id: string;
  workerName?: string;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  notes: string;
  sourceText: string;
  confidence: 'high' | 'medium' | 'low';
}

const monthLookup: Record<string, string> = {
  jan: '01',
  january: '01',
  feb: '02',
  february: '02',
  mar: '03',
  march: '03',
  apr: '04',
  april: '04',
  may: '05',
  jun: '06',
  june: '06',
  jul: '07',
  july: '07',
  aug: '08',
  august: '08',
  sep: '09',
  sept: '09',
  september: '09',
  oct: '10',
  october: '10',
  nov: '11',
  november: '11',
  dec: '12',
  december: '12'
};

function normalizeDate(value: string): string | null {
  const cleaned = value.trim().replace(/,/g, '');
  const iso = cleaned.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  }

  const slashDate = cleaned.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/);
  if (slashDate) {
    const year = slashDate[3].length === 2 ? `20${slashDate[3]}` : slashDate[3];
    const first = Number(slashDate[1]);
    const second = Number(slashDate[2]);
    const month = first > 12 ? second : first;
    const day = first > 12 ? first : second;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const monthDate = cleaned.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})\s+(20\d{2})\b/i
  );
  if (monthDate) {
    return `${monthDate[3]}-${monthLookup[monthDate[1].toLowerCase()]}-${monthDate[2].padStart(2, '0')}`;
  }

  return null;
}

function normalizeTime(value: string): string | null {
  const match = value.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?$/);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2] || '0');
  const meridiem = match[3]?.replace(/\./g, '');

  if (minutes > 59 || hours > 23) return null;
  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function extractTimes(line: string): string[] {
  const matches = line.match(/\b(?:[01]?\d|2[0-3]):[0-5]\d\s*(?:am|pm|a\.m\.|p\.m\.)?\b|\b(?:[1-9]|1[0-2])\s*(?:am|pm|a\.m\.|p\.m\.)\b/gi) || [];
  return matches
    .map(match => normalizeTime(match))
    .filter((time): time is string => Boolean(time));
}

function extractBreakMinutes(line: string): number {
  const breakMatch = line.match(/\b(?:break|lunch)\D{0,12}(\d{1,3})\b/i);
  if (breakMatch) return Number(breakMatch[1]);

  const decimalBreak = line.match(/\b(?:break|lunch)\D{0,12}(0\.\d+|1(?:\.0)?)\b/i);
  if (decimalBreak) return Math.round(Number(decimalBreak[1]) * 60);

  return 0;
}

function extractHours(line: string): number | null {
  const hoursMatch = line.match(/\b(\d{1,2}(?:\.\d{1,2})?)\s*(?:hrs?|hours?)\b/i);
  return hoursMatch ? Number(hoursMatch[1]) : null;
}

function inferEndTime(startTime: string, hours: number, breakMinutes: number): string {
  return minutesToTime((timeToMinutes(startTime) + Math.round(hours * 60) + breakMinutes) % (24 * 60));
}

function extractWorkerName(line: string): string | undefined {
  const namedMatch = line.match(/\b(?:name|worker|employee|staff)\s*[:\-]\s*([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3})/);
  if (namedMatch) return namedMatch[1].trim();

  const leadingName = line.match(/^([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3})\s+.*(?:20\d{2}|\d{1,2}[-/]\d{1,2})/);
  return leadingName?.[1]?.trim();
}

function parseDelimitedText(text: string): ImportedTimesheetRow[] {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].split(delimiter).map(header => header.trim().toLowerCase());
  const hasUsableHeaders = headers.some(header => /date|start|in|end|out|hours|break|name|worker|notes/.test(header));
  if (!hasUsableHeaders) return [];

  const findIndex = (patterns: RegExp[]) => headers.findIndex(header => patterns.some(pattern => pattern.test(header)));
  const dateIdx = findIndex([/date/, /day/]);
  const startIdx = findIndex([/start/, /clock.?in/, /^in$/]);
  const endIdx = findIndex([/end/, /clock.?out/, /^out$/]);
  const breakIdx = findIndex([/break/, /lunch/]);
  const hoursIdx = findIndex([/hours?/, /^hrs$/]);
  const nameIdx = findIndex([/name/, /worker/, /employee/, /staff/]);
  const notesIdx = findIndex([/note/, /task/, /description/]);

  return lines.slice(1).flatMap((line, index) => {
    const cells = line.split(delimiter).map(cell => cell.trim());
    const date = dateIdx >= 0 ? normalizeDate(cells[dateIdx]) : null;
    const startTime = startIdx >= 0 ? normalizeTime(cells[startIdx]) : null;
    let endTime = endIdx >= 0 ? normalizeTime(cells[endIdx]) : null;
    const breakMinutes = breakIdx >= 0 ? Number(cells[breakIdx] || 0) : 0;
    const hours = hoursIdx >= 0 ? Number(cells[hoursIdx] || 0) : null;

    if (!date || !startTime) return [];
    if (!endTime && hours && hours > 0) {
      endTime = inferEndTime(startTime, hours, breakMinutes);
    }
    if (!endTime) return [];

    return [{
      id: `import-${Date.now()}-${index}`,
      workerName: nameIdx >= 0 ? cells[nameIdx] : undefined,
      date,
      startTime,
      endTime,
      breakMinutes,
      notes: notesIdx >= 0 ? cells[notesIdx] : 'Imported from uploaded timesheet.',
      sourceText: line,
      confidence: 'high' as const
    }];
  });
}

export function parseTimesheetText(text: string): ImportedTimesheetRow[] {
  const delimitedRows = parseDelimitedText(text);
  if (delimitedRows.length > 0) return delimitedRows;

  const lines = text
    .split(/\r?\n/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(line => line.length > 6);

  return lines.flatMap((line, index) => {
    const dateMatch = line.match(
      /\b(?:20\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2},?\s+20\d{2})\b/i
    );
    const date = dateMatch ? normalizeDate(dateMatch[0]) : null;
    const times = extractTimes(line);
    const breakMinutes = extractBreakMinutes(line);
    const hours = extractHours(line);

    if (!date || times.length === 0) return [];

    const startTime = times[0];
    const endTime = times[1] || (hours ? inferEndTime(startTime, hours, breakMinutes) : null);
    if (!endTime) return [];

    return [{
      id: `import-${Date.now()}-${index}`,
      workerName: extractWorkerName(line),
      date,
      startTime,
      endTime,
      breakMinutes,
      notes: 'Imported from uploaded timesheet.',
      sourceText: line,
      confidence: times.length >= 2 ? 'medium' as const : 'low' as const
    }];
  });
}

export function importedRowsToTimeEntries(
  rows: ImportedTimesheetRow[],
  sourceLabel = 'uploaded timesheet'
): TimeEntry[] {
  return rows.map((row, index) => ({
    id: `te-import-${Date.now()}-${index}`,
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    breakMinutes: row.breakMinutes,
    notes: row.workerName
      ? `Imported from ${sourceLabel}. Source worker: ${row.workerName}.`
      : `Imported from ${sourceLabel}.`,
    regularHours: 0,
    overtimeHours: 0,
    doubleTimeHours: 0
  }));
}
