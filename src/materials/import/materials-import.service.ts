import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { readTables, type Table } from './file-readers.js';
import {
  DESCRIPTOR_MAX,
  IMPORT_FIELDS,
  columnTarget,
  type ColumnTarget,
  type ImportFieldKey,
} from './import-format.js';

const IMPORT_SOURCE = 'import';
// Title rows above the header are common in lab spreadsheets.
const HEADER_SEARCH_ROWS = 15;

type TextField = Exclude<
  ImportFieldKey,
  'name' | 'nature' | 'subjectivePower' | 'ifraLimit' | 'allergens' | 'supplier' | 'producer' | 'location' | 'stock' | 'waterBase'
>;
const TEXT_FIELDS: TextField[] = [
  'casNumber',
  'family',
  'sensation',
  'adjacentNote',
  'regulation',
  'freeNote',
  'visualAspect',
  'flashPoint',
  'physicochemicalState',
];

interface ImportedStock {
  supplier: string | null;
  producer: string | null;
  location: string | null;
  stockGrams: number | null;
  stockNote: string | null;
}

/** One material read from the file; only the fields present in the file are set. */
interface ImportedMaterial {
  name: string;
  text: Partial<Record<TextField, string>>;
  nature?: 'natural' | 'synthetic';
  subjectivePower?: number;
  descriptors: Record<string, number>;
  ifraLimit?: string;
  allergens?: string[];
  waterBase?: boolean;
  stocks: ImportedStock[];
  refs: string[];
  warnings: string[];
}

interface SheetReport {
  name: string;
  headerRow: number | null;
  columns: { header: string; label: string | null }[];
  materialRows: number;
  skippedReason?: string;
}

export interface ImportRowReport {
  ref: string;
  name: string;
  action: 'create' | 'update';
  fields: string[];
  warnings: string[];
}

export interface ImportReport {
  fileName: string;
  applied: boolean;
  sheets: SheetReport[];
  summary: { total: number; create: number; update: number; withWarnings: number; stocks: number };
  rows: ImportRowReport[];
  errors: { ref: string; message: string }[];
}

const FIELD_LABEL = new Map(IMPORT_FIELDS.map((field) => [field.key, field.label]));

function cleanText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toLocaleDateString('fr-FR');
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text.length > 0 && text !== '?' && text !== '-' ? text : null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = cleanText(value);
  if (!text) return null;
  const number = Number(text.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

const nameKey = (name: string) => name.replace(/\s+/g, ' ').trim().toLowerCase();

function formatPercent(value: number): string {
  return `${Number(value.toFixed(4)).toString().replace('.', ',')} %`;
}

/** Same vocabulary as the regulatory cleanup: "0,6 %", "Interdite", "Aucune limite". */
function parseIfraLimit(value: unknown, warnings: string[]): string | undefined {
  if (typeof value === 'number') return formatPercent(value);
  const text = cleanText(value);
  if (!text) return undefined;
  if (/interdit|prohib|banned/i.test(text)) return 'Interdite';
  if (/aucune|non restreint|no limit|sans limite/i.test(text)) return 'Aucune limite';
  const percent = /^(\d+(?:[.,]\d+)?)\s*%?$/.exec(text);
  if (percent) return formatPercent(Number(percent[1].replace(',', '.')));
  if (!/\d+(?:[.,]\d+)?\s*%/.test(text)) {
    warnings.push(`Limite IFRA « ${text} » sans pourcentage : elle ne sera pas appliquée aux formules.`);
  }
  return text;
}

function parseNature(value: unknown, warnings: string[]): 'natural' | 'synthetic' | undefined {
  const text = cleanText(value);
  if (!text) return undefined;
  if (/synth/i.test(text)) return 'synthetic';
  if (/nat/i.test(text)) return 'natural';
  warnings.push(`Nature « ${text} » non reconnue (attendu : Naturelle ou Synthétique).`);
  return undefined;
}

function parseYesNo(value: unknown, warnings: string[]): boolean | undefined {
  if (typeof value === 'boolean') return value;
  const text = cleanText(value)?.toLowerCase();
  if (!text) return undefined;
  if (['oui', 'yes', 'o', 'y', 'x', '1', 'vrai', 'true'].includes(text)) return true;
  if (['non', 'no', 'n', '0', 'faux', 'false'].includes(text)) return false;
  warnings.push(`Water base « ${text} » non reconnu (attendu : Oui ou Non).`);
  return undefined;
}

function parseStock(value: unknown): { stockGrams: number | null; stockNote: string | null } {
  if (typeof value === 'number') return { stockGrams: value, stockNote: null };
  const text = cleanText(value);
  if (!text) return { stockGrams: null, stockNote: null };
  const match = /^(\d+(?:[.,]\d+)?)\s*(kg|g|gr|mg)?$/i.exec(text);
  if (!match) return { stockGrams: null, stockNote: text };
  const amount = Number(match[1].replace(',', '.'));
  const unit = match[2]?.toLowerCase();
  const factor = unit === 'kg' ? 1000 : unit === 'mg' ? 0.001 : 1;
  return { stockGrams: amount * factor, stockNote: null };
}

function findHeader(table: Table): { index: number; targets: (ColumnTarget | null)[] } | null {
  for (let index = 0; index < Math.min(table.rows.length, HEADER_SEARCH_ROWS); index++) {
    const targets = table.rows[index].map((cell) => {
      const header = cleanText(cell);
      return header ? columnTarget(header) : null;
    });
    if (targets.some((target) => target?.kind === 'field' && target.key === 'name')) {
      return { index, targets };
    }
  }
  return null;
}

/** Reads every sheet that has a "Nom" column; rows of the same material are merged. */
export function extractMaterials(tables: Table[]) {
  const sheets: SheetReport[] = [];
  const errors: { ref: string; message: string }[] = [];
  const byName = new Map<string, ImportedMaterial>();
  const multipleSheets = tables.length > 1;

  for (const table of tables) {
    const header = findHeader(table);
    if (!header) {
      if (table.rows.some((row) => row.some((cell) => cleanText(cell)))) {
        sheets.push({
          name: table.name,
          headerRow: null,
          columns: [],
          materialRows: 0,
          skippedReason: 'Aucune colonne « Nom » trouvée dans les premières lignes.',
        });
      }
      continue;
    }

    const headerCells = table.rows[header.index];
    const columns = header.targets.map((target, i) => ({
      header: cleanText(headerCells[i]) ?? `Colonne ${i + 1}`,
      label: !target
        ? null
        : target.kind === 'facet'
          ? `Facette ${target.facet}`
          : (FIELD_LABEL.get(target.key) ?? null),
    }));
    const report: SheetReport = {
      name: table.name,
      headerRow: header.index + 1,
      columns: columns.filter((column, i) => cleanText(headerCells[i]) !== null || column.label),
      materialRows: 0,
    };
    sheets.push(report);

    for (let r = header.index + 1; r < table.rows.length; r++) {
      const cells = table.rows[r];
      const ref = multipleSheets ? `${table.name}, ligne ${r + 1}` : `Ligne ${r + 1}`;
      const value = (key: ImportFieldKey) => {
        const i = header.targets.findIndex((t) => t?.kind === 'field' && t.key === key);
        return i === -1 ? null : cells[i];
      };

      const name = cleanText(value('name'));
      if (!name) {
        if (cells.some((cell) => cleanText(cell))) {
          errors.push({ ref, message: 'Ligne ignorée : le nom de la matière est vide.' });
        }
        continue;
      }
      report.materialRows++;

      const key = nameKey(name);
      const material: ImportedMaterial = byName.get(key) ?? {
        name,
        text: {},
        descriptors: {},
        stocks: [],
        refs: [],
        warnings: [],
      };
      material.refs.push(ref);
      const warnings = material.warnings;

      for (const field of TEXT_FIELDS) {
        const text = cleanText(value(field));
        if (text) material.text[field] = text;
      }
      const nature = parseNature(value('nature'), warnings);
      if (nature) material.nature = nature;
      const power = parseNumber(value('subjectivePower'));
      if (power !== null) material.subjectivePower = power;
      const ifraLimit = parseIfraLimit(value('ifraLimit'), warnings);
      if (ifraLimit) material.ifraLimit = ifraLimit;
      const allergens = cleanText(value('allergens'));
      if (allergens) {
        material.allergens = allergens
          .split(/[,;/]/)
          .map((a) => a.trim())
          .filter(Boolean);
      }
      const waterBase = parseYesNo(value('waterBase'), warnings);
      if (waterBase !== undefined) material.waterBase = waterBase;

      header.targets.forEach((target, i) => {
        if (target?.kind !== 'facet') return;
        const raw = cells[i];
        if (cleanText(raw) === null) return;
        const score = parseNumber(raw);
        if (score === null) {
          warnings.push(`Facette ${target.facet} : « ${cleanText(raw)} » n'est pas un nombre.`);
        } else if (score < 0 || score > DESCRIPTOR_MAX) {
          warnings.push(`Facette ${target.facet} : ${score} ramené entre 0 et ${DESCRIPTOR_MAX}.`);
          material.descriptors[target.facet] = Math.min(Math.max(score, 0), DESCRIPTOR_MAX);
        } else {
          material.descriptors[target.facet] = score;
        }
      });

      const stock: ImportedStock = {
        supplier: cleanText(value('supplier')),
        producer: cleanText(value('producer')),
        location: cleanText(value('location')),
        ...parseStock(value('stock')),
      };
      if (Object.values(stock).some((v) => v !== null)) material.stocks.push(stock);

      byName.set(key, material);
    }
  }

  for (const material of byName.values()) {
    if (material.refs.length > 1) {
      material.warnings.unshift(
        `Présente ${material.refs.length} fois (${material.refs.join(' ; ')}) : informations fusionnées.`,
      );
    }
  }
  return { sheets, errors, materials: [...byName.values()] };
}

function fieldsOf(material: ImportedMaterial): string[] {
  const fields = Object.keys(material.text).map((k) => FIELD_LABEL.get(k as ImportFieldKey)!);
  if (material.nature) fields.push('Nature');
  if (material.subjectivePower !== undefined) fields.push('Puissance');
  const facetCount = Object.keys(material.descriptors).length;
  if (facetCount > 0) fields.push(`${facetCount} facette${facetCount > 1 ? 's' : ''}`);
  if (material.ifraLimit) fields.push('Limite IFRA');
  if (material.allergens) fields.push('Allergènes');
  if (material.waterBase !== undefined) fields.push('Water base');
  if (material.stocks.length > 0) fields.push(material.stocks.length > 1 ? `${material.stocks.length} stocks` : 'Stock');
  return fields;
}

@Injectable()
export class MaterialsImportService {
  constructor(private readonly prisma: PrismaService) {}

  /** Reads the file and, when `apply` is true, creates or updates the materials. */
  async import(teamId: string, fileName: string, buffer: Buffer, apply: boolean): Promise<ImportReport> {
    const tables = await readTables(fileName, buffer);
    const { sheets, errors, materials } = extractMaterials(tables);

    const existing = await this.prisma.material.findMany({
      where: { teamId },
      select: { id: true, name: true, descriptors: true, regulatory: true },
    });
    const existingByName = new Map(existing.map((m) => [nameKey(m.name), m]));

    const rows: ImportRowReport[] = materials.map((material) => ({
      ref: material.refs[0],
      name: material.name,
      action: existingByName.has(nameKey(material.name)) ? 'update' : 'create',
      fields: fieldsOf(material),
      warnings: material.warnings,
    }));

    if (apply) {
      for (const material of materials) {
        const match = existingByName.get(nameKey(material.name));
        try {
          await this.save(teamId, material, match);
        } catch (err) {
          const row = rows.find((r) => r.name === material.name)!;
          errors.push({
            ref: row.ref,
            message: `« ${material.name} » n'a pas pu être enregistrée : ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }
    }

    return {
      fileName,
      applied: apply,
      sheets,
      summary: {
        total: rows.length,
        create: rows.filter((r) => r.action === 'create').length,
        update: rows.filter((r) => r.action === 'update').length,
        withWarnings: rows.filter((r) => r.warnings.length > 0).length,
        stocks: materials.reduce((sum, m) => sum + m.stocks.length, 0),
      },
      rows,
      errors,
    };
  }

  private async save(
    teamId: string,
    material: ImportedMaterial,
    match: { id: string; descriptors: unknown; regulatory: unknown } | undefined,
  ) {
    const regulatory: Record<string, unknown> = { ...((match?.regulatory as object | null) ?? {}) };
    if (material.ifraLimit) regulatory.ifraLimit = material.ifraLimit;
    if (material.allergens) {
      regulatory.allergens = material.allergens;
      regulatory.isAllergen = material.allergens.length > 0;
    }
    const hasRegulatory = Object.keys(regulatory).length > 0;

    // Fields missing from the file never erase what is already known.
    const data = {
      ...material.text,
      ...(material.nature ? { nature: material.nature } : {}),
      ...(material.subjectivePower !== undefined ? { subjectivePower: material.subjectivePower } : {}),
      ...(material.waterBase !== undefined ? { waterBase: material.waterBase } : {}),
      ...(hasRegulatory && (material.ifraLimit || material.allergens)
        ? { regulatory: regulatory as Prisma.InputJsonValue }
        : {}),
    };

    const stocks = material.stocks.map((stock) => ({
      label: material.name,
      ...stock,
      source: IMPORT_SOURCE,
    }));

    if (match) {
      const descriptors = { ...((match.descriptors as Record<string, number>) ?? {}), ...material.descriptors };
      await this.prisma.$transaction([
        this.prisma.material.update({ where: { id: match.id }, data: { ...data, descriptors } }),
        // Re-importing a file replaces the stock lines a previous import created.
        ...(stocks.length > 0
          ? [
              this.prisma.materialStock.deleteMany({ where: { materialId: match.id, source: IMPORT_SOURCE } }),
              this.prisma.materialStock.createMany({
                data: stocks.map((stock) => ({ ...stock, materialId: match.id })),
              }),
            ]
          : []),
      ]);
    } else {
      await this.prisma.material.create({
        data: {
          ...data,
          teamId,
          name: material.name,
          source: IMPORT_SOURCE,
          descriptors: material.descriptors,
          stocks: { create: stocks },
        },
      });
    }
  }
}
