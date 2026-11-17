/**
 * Donne un identifiant XXX-XXX-n aux formules qui n'en ont pas encore
 * (créées avant l'ajout des codes). Les versions d'une même formule sont
 * numérotées -1, -2… dans l'ordre de leur numéro de version.
 *
 * Idempotent : npx tsx scripts/backfill-formula-codes.ts
 */
import { PrismaClient } from '@prisma/client';
import { seedAdapter } from './seed-db.js';
import { randomFormulaPrefix } from '../src/formulas/formula-code.js';
import 'dotenv/config';

const prisma = new PrismaClient({ adapter: seedAdapter() });

async function main() {
  const formulas = await prisma.formula.findMany({
    select: { id: true, teamId: true, rootFormulaId: true, version: true, code: true },
    orderBy: [{ version: 'asc' }, { createdAt: 'asc' }],
  });
  const usedPrefixes = new Set(
    formulas.filter((f) => f.code).map((f) => `${f.teamId}:${f.code!.split('-').slice(0, 2).join('-')}`),
  );

  const lineages = new Map<string, typeof formulas>();
  for (const f of formulas) {
    const key = f.rootFormulaId ?? f.id;
    lineages.set(key, [...(lineages.get(key) ?? []), f]);
  }

  let updated = 0;
  for (const versions of lineages.values()) {
    if (versions.every((v) => v.code)) continue;
    const teamId = versions[0].teamId;
    // Garde le préfixe déjà attribué à la lignée s'il y en a un.
    let prefix = versions.find((v) => v.code)?.code?.split('-').slice(0, 2).join('-');
    while (!prefix || (usedPrefixes.has(`${teamId}:${prefix}`) && !versions.some((v) => v.code?.startsWith(`${prefix}-`)))) {
      prefix = randomFormulaPrefix();
    }
    usedPrefixes.add(`${teamId}:${prefix}`);
    const taken = new Set(versions.map((v) => v.code).filter(Boolean));
    let n = 1;
    for (const v of versions) {
      if (v.code) continue;
      while (taken.has(`${prefix}-${n}`)) n++;
      const code = `${prefix}-${n}`;
      taken.add(code);
      await prisma.formula.update({ where: { id: v.id }, data: { code } });
      updated++;
    }
  }
  console.log(`${updated} formule(s) identifiée(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
