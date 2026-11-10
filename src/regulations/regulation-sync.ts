import type { PrismaClient } from '@prisma/client';
import {
  applyRule,
  normalizeSubstance,
  splitCas,
  type RuleContext,
} from './regulation-rules.js';

type Db = Pick<
  PrismaClient,
  'regulation' | 'regulationEntry' | 'material' | '$transaction'
>;

/**
 * Recomputes the "sync" rows of the material ↔ regulation link table for the
 * official regulations, from the materials' regulatory data. Rows entered by
 * hand on custom regulations are never touched. Pass materialIds to only
 * refresh those materials.
 */
export async function syncOfficialRegulations(
  prisma: Db,
  teamId: string,
  materialIds?: string[],
): Promise<number> {
  const regulations = await prisma.regulation.findMany({
    where: { teamId: null, code: { not: null } },
    select: {
      id: true,
      code: true,
      substanceRule: true,
      substances: { select: { name: true, aliases: true, casNumber: true } },
    },
  });
  if (regulations.length === 0) return 0;

  const ctx: RuleContext = { substances: new Map(), substanceRules: new Map() };
  for (const r of regulations) {
    const names = new Set<string>();
    const cas = new Set<string>();
    for (const s of r.substances) {
      names.add(normalizeSubstance(s.name));
      for (const alias of Array.isArray(s.aliases) ? s.aliases : []) {
        if (typeof alias === 'string') names.add(normalizeSubstance(alias));
      }
      for (const c of splitCas(s.casNumber)) cas.add(c);
    }
    ctx.substances.set(r.code!, { names, cas });
    if (r.substanceRule === 'declare' || r.substanceRule === 'ban') {
      ctx.substanceRules!.set(r.code!, r.substanceRule);
    }
  }

  const materials = await prisma.material.findMany({
    where: { teamId, ...(materialIds ? { id: { in: materialIds } } : {}) },
    select: {
      id: true,
      name: true,
      casNumber: true,
      regulatory: true,
      flavorRestriction: true,
    },
  });

  const rows = materials.flatMap((material) =>
    regulations.flatMap((regulation) => {
      const hit = applyRule(regulation.code!, material, ctx);
      return hit
        ? [
            {
              regulationId: regulation.id,
              materialId: material.id,
              origin: 'sync',
              ...hit,
            },
          ]
        : [];
    }),
  );

  await prisma.$transaction([
    prisma.regulationEntry.deleteMany({
      where: {
        origin: 'sync',
        regulationId: { in: regulations.map((r) => r.id) },
        materialId: { in: materials.map((m) => m.id) },
      },
    }),
    prisma.regulationEntry.createMany({ data: rows }),
  ]);
  return rows.length;
}
