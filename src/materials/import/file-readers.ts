import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { ACCEPTED_EXTENSIONS } from './import-format.js';

/** A sheet as plain rows of cell values (strings, numbers, booleans, dates or null). */
export interface Table {
  name: string;
  rows: unknown[][];
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? '' : fileName.slice(dot).toLowerCase();
}

export async function readTables(fileName: string, buffer: Buffer): Promise<Table[]> {
  const extension = extensionOf(fileName);
  switch (extension) {
    case '.xlsx':
    case '.xlsm':
      return readExcel(buffer);
    case '.csv':
    case '.tsv':
    case '.txt':
      return [{ name: fileName, rows: parseDelimited(decodeText(buffer)) }];
    case '.json':
      return [{ name: fileName, rows: readJson(decodeText(buffer)) }];
    case '.xls':
      throw new BadRequestException(
        "Ancien format Excel (.xls) non pris en charge : ouvrez le fichier dans Excel et enregistrez-le en .xlsx.",
      );
    default:
      throw new BadRequestException(
        `Format non pris en charge. Formats acceptés : ${ACCEPTED_EXTENSIONS.join(', ')}.`,
      );
  }
}

// ---------------------------------------------------------------- Excel ---

function unwrap(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object' && !(value instanceof Date)) {
    if ('error' in value) return null;
    if ('result' in value) return unwrap(value.result as ExcelJS.CellValue);
    if ('richText' in value) return value.richText.map((part) => part.text).join('');
    if ('text' in value) return value.text;
  }
  return value;
}

async function readExcel(buffer: Buffer): Promise<Table[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new BadRequestException("Le fichier Excel est illisible ou endommagé.");
  }
  return workbook.worksheets.map((sheet) => {
    const rows: unknown[][] = [];
    sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const values: unknown[] = [];
      row.eachCell({ includeEmpty: true }, (cell, column) => {
        let value = unwrap(cell.value);
        // A percentage cell holds a fraction (0.006 shown as 0,6 %): keep what the user sees.
        if (typeof value === 'number' && cell.numFmt?.includes('%')) {
          value = `${Number((value * 100).toFixed(6))} %`;
        }
        values[column - 1] = value;
      });
      rows[rowNumber - 1] = values;
    });
    return { name: sheet.name, rows: Array.from(rows, (row) => row ?? []) };
  });
}

// -------------------------------------------------------- CSV / TSV / TXT ---

/** UTF-8 (with or without BOM), falling back to Windows-1252 as written by Excel on Windows. */
function decodeText(buffer: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim() !== '') ?? '';
  const counts = [';', ',', '\t'].map((delimiter) => ({
    delimiter,
    count: firstLine.split(delimiter).length - 1,
  }));
  counts.sort((a, b) => b.count - a.count);
  return counts[0].count > 0 ? counts[0].delimiter : ';';
}

/** RFC 4180 parsing: quoted fields may hold delimiters, line breaks and doubled quotes. */
export function parseDelimited(text: string): string[][] {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field === '') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ------------------------------------------------------------------ JSON ---

/** An array of objects (or { materials: [...] }): the keys act as column headers. */
function readJson(text: string): unknown[][] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BadRequestException('Le fichier JSON est invalide.');
  }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const list = Object.values(data as Record<string, unknown>).find(Array.isArray);
    data = list ?? [data];
  }
  if (!Array.isArray(data)) {
    throw new BadRequestException('Le fichier JSON doit contenir une liste de matières premières.');
  }
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
  // Nested objects such as { "descriptors": { "Floral": 5 } } become columns of their own.
  const items = data.filter(isRecord).map((item) =>
    Object.fromEntries(
      Object.entries(item).flatMap(([key, value]) =>
        isRecord(value) ? Object.entries(value) : [[key, value]],
      ),
    ),
  );
  const headers = [...new Set(items.flatMap((item) => Object.keys(item)))];
  return [
    headers,
    ...items.map((item) =>
      headers.map((header) => {
        const value = item[header];
        if (Array.isArray(value)) return value.join(', ');
        return value !== null && typeof value === 'object' ? JSON.stringify(value) : value;
      }),
    ),
  ];
}
