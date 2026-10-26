import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';
import type { InventoryEntry } from './extract-inventory.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INVENTORY_FILE = join(__dirname, '..', 'data', 'inventory.json');
const STOCK_SOURCE = 'rangement';
const DRY_RUN = process.argv.includes('--dry-run');

// Mirrors MySQL's case/accent-insensitive collation on `materials.name`, and
// also ignores punctuation so "Aldehyde C12 Laurique " matches "aldehyde c12 laurique".
function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim();
}

function firstValue<K extends keyof InventoryEntry>(entries: InventoryEntry[], key: K): InventoryEntry[K] | null {
  return entries.find((entry) => entry[key] !== null)?.[key] ?? null;
}

interface ExistingMaterial {
  id: string;
  name: string;
  casNumber: string | null;
  source: string;
}

// Seeded data belongs to one team: its id is given by SEED_TEAM_ID.
function seedTeamId(): string {
  const teamId = process.env.SEED_TEAM_ID;
  if (!teamId) {
    console.error("Définissez SEED_TEAM_ID (id de l'équipe qui reçoit les données).");
    process.exit(1);
  }
  return teamId;
}

async function main() {
  const raw = await readFile(INVENTORY_FILE, 'utf-8');
  const entries: InventoryEntry[] = JSON.parse(raw);

  const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
  const prisma = new PrismaClient({ adapter });
  const teamId = seedTeamId();

  const existing: ExistingMaterial[] = await prisma.material.findMany({
    where: { teamId },
    select: { id: true, name: true, casNumber: true, source: true },
  });
  // Catalog materials take priority over the ones a previous run of this
  // script created, so a later CAS match replaces an earlier duplicate.
  const catalog = existing.filter((m) => m.source !== 'inventory');
  const previousImport = existing.filter((m) => m.source === 'inventory');
  // Same name written with different spacing ("Phenylacetate" vs "Phenyl Acétate").
  const compact = (key: string) => key.replace(/ /g, '');
  const indexByName = (materials: ExistingMaterial[]) => {
    const index = new Map<string, ExistingMaterial>();
    for (const m of materials) {
      index.set(normalizeName(m.name), m);
      index.set(compact(normalizeName(m.name)), m);
    }
    return index;
  };
  const catalogByName = indexByName(catalog);
  const importedByName = indexByName(previousImport);

  // A CAS identifies a single molecule, so it is a safe match for synthetics
  // only. Natural extracts share a CAS across origins and qualities (Rose
  // turque vs Rose Bulgare), and diluted catalog entries ("paracresol 10%")
  // are a different product from the pure material in stock.
  const byCas = new Map<string, ExistingMaterial[]>();
  for (const m of catalog) {
    if (!m.casNumber || m.source === 'user' || m.name.includes('%')) continue;
    const cas = m.casNumber.trim();
    byCas.set(cas, [...(byCas.get(cas) ?? []), m]);
  }
  // Guards against wrong CAS in the sheet, e.g. "Acetate Caryophyllene"
  // filed under caryophyllene's CAS.
  const isAcetate = (name: string) => normalizeName(name).includes('acetate');
  const matchByCas = (entry: InventoryEntry) => {
    if (entry.nature !== 'synthetic' || !entry.casNumber || entry.name.includes('%')) return undefined;
    const candidates = byCas.get(entry.casNumber) ?? [];
    return candidates.length === 1 && isAcetate(candidates[0].name) === isAcetate(entry.name)
      ? candidates[0]
      : undefined;
  };

  // Rows sharing a name are the same material (several bottles/suppliers),
  // even when only some of them carry a CAS.
  const groups = new Map<string, InventoryEntry[]>();
  for (const entry of entries) {
    const key = normalizeName(entry.name);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  const toUpdate = new Map<string, { material: ExistingMaterial; entries: InventoryEntry[] }>();
  const toCreate = new Map<string, InventoryEntry[]>();
  const casMatches: string[] = [];

  for (const [key, group] of groups) {
    let match = catalogByName.get(key) ?? catalogByName.get(compact(key));
    if (!match) {
      for (const entry of group) {
        match = matchByCas(entry);
        if (match) {
          casMatches.push(`${entry.name} -> ${match.name} (${entry.casNumber})`);
          break;
        }
      }
    }
    match ??= importedByName.get(key) ?? importedByName.get(compact(key));

    if (match) {
      const target = toUpdate.get(match.id) ?? { material: match, entries: [] };
      target.entries.push(...group);
      toUpdate.set(match.id, target);
    } else {
      toCreate.set(key, group);
    }
  }

  const inventoryFields = (group: InventoryEntry[]) => ({
    nature: group[0].nature,
    ifraCat4: firstValue(group, 'ifraCat4'),
    cosmeticRegulation: firstValue(group, 'cosmeticRegulation'),
    allergens: firstValue(group, 'allergens'),
    flavor: firstValue(group, 'flavor'),
    flavorRestriction: firstValue(group, 'flavorRestriction'),
  });

  console.log(`${entries.length} inventory rows`);
  console.log(`- ${toUpdate.size} existing materials to update (${casMatches.length} names matched by CAS)`);
  console.log(`- ${toCreate.size} new materials to create`);

  if (DRY_RUN) {
    const orphanNames = previousImport.filter((m) => !toUpdate.has(m.id)).map((m) => m.name);
    console.log(`\nPreviously imported materials left without rows (removed unless used in a formula):`);
    for (const name of orphanNames) console.log(`  ${name}`);
    console.log('\nCAS matches:');
    for (const line of [...new Set(casMatches)]) console.log(`  ${line}`);
    console.log('\nUpdated by name:');
    for (const { material, entries: group } of toUpdate.values()) {
      const names = [...new Set(group.map((e) => e.name))].filter((n) => normalizeName(n) !== normalizeName(material.name));
      if (names.length === 0) console.log(`  ${material.name}`);
    }
    await prisma.$disconnect();
    return;
  }

  const materialIdByKey = new Map<string, string>();

  for (const { material, entries: group } of toUpdate.values()) {
    await prisma.material.update({
      where: { id: material.id },
      data: {
        ...inventoryFields(group),
        ...(material.casNumber ? {} : { casNumber: firstValue(group, 'casNumber') }),
      },
    });
  }

  for (const [key, group] of toCreate) {
    const created = await prisma.material.create({
      data: {
        name: group[0].name,
        casNumber: firstValue(group, 'casNumber'),
        descriptors: {},
        source: 'inventory',
        teamId,
        ...inventoryFields(group),
      },
    });
    materialIdByKey.set(key, created.id);
  }

  const stockRows = [
    ...[...toUpdate].flatMap(([materialId, { entries: group }]) => group.map((entry) => ({ materialId, entry }))),
    ...[...toCreate].flatMap(([key, group]) => group.map((entry) => ({ materialId: materialIdByKey.get(key)!, entry }))),
  ].map(({ materialId, entry }) => ({
    materialId,
    label: entry.name,
    supplier: entry.supplier,
    producer: entry.producer,
    location: entry.location,
    stockGrams: entry.stockGrams,
    stockNote: entry.stockNote,
    source: STOCK_SOURCE,
  }));

  await prisma.$transaction([
    prisma.materialStock.deleteMany({ where: { source: STOCK_SOURCE, material: { teamId } } }),
    prisma.materialStock.createMany({ data: stockRows }),
  ]);

  // Materials created by an earlier run that no longer receive any row
  // (e.g. now merged into a catalog material). Kept if used in a formula.
  const orphans = await prisma.material.deleteMany({
    where: { teamId, source: 'inventory', stocks: { none: {} }, formulaLines: { none: {} } },
  });
  console.log(`Removed ${orphans.count} orphan inventory materials.`);

  const [materials, stocks] = await Promise.all([
    prisma.material.count({ where: { teamId } }),
    prisma.materialStock.count({ where: { material: { teamId } } }),
  ]);
  console.log(`Done. ${materials} materials and ${stocks} stock rows now in database.`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
