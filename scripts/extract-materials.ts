import ExcelJS from 'exceljs';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_FILE = join(__dirname, '..', 'data', 'raw-materials-radar-bases.xlsx');
const OUTPUT_FILE = join(__dirname, '..', 'data', 'materials.json');
const SHEET_NAME = 'Tableau synthèse';

const DESCRIPTOR_COLUMNS = [
  'Acidulé',
  'Sec',
  'Aldéhydé',
  'Fraicheur',
  'Vert',
  'Camphré',
  'Aromatique',
  'Epicé',
  'Résineux',
  'Musqué',
  'Ambré',
  'Poudré',
  'Chypré',
  'Gras',
  'Animalisé',
  'Boisé',
  'Terreux',
  'Balsamique',
  'Fumé',
  'Marin',
  'Floral',
  'Gourmand',
  'Lacté',
  'Fruité',
];

interface Material {
  id: string;
  casNumber: string | null;
  name: string;
  family: string | null;
  sensation: string | null;
  weight: number | null;
  subjectivePower: number | null;
  descriptors: Record<string, number>;
}

function cleanText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/ /g, ' ').trim();
  return text.length > 0 ? text : null;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(SOURCE_FILE);

  const sheet = workbook.getWorksheet(SHEET_NAME);
  if (!sheet) {
    throw new Error(`Sheet "${SHEET_NAME}" not found in ${SOURCE_FILE}`);
  }

  const columnIndex = new Map<string, number>();
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const label = cleanText(cell.value);
    if (label) columnIndex.set(label, colNumber);
  });

  const requiredColumns = ['Nom Base', ...DESCRIPTOR_COLUMNS];
  for (const col of requiredColumns) {
    if (!columnIndex.has(col)) {
      throw new Error(`Expected column "${col}" not found in sheet header`);
    }
  }

  const materials: Material[] = [];
  const seenSlugs = new Set<string>();

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const get = (col: string) => {
      const index = columnIndex.get(col);
      return index === undefined ? null : row.getCell(index).value;
    };
    const name = cleanText(get('Nom Base'));
    if (!name) return;

    const descriptors: Record<string, number> = {};
    let hasAnyScore = false;
    for (const col of DESCRIPTOR_COLUMNS) {
      const value = toNumber(get(col));
      if (value !== null && value !== 0) hasAnyScore = true;
      descriptors[col] = value ?? 0;
    }

    // Rows past the quantified section (e.g. "NOTE FEMININE"/"NOTE MASCULINE")
    // only carry a qualitative "Sensation" text with no numeric descriptor
    // scores. Skip them until they get real scores — see extraction notes.
    if (!hasAnyScore) return;

    let slug = slugify(name);
    if (seenSlugs.has(slug)) {
      let suffix = 2;
      while (seenSlugs.has(`${slug}-${suffix}`)) suffix++;
      slug = `${slug}-${suffix}`;
    }
    seenSlugs.add(slug);

    materials.push({
      id: slug,
      casNumber: cleanText(get('NumBase')),
      name,
      family: cleanText(get('Famille')),
      sensation: cleanText(get('Sensation')),
      weight: toNumber(get('Poids')),
      subjectivePower: toNumber(get('Puissance subjective')),
      descriptors,
    });
  });

  await writeFile(OUTPUT_FILE, JSON.stringify(materials, null, 2), 'utf-8');

  console.log(`Extracted ${materials.length} materials -> ${OUTPUT_FILE}`);
  console.log('Sample:', JSON.stringify(materials[0], null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
