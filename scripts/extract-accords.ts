import ExcelJS from 'exceljs';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_FILE = join(__dirname, '..', 'data', 'raw-materials-radar-bases.xlsx');
const OUTPUT_FILE = join(__dirname, '..', 'data', 'accords.json');

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

interface AccordLine {
  name: string;
  quantity: number;
  descriptors: Record<string, number>;
}

interface AccordSheetConfig {
  sheetName: string;
  formulaId: string;
  formulaName: string;
  headerRow: number;
  quantityCol: number;
  nameCol: number;
  startRow: number;
  endRow: number;
}

const SHEETS: AccordSheetConfig[] = [
  {
    sheetName: 'Ambre vert',
    formulaId: 'ambre-vert',
    formulaName: 'Ambre vert',
    headerRow: 3,
    quantityCol: 1,
    nameCol: 4,
    startRow: 4,
    endRow: 14,
  },
  {
    sheetName: 'Ambre oriental',
    formulaId: 'ambre-oriental',
    formulaName: 'Ambre oriental',
    headerRow: 2,
    quantityCol: 1,
    nameCol: 2,
    startRow: 3,
    endRow: 12,
  },
  {
    sheetName: 'Tubéreuse',
    formulaId: 'tubereuse',
    formulaName: 'Tubéreuse',
    headerRow: 3,
    quantityCol: 2,
    nameCol: 3,
    startRow: 4,
    endRow: 36,
  },
];

function cleanText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return null; // formula result objects, skip
  const text = String(value).replace(/ /g, ' ').trim();
  return text.length > 0 ? text : null;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object') {
    const result = (value as { result?: unknown }).result;
    return typeof result === 'number' ? result : null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(SOURCE_FILE);

  const accords: { id: string; name: string; lines: AccordLine[] }[] = [];

  for (const config of SHEETS) {
    const sheet = workbook.getWorksheet(config.sheetName);
    if (!sheet) throw new Error(`Sheet "${config.sheetName}" not found`);

    const columnIndex = new Map<string, number>();
    sheet.getRow(config.headerRow).eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const label = cleanText(cell.value);
      if (label) columnIndex.set(label, colNumber);
    });

    for (const col of DESCRIPTOR_COLUMNS) {
      if (!columnIndex.has(col)) {
        throw new Error(
          `Expected descriptor column "${col}" not found in sheet "${config.sheetName}"`,
        );
      }
    }

    const lines: AccordLine[] = [];

    for (let r = config.startRow; r <= config.endRow; r++) {
      const row = sheet.getRow(r);
      const name = cleanText(row.getCell(config.nameCol).value);
      const quantity = toNumber(row.getCell(config.quantityCol).value);
      if (!name || quantity === null) continue;

      const descriptors: Record<string, number> = {};
      for (const col of DESCRIPTOR_COLUMNS) {
        descriptors[col] = toNumber(row.getCell(columnIndex.get(col)!).value) ?? 0;
      }

      lines.push({ name, quantity, descriptors });
    }

    accords.push({ id: config.formulaId, name: config.formulaName, lines });
    console.log(`${config.formulaName}: ${lines.length} lines extracted`);
  }

  await writeFile(OUTPUT_FILE, JSON.stringify(accords, null, 2), 'utf-8');
  console.log(`-> ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
