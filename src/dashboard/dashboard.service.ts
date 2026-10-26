import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { parseIfraLimitPercent } from '../formulas/ifra-limit.js';

const DAY_MS = 24 * 60 * 60 * 1000;
// Projects ending within this many days show up in the deadlines block.
const DEADLINE_HORIZON_DAYS = 30;
// Most lab bottles hold a few grams (median ≈ 7 g), so "low" is under 10 g.
const LOW_STOCK_GRAMS = 10;
const RECENT_DRAFTS_LIMIT = 6;
const STOCK_ALERTS_LIMIT = 10;
const TOP_MATERIALS_LIMIT = 10;
const REGULATORY_LIMIT = 8;
// Line quantities are rounded percentages: within this margin a line sits at its IFRA limit.
const AT_LIMIT_TOLERANCE = 0.01;
const EMPTY_STOCK_PATTERN = /vide/i;

type StockLevel = 'out' | 'low' | 'missing' | 'ok';

interface ClientNameFields {
  company: string | null;
  contactFirstName: string | null;
  contactLastName: string | null;
}

/** Same rule as getClientDisplayName in the frontend. */
function clientDisplayName(client: ClientNameFields): string {
  if (client.company) return client.company;
  const contactName = `${client.contactFirstName ?? ''} ${client.contactLastName ?? ''}`.trim();
  return contactName || 'Client sans nom';
}

function stockLevelOf(stocks: { stockGrams: number | null; stockNote: string | null }[]): {
  level: StockLevel;
  grams: number | null;
} {
  if (stocks.length === 0) return { level: 'missing', grams: null };
  const known = stocks.map((s) => s.stockGrams).filter((g): g is number => g !== null);
  const grams = known.length > 0 ? known.reduce((a, b) => a + b, 0) : null;
  if (grams !== null && grams > 0) {
    return { level: grams < LOW_STOCK_GRAMS ? 'low' : 'ok', grams };
  }
  const markedEmpty = stocks.some((s) => s.stockNote && EMPTY_STOCK_PATTERN.test(s.stockNote));
  // A free-text note such as "2*500g" means stock is there, just not counted.
  const hasOtherNote = stocks.some((s) => s.stockNote && !EMPTY_STOCK_PATTERN.test(s.stockNote));
  if (grams === 0 || markedEmpty) return { level: hasOtherNote ? 'ok' : 'out', grams: grams ?? 0 };
  return { level: 'ok', grams };
}

/**
 * Line quantities as % of the formula. Formulas made in the builder already
 * sum to 100, but imported accords store parts (e.g. a 724-part Tubéreuse).
 */
function linePercents(lines: { quantity: number }[]): number[] {
  const total = lines.reduce((sum, line) => sum + line.quantity, 0);
  return lines.map((line) => (total > 0 ? (line.quantity / total) * 100 : 0));
}

const distinct = (values: (string | null)[]) => [
  ...new Set(values.map((v) => v?.trim()).filter((v): v is string => Boolean(v))),
];

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const horizon = new Date(startOfToday.getTime() + DEADLINE_HORIZON_DAYS * DAY_MS);

    const [formulas, projects, clientCount, materials] = await Promise.all([
      this.prisma.formula.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          project: { include: { client: true } },
          lines: {
            include: {
              material: { select: { id: true, name: true, regulatory: true } },
            },
          },
        },
      }),
      this.prisma.project.findMany({
        include: { client: true, formulas: { select: { status: true } } },
      }),
      this.prisma.client.count(),
      this.prisma.material.findMany({
        select: {
          id: true,
          name: true,
          sourceFormulaId: true,
          stocks: { select: { stockGrams: true, stockNote: true, location: true, supplier: true } },
        },
      }),
    ]);

    // Formula-derived materials are made on demand, they never have stock.
    const stockById = new Map(
      materials
        .filter((m) => !m.sourceFormulaId)
        .map((m) => [m.id, { material: m, ...stockLevelOf(m.stocks) }]),
    );

    // 1. Key figures
    const kpis = {
      draftFormulas: formulas.filter((f) => f.status === 'draft').length,
      completedFormulas: formulas.filter((f) => f.status === 'completed').length,
      formulasThisMonth: formulas.filter((f) => f.createdAt >= startOfMonth).length,
      activeProjects: projects.filter(
        (p) =>
          (!p.startDate || p.startDate <= now) && (!p.endDate || p.endDate >= startOfToday),
      ).length,
      clients: clientCount,
      materials: materials.length,
      outOfStockMaterials: [...stockById.values()].filter((s) => s.level === 'out').length,
    };

    // 2. Deadlines: due within the horizon, or overdue with no finalized formula yet.
    const deadlines = projects
      .filter((p) => p.endDate && p.endDate <= horizon)
      .map((p) => {
        const completedCount = p.formulas.filter((f) => f.status === 'completed').length;
        return {
          projectId: p.id,
          projectName: p.name,
          clientName: clientDisplayName(p.client),
          endDate: p.endDate!.toISOString(),
          daysLeft: Math.round((p.endDate!.getTime() - startOfToday.getTime()) / DAY_MS),
          draftCount: p.formulas.length - completedCount,
          completedCount,
        };
      })
      .filter((p) => p.daysLeft >= 0 || p.completedCount === 0)
      .sort((a, b) => a.daysLeft - b.daysLeft);

    // 3. Latest drafts (by creation date: formulas carry no modification date).
    const recentDrafts = formulas
      .filter((f) => f.status === 'draft')
      .slice(0, RECENT_DRAFTS_LIMIT)
      .map((f) => ({
        id: f.id,
        name: f.name,
        createdAt: f.createdAt.toISOString(),
        materialCount: f.lines.length,
        projectId: f.project?.id ?? null,
        projectName: f.project?.name ?? null,
        clientName: f.project ? clientDisplayName(f.project.client) : null,
      }));

    // Usage of each material across formulas.
    const usage = new Map<string, { name: string; formulaIds: Set<string>; percents: number[] }>();
    for (const formula of formulas) {
      const percents = linePercents(formula.lines);
      formula.lines.forEach((line, i) => {
        const entry = usage.get(line.material.id) ?? {
          name: line.material.name,
          formulaIds: new Set<string>(),
          percents: [],
        };
        entry.formulaIds.add(formula.id);
        entry.percents.push(percents[i]);
        usage.set(line.material.id, entry);
      });
    }

    // 4. Stock alerts on materials actually used in formulas.
    const levelRank: Record<StockLevel, number> = { out: 0, low: 1, missing: 2, ok: 3 };
    const allStockAlerts = [...usage.entries()]
      .map(([materialId, use]) => ({ materialId, use, stock: stockById.get(materialId) }))
      .filter(({ stock }) => stock && stock.level !== 'ok')
      .map(({ materialId, use, stock }) => ({
        materialId,
        name: use.name,
        level: stock!.level as Exclude<StockLevel, 'ok'>,
        stockGrams: stock!.grams,
        locations: distinct(stock!.material.stocks.map((s) => s.location)),
        suppliers: distinct(stock!.material.stocks.map((s) => s.supplier)),
        formulaCount: use.formulaIds.size,
      }))
      .sort(
        (a, b) => levelRank[a.level] - levelRank[b.level] || b.formulaCount - a.formulaCount,
      );

    // 5. Most used materials.
    const topMaterials = [...usage.entries()]
      .map(([materialId, use]) => ({
        materialId,
        name: use.name,
        formulaCount: use.formulaIds.size,
        averagePercent: use.percents.reduce((a, b) => a + b, 0) / use.percents.length,
      }))
      .sort((a, b) => b.formulaCount - a.formulaCount || b.averagePercent - a.averagePercent)
      .slice(0, TOP_MATERIALS_LIMIT);

    // 6. Regulatory review: IFRA bans/excesses/caps and allergens shared by several materials.
    const allRegulatory = formulas
      .map((formula) => {
        const banned: string[] = [];
        const exceeded: string[] = [];
        const capped: string[] = [];
        const allergenOccurrences = new Map<string, number>();
        const percents = linePercents(formula.lines);

        formula.lines.forEach((line, i) => {
          const percent = percents[i];
          const regulatory = (line.material.regulatory ?? {}) as {
            ifraLimit?: string | number;
            allergens?: string[];
          };
          const limit = parseIfraLimitPercent(regulatory.ifraLimit);
          if (limit === 0 && percent > 0) banned.push(line.material.name);
          else if (limit !== null && percent > limit + AT_LIMIT_TOLERANCE) {
            exceeded.push(line.material.name);
          } else if (limit !== null && percent >= limit - AT_LIMIT_TOLERANCE) {
            capped.push(line.material.name);
          }
          for (const allergen of regulatory.allergens ?? []) {
            allergenOccurrences.set(allergen, (allergenOccurrences.get(allergen) ?? 0) + 1);
          }
        });

        const overlappingAllergens = [...allergenOccurrences]
          .filter(([, count]) => count >= 2)
          .map(([allergen]) => allergen);
        const level: 'violation' | 'warning' | null =
          banned.length > 0 || exceeded.length > 0
            ? 'violation'
            : capped.length > 0 || overlappingAllergens.length > 0
              ? 'warning'
              : null;

        return {
          formulaId: formula.id,
          name: formula.name,
          status: formula.status as 'draft' | 'completed',
          projectId: formula.project?.id ?? null,
          projectName: formula.project?.name ?? null,
          clientName: formula.project ? clientDisplayName(formula.project.client) : null,
          level,
          banned,
          exceeded,
          capped,
          overlappingAllergens,
        };
      })
      .filter((f) => f.level !== null)
      .sort((a, b) => (a.level === b.level ? 0 : a.level === 'violation' ? -1 : 1));

    return {
      kpis,
      deadlines,
      recentDrafts,
      stockAlerts: allStockAlerts.slice(0, STOCK_ALERTS_LIMIT),
      stockAlertTotal: allStockAlerts.length,
      lowStockGrams: LOW_STOCK_GRAMS,
      topMaterials,
      regulatory: allRegulatory.slice(0, REGULATORY_LIMIT),
      regulatoryTotal: allRegulatory.length,
    };
  }
}
