import ExcelJS from 'exceljs';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_FILE = join(__dirname, '..', 'data', 'raw-materials-rangement.xlsx');
const OUTPUT_FILE = join(__dirname, '..', 'data', 'inventory.json');

type Nature = 'natural' | 'synthetic';

// Column numbers (1-based) of each field in the two inventory sheets. The
// headers are inconsistent between sheets (e.g. the synthetic sheet labels its
// location column "FRESH TE"), so columns are mapped by position.
interface SheetLayout {
  name: string;
  nature: Nature;
  firstDataRow: number;
  columns: {
    name: number;
    cas: number;
    ifraCat4: number;
    cosmeticRegulation: number;
    allergens?: number;
    supplier: number;
    location: number;
    flavor: number;
    flavorRestriction?: number;
    stock: number;
  };
}

const SHEETS: SheetLayout[] = [
  {
    name: 'MP Synthétiques',
    nature: 'synthetic',
    firstDataRow: 2,
    columns: { name: 1, cas: 2, ifraCat4: 3, cosmeticRegulation: 4, supplier: 5, location: 6, flavor: 7, stock: 8 },
  },
  {
    name: 'MP Naturelles',
    nature: 'natural',
    firstDataRow: 3,
    columns: {
      name: 1,
      cas: 2,
      allergens: 4,
      cosmeticRegulation: 5,
      ifraCat4: 6,
      supplier: 7,
      location: 8,
      flavor: 9,
      flavorRestriction: 10,
      stock: 11,
    },
  },
];

// Leftover cell fragments sitting in the name column (e.g. "ok", "m", "AD").
const MIN_NAME_LENGTH = 3;
const JUNK_NAMES = new Set(['ok']);

// Reference list of suppliers/producers, numbered in column A, name in column B.
const SUPPLIER_SHEET = 'Fournisseurs - Producteurs';

// Spellings found in the inventory sheets, keyed by supplierKey(), mapped to
// the name used in the reference sheet. Suppliers missing from the reference
// sheet get a single canonical spelling too.
const SUPPLIER_ALIASES: Record<string, string> = {
  diffusionaromatique: 'Diffusion Aromatiques',
  diffusionaromatiques: 'Diffusion Aromatiques',
  diffusionsaromatiques: 'Diffusion Aromatiques',
  ies: 'IES (Albert Vieille)',
  iesingredient: 'IES (Albert Vieille)',
  albertvieille: 'IES (Albert Vieille)',
  astierdesmaret: 'Astier Demarest',
  dsmfirmenich: 'Firmenich',
  bulkaroma: 'Bulkaroma',
  aromazone: 'Aroma-Zone',
  voaromatique: 'VO Aromatiques',
  voaromatiques: 'VO Aromatiques',
  versionsoriginalesaromatiques: 'VO Aromatiques',
  prodaress: 'Prodaress',
};

// Storage locations typed in the supplier column.
const LOCATIONS_IN_SUPPLIER_COLUMN = new Set(['e2f2', 'ghi']);

function supplierKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

interface SupplierFields {
  supplier: string | null;
  producer: string | null;
  location: string | null;
}

function makeSupplierResolver(referenceNames: string[]) {
  const canonical = new Map<string, string>(referenceNames.map((name) => [supplierKey(name), name]));
  for (const [alias, name] of Object.entries(SUPPLIER_ALIASES)) canonical.set(alias, name);
  const resolve = (name: string) => canonical.get(supplierKey(name)) ?? name;

  return (rawSupplier: string | null, location: string | null): SupplierFields => {
    if (!rawSupplier) return { supplier: null, producer: null, location };

    if (LOCATIONS_IN_SUPPLIER_COLUMN.has(supplierKey(rawSupplier))) {
      return { supplier: null, producer: null, location: [rawSupplier, location].filter(Boolean).join(' / ') };
    }

    // "Givaudan par Bulkaroma" (also typed "pas"): bought from Bulkaroma,
    // made by Givaudan. "BLH - Firmenich": bought from BLH, made by Firmenich.
    const viaDistributor = /^(.+?)\s+pa[rs]\s+(.+)$/i.exec(rawSupplier);
    if (viaDistributor) {
      return { supplier: resolve(viaDistributor[2]), producer: resolve(viaDistributor[1]), location };
    }
    const withProducer = /^(.+?)\s+-\s+(.+)$/.exec(rawSupplier);
    if (withProducer) {
      return { supplier: resolve(withProducer[1]), producer: resolve(withProducer[2]), location };
    }

    return { supplier: resolve(rawSupplier), producer: null, location };
  };
}

export interface InventoryEntry {
  name: string;
  nature: Nature;
  casNumber: string | null;
  ifraCat4: string | null;
  cosmeticRegulation: string | null;
  allergens: string | null;
  flavor: string | null;
  flavorRestriction: string | null;
  supplier: string | null;
  producer: string | null;
  location: string | null;
  stockGrams: number | null;
  stockNote: string | null;
  sheet: string;
  row: number;
}

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

function cleanText(value: unknown): string | null {
  if (value === null || value === undefined || value instanceof Date) return null;
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text.length > 0 && text !== '?' ? text : null;
}

const CAS_PATTERN = /^\d{2,7}-\d{2}-\d$/;

// CAS numbers come in several broken shapes: space-separated ("97 53 0"),
// zero-padded by a date format ("0100-06-01" for 100-06-1), or replaced by a
// name ("Frambinone"). Multiple CAS are kept, joined with "/".
function normalizeCas(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) return null;

  const parts = text
    .split(/[/,]/)
    .map((part) =>
      part
        .trim()
        .replace(/^(\d+)\s+(\d{2})\s+(\d)$/, '$1-$2-$3')
        .replace(/^0*(\d{2,7})-(\d{2})-0?(\d)$/, '$1-$2-$3'),
    )
    .filter((part) => CAS_PATTERN.test(part));
  return parts.length > 0 ? parts.join('/') : null;
}

// A date in the CAS or stock column is Excel misreading the original text
// (e.g. "4350-09-1" or "5,2"); the original value can't be recovered.
function parseStock(value: unknown): { stockGrams: number | null; stockNote: string | null } {
  if (typeof value === 'number') return { stockGrams: value, stockNote: null };
  const text = cleanText(value);
  if (!text) return { stockGrams: null, stockNote: null };

  const match = /^(\d+(?:[.,]\d+)?)\s*(kg|g|gr)?$/i.exec(text);
  if (!match) return { stockGrams: null, stockNote: text };

  const amount = Number(match[1].replace(',', '.'));
  const factor = match[2]?.toLowerCase() === 'kg' ? 1000 : 1;
  return { stockGrams: amount * factor, stockNote: null };
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(SOURCE_FILE);

  const supplierSheet = workbook.getWorksheet(SUPPLIER_SHEET);
  if (!supplierSheet) {
    throw new Error(`Sheet "${SUPPLIER_SHEET}" not found in ${SOURCE_FILE}`);
  }
  const referenceSuppliers: string[] = [];
  supplierSheet.eachRow({ includeEmpty: false }, (row) => {
    const name = cleanText(unwrap(row.getCell(2).value));
    if (name) referenceSuppliers.push(name);
  });
  const resolveSupplier = makeSupplierResolver(referenceSuppliers);

  const entries: InventoryEntry[] = [];
  let skipped = 0;

  for (const layout of SHEETS) {
    const sheet = workbook.getWorksheet(layout.name);
    if (!sheet) {
      throw new Error(`Sheet "${layout.name}" not found in ${SOURCE_FILE}`);
    }

    const { columns } = layout;
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber < layout.firstDataRow) return;

      const get = (col: number | undefined) => (col === undefined ? null : unwrap(row.getCell(col).value));
      const text = (col: number | undefined) => cleanText(get(col));

      const name = text(columns.name);
      if (
        !name ||
        name.length < MIN_NAME_LENGTH ||
        !/[a-z]/i.test(name) ||
        JUNK_NAMES.has(name.toLowerCase())
      ) {
        if (row.actualCellCount > 0) skipped++;
        return;
      }

      entries.push({
        name,
        nature: layout.nature,
        casNumber: normalizeCas(get(columns.cas)),
        ifraCat4: text(columns.ifraCat4),
        cosmeticRegulation: text(columns.cosmeticRegulation),
        allergens: text(columns.allergens),
        flavor: text(columns.flavor),
        flavorRestriction: text(columns.flavorRestriction),
        ...resolveSupplier(text(columns.supplier), text(columns.location)),
        ...parseStock(get(columns.stock)),
        sheet: layout.name,
        row: rowNumber,
      });
    });
  }

  await writeFile(OUTPUT_FILE, JSON.stringify(entries, null, 2), 'utf-8');

  console.log(`Extracted ${entries.length} inventory rows (${skipped} skipped) -> ${OUTPUT_FILE}`);
  // Supplier check against the reference sheet.
  const referenced = new Set(referenceSuppliers);
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const name of [entry.supplier, entry.producer]) {
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  const sorted = [...counts].sort((a, b) => b[1] - a[1]);
  console.log(`\nSuppliers/producers from "${SUPPLIER_SHEET}":`);
  for (const name of referenceSuppliers) console.log(`  ${name}: ${counts.get(name) ?? 0} rows`);
  console.log('Not in the reference sheet:');
  for (const [name, count] of sorted) if (!referenced.has(name)) console.log(`  ${name}: ${count} rows`);
  console.log(`Rows without supplier: ${entries.filter((e) => !e.supplier).length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
