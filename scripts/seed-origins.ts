/**
 * Imports the geographic origin of materials from the lab inventory file
 * (sheets "Stock MP - Complexes" column Origin, "Stock MP - Biologiques"
 * column Origine, "Commandes passées Chaehan" column Provenance) and fills
 * the countries table used by the world map.
 *
 * Rows are matched to materials of every team by CAS number, then by name.
 * Origins are added to what a material already has (nothing is removed).
 * Unmatched rows are written to data/origins-unmatched.json.
 *
 *   npm run seed:origins
 */
import ExcelJS from 'exceljs';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { seedAdapter } from './seed-db.js';
import 'dotenv/config';
import {
  COUNTRIES,
  normalizePlace,
  parseOrigins,
} from '../src/library/countries.js';
import { splitCas } from '../src/regulations/regulation-rules.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_FILE = join(
  __dirname,
  '..',
  'data',
  'raw-materials-rangement.xlsx',
);
const UNMATCHED_FILE = join(__dirname, '..', 'data', 'origins-unmatched.json');

const SHEETS = [
  {
    name: 'Stock MP - Complexes',
    origin: ['Origin'],
    names: ['Name', 'Nom'],
    cas: ['CAS'],
  },
  {
    name: 'Stock MP - Biologiques',
    origin: ['Origine'],
    names: ['Nom'],
    cas: ['N° CAS'],
  },
  {
    name: 'Commandes passées Chaehan',
    origin: ['Provenance'],
    names: ['Nom'],
    cas: [],
  },
];

function unwrap(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object' && !(value instanceof Date)) {
    if ('error' in value) return null;
    if ('result' in value) return unwrap(value.result as ExcelJS.CellValue);
    if ('richText' in value)
      return value.richText.map((part) => part.text).join('');
    if ('text' in value) return value.text;
  }
  return value;
}

const text = (value: unknown) =>
  value === null || value === undefined || value instanceof Date
    ? ''
    : String(value).replace(/\s+/g, ' ').trim();

const nameKey = (name: string) =>
  normalizePlace(name)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

interface OriginRow {
  sheet: string;
  row: number;
  names: string[];
  cas: string[];
  places: string[];
  raw: string;
}

async function readRows(): Promise<{
  rows: OriginRow[];
  unknownPlaces: Map<string, number>;
}> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(SOURCE_FILE);
  const rows: OriginRow[] = [];
  const unknownPlaces = new Map<string, number>();

  for (const sheet of SHEETS) {
    const ws = workbook.getWorksheet(sheet.name);
    if (!ws) throw new Error(`Feuille introuvable : ${sheet.name}`);
    // The header row is the first one holding the origin column title.
    let header = 0;
    const columns = new Map<string, number>();
    for (let r = 1; r <= 5 && !header; r++) {
      ws.getRow(r).eachCell((cell, col) => {
        const title = text(unwrap(cell.value));
        if (sheet.origin.includes(title)) header = r;
        if (title && !columns.has(title)) columns.set(title, col);
      });
      if (!header) columns.clear();
    }
    if (!header)
      throw new Error(`Colonne d'origine introuvable dans ${sheet.name}`);
    const col = (titles: string[]) =>
      titles.map((t) => columns.get(t)).filter((c): c is number => !!c);

    ws.eachRow((row, index) => {
      if (index <= header) return;
      const get = (c: number) => text(unwrap(row.getCell(c).value));
      const raw = col(sheet.origin).map(get).find(Boolean) ?? '';
      if (!raw) return;
      const { places, unknown } = parseOrigins(raw);
      for (const u of unknown)
        unknownPlaces.set(u, (unknownPlaces.get(u) ?? 0) + 1);
      if (places.length === 0) return;
      rows.push({
        sheet: sheet.name,
        row: index,
        names: col(sheet.names).map(get).filter(Boolean),
        cas: col(sheet.cas).flatMap((c) =>
          splitCas(get(c).replace(/\s+/g, '-')),
        ),
        places,
        raw,
      });
    });
  }
  return { rows, unknownPlaces };
}

async function main() {
  const prisma = new PrismaClient({
    adapter: seedAdapter(),
  });

  for (const country of COUNTRIES) {
    await prisma.country.upsert({
      where: { name: country.name },
      create: country,
      update: country,
    });
  }

  const { rows, unknownPlaces } = await readRows();
  const materials = await prisma.material.findMany({
    select: {
      id: true,
      teamId: true,
      name: true,
      casNumber: true,
      originCountries: true,
    },
  });
  const byCas = new Map<string, typeof materials>();
  const byName = new Map<string, typeof materials>();
  for (const m of materials) {
    for (const c of splitCas(m.casNumber))
      byCas.set(c, [...(byCas.get(c) ?? []), m]);
    byName.set(nameKey(m.name), [...(byName.get(nameKey(m.name)) ?? []), m]);
  }

  const additions = new Map<string, Set<string>>();
  const unmatched: OriginRow[] = [];
  for (const row of rows) {
    const found = new Set<(typeof materials)[number]>();
    for (const c of row.cas) for (const m of byCas.get(c) ?? []) found.add(m);
    if (found.size === 0) {
      for (const n of row.names)
        for (const m of byName.get(nameKey(n)) ?? []) found.add(m);
    }
    if (found.size === 0) {
      unmatched.push(row);
      continue;
    }
    for (const m of found) {
      const set =
        additions.get(m.id) ??
        new Set(
          Array.isArray(m.originCountries)
            ? (m.originCountries as string[])
            : [],
        );
      for (const p of row.places) set.add(p);
      additions.set(m.id, set);
    }
  }

  for (const [id, places] of additions) {
    await prisma.material.update({
      where: { id },
      data: { originCountries: [...places] },
    });
  }
  await writeFile(UNMATCHED_FILE, JSON.stringify(unmatched, null, 2));

  console.log(`${COUNTRIES.length} pays et régions.`);
  console.log(
    `${rows.length} lignes avec une origine ; ${additions.size} matières mises à jour.`,
  );
  console.log(
    `${unmatched.length} lignes non rapprochées d'une matière : voir data/origins-unmatched.json.`,
  );
  if (unknownPlaces.size > 0) {
    console.log(
      'Lieux non reconnus :',
      [...unknownPlaces.entries()].map(([k, n]) => `${k} (${n})`).join(', '),
    );
  }
  await prisma.$disconnect();
}

await main();
