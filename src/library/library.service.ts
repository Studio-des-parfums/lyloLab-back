import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { AiService } from '../ai/ai.service.js';
import { FACETS } from '../ai/formula-changes.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateBlindTestDto,
  FacetDefinitionDto,
  MaterialNoteDto,
  ReferenceDto,
  SubmitBlindTestDto,
} from './dto/library.dto.js';

type BlindItem = {
  code: string;
  materialId: string;
  guessMaterialId: string | null;
  guessFacet: string | null;
};

/** Facet with the highest score, or null when the material has no score. */
export function dominantFacet(descriptors: unknown): string | null {
  const entries = Object.entries(
    (descriptors ?? {}) as Record<string, number>,
  ).filter(
    ([k, v]) =>
      (FACETS as readonly string[]).includes(k) &&
      typeof v === 'number' &&
      v > 0,
  );
  if (entries.length === 0) return null;
  return entries.sort(([, a], [, b]) => b - a)[0][0];
}

/** Shuffles a copy of the list (Fisher–Yates). */
function shuffle<T>(list: T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  // ── Facets ────────────────────────────────────────────────────────────

  async facets(teamId: string) {
    const rows = await this.prisma.facetDefinition.findMany({
      where: { OR: [{ teamId: null }, { teamId }] },
    });
    return FACETS.map((facet) => {
      const own = rows.find((r) => r.facet === facet && r.teamId === teamId);
      const base = rows.find((r) => r.facet === facet && r.teamId === null);
      const row = own ?? base;
      return {
        facet,
        description: row?.description ?? null,
        examples: row?.examples ?? null,
        customized: !!own,
      };
    });
  }

  async updateFacet(teamId: string, facet: string, dto: FacetDefinitionDto) {
    if (!(FACETS as readonly string[]).includes(facet))
      throw new NotFoundException('Facette inconnue');
    const data = {
      description: dto.description.trim(),
      examples: dto.examples?.trim() || null,
    };
    const existing = await this.prisma.facetDefinition.findFirst({
      where: { facet, teamId },
    });
    if (existing)
      await this.prisma.facetDefinition.update({
        where: { id: existing.id },
        data,
      });
    else
      await this.prisma.facetDefinition.create({
        data: { facet, teamId, ...data },
      });
    return this.facets(teamId);
  }

  async resetFacet(teamId: string, facet: string) {
    await this.prisma.facetDefinition.deleteMany({ where: { facet, teamId } });
    return this.facets(teamId);
  }

  // ── Countries ─────────────────────────────────────────────────────────

  countries() {
    return this.prisma.country.findMany({ orderBy: { name: 'asc' } });
  }

  // ── Families ──────────────────────────────────────────────────────────

  async families() {
    const rows = await this.prisma.olfactiveFamily.findMany({
      orderBy: { position: 'asc' },
    });
    return rows
      .filter((r) => !r.parentCode)
      .map((family) => ({
        ...family,
        subfamilies: rows.filter((r) => r.parentCode === family.code),
      }));
  }

  // ── Reference perfumes ────────────────────────────────────────────────

  private referenceInclude = {
    formulas: { select: { id: true, name: true, status: true } },
  };

  listReferences(teamId: string) {
    return this.prisma.referencePerfume.findMany({
      where: { teamId },
      include: this.referenceInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getReference(teamId: string, id: string) {
    const ref = await this.prisma.referencePerfume.findFirst({
      where: { id, teamId },
      include: this.referenceInclude,
    });
    if (!ref) throw new NotFoundException('Référence introuvable');
    return ref;
  }

  analyzeReference(teamId: string, query: string) {
    return this.ai.analyzeReference(teamId, query);
  }

  private async referenceData(teamId: string, dto: ReferenceDto) {
    const formulaIds = dto.formulaIds ?? [];
    if (formulaIds.length > 0) {
      const found = await this.prisma.formula.count({
        where: { id: { in: formulaIds }, teamId },
      });
      if (found !== formulaIds.length)
        throw new BadRequestException('Formule introuvable');
    }
    const materialIds = dto.interpretation.map((i) => i.materialId);
    const materials = await this.prisma.material.count({
      where: { id: { in: materialIds }, teamId },
    });
    if (materials !== new Set(materialIds).size)
      throw new BadRequestException('Matière introuvable');
    const clean = (list: string[]) => list.map((n) => n.trim()).filter(Boolean);
    return {
      fields: {
        name: dto.name.trim(),
        brand: dto.brand?.trim() || null,
        year: dto.year ?? null,
        perfumer: dto.perfumer?.trim() || null,
        familyCode: dto.familyCode || null,
        description: dto.description?.trim() || null,
        topNotes: clean(dto.topNotes),
        heartNotes: clean(dto.heartNotes),
        baseNotes: clean(dto.baseNotes),
        sources: dto.sources.map((s) => ({ ...s })),
        interpretation: dto.interpretation.map((i) => ({ ...i })),
      },
      formulaIds,
    };
  }

  async createReference(user: AuthUser, dto: ReferenceDto) {
    const { fields, formulaIds } = await this.referenceData(user.teamId, dto);
    const ref = await this.prisma.referencePerfume.create({
      data: {
        ...fields,
        teamId: user.teamId,
        createdByName: user.name,
        formulas: { connect: formulaIds.map((id) => ({ id })) },
      },
    });
    return this.getReference(user.teamId, ref.id);
  }

  async updateReference(teamId: string, id: string, dto: ReferenceDto) {
    await this.getReference(teamId, id);
    const { fields, formulaIds } = await this.referenceData(teamId, dto);
    await this.prisma.referencePerfume.update({
      where: { id },
      data: {
        ...fields,
        formulas: { set: formulaIds.map((fid) => ({ id: fid })) },
      },
    });
    return this.getReference(teamId, id);
  }

  async deleteReference(teamId: string, id: string) {
    await this.getReference(teamId, id);
    await this.prisma.referencePerfume.delete({ where: { id } });
  }

  // ── Material notes ────────────────────────────────────────────────────

  private async ensureMaterial(teamId: string, materialId: string) {
    const material = await this.prisma.material.findFirst({
      where: { id: materialId, teamId },
      select: { id: true },
    });
    if (!material) throw new NotFoundException('Matière introuvable');
  }

  async materialNotes(teamId: string, materialId: string) {
    await this.ensureMaterial(teamId, materialId);
    return this.prisma.materialNote.findMany({
      where: { teamId, materialId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Latest notes of the team, all materials. */
  recentNotes(teamId: string) {
    return this.prisma.materialNote.findMany({
      where: { teamId },
      include: { material: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async addNote(user: AuthUser, materialId: string, dto: MaterialNoteDto) {
    await this.ensureMaterial(user.teamId, materialId);
    await this.prisma.materialNote.create({
      data: {
        teamId: user.teamId,
        materialId,
        text: dto.text.trim(),
        rating: dto.rating ?? null,
        authorId: user.id,
        authorName: user.name,
      },
    });
    return this.materialNotes(user.teamId, materialId);
  }

  async deleteNote(user: AuthUser, id: string) {
    const note = await this.prisma.materialNote.findFirst({
      where: { id, teamId: user.teamId },
    });
    if (!note) throw new NotFoundException('Note introuvable');
    if (note.authorId !== user.id && user.role !== 'admin') {
      throw new ForbiddenException(
        'Seul son auteur ou un administrateur peut supprimer cette note.',
      );
    }
    await this.prisma.materialNote.delete({ where: { id } });
    return this.materialNotes(user.teamId, note.materialId);
  }

  // ── Blind tests ───────────────────────────────────────────────────────

  private async materialNames(teamId: string, ids: string[]) {
    const rows = await this.prisma.material.findMany({
      where: { teamId, id: { in: ids } },
      select: { id: true, name: true, descriptors: true },
    });
    return new Map(rows.map((r) => [r.id, r]));
  }

  /** Hides the answers until the test is submitted, unless `reveal` (preparer view). */
  private async present(
    teamId: string,
    test: { id: string; items: unknown; completedAt: Date | null } & Record<
      string,
      unknown
    >,
    reveal: boolean,
  ) {
    const items = test.items as BlindItem[];
    const show = reveal || !!test.completedAt;
    const names = await this.materialNames(
      teamId,
      items.flatMap((i) =>
        [i.materialId, i.guessMaterialId].filter((x): x is string => !!x),
      ),
    );
    return {
      ...test,
      items: items.map((i) => {
        const material = names.get(i.materialId);
        const answerFacet = material
          ? dominantFacet(material.descriptors)
          : null;
        return {
          code: i.code,
          guessMaterialId: i.guessMaterialId,
          guessMaterial: i.guessMaterialId
            ? (names.get(i.guessMaterialId)?.name ?? null)
            : null,
          guessFacet: i.guessFacet,
          ...(show
            ? {
                materialId: i.materialId,
                material: material?.name ?? 'Matière supprimée',
                facet: answerFacet,
                correct: test.completedAt
                  ? i.guessMaterialId === i.materialId
                  : null,
                facetCorrect: test.completedAt
                  ? !!i.guessFacet && i.guessFacet === answerFacet
                  : null,
              }
            : {}),
        };
      }),
    };
  }

  async createBlindTest(user: AuthUser, dto: CreateBlindTestDto) {
    const materials = await this.prisma.material.findMany({
      where: {
        teamId: user.teamId,
        ...(dto.onlyInStock
          ? { stocks: { some: { stockGrams: { gt: 0 } } } }
          : {}),
      },
      select: { id: true, descriptors: true },
    });
    const pool = materials.filter((m) => {
      const facet = dominantFacet(m.descriptors);
      return facet && (!dto.facets?.length || dto.facets.includes(facet));
    });
    if (pool.length < dto.count) {
      throw new BadRequestException(
        `Seulement ${pool.length} matière(s) disponible(s) pour ces critères.`,
      );
    }
    const codes = shuffle(
      Array.from({ length: 900 }, (_, i) => String(100 + i)),
    );
    const items: BlindItem[] = shuffle(pool)
      .slice(0, dto.count)
      .map((m, i) => ({
        code: codes[i],
        materialId: m.id,
        guessMaterialId: null,
        guessFacet: null,
      }));
    const test = await this.prisma.blindTest.create({
      data: {
        teamId: user.teamId,
        userId: user.id,
        userName: user.name,
        items,
      },
    });
    return this.present(user.teamId, test, false);
  }

  async getBlindTest(teamId: string, id: string, reveal: boolean) {
    const test = await this.prisma.blindTest.findFirst({
      where: { id, teamId },
    });
    if (!test) throw new NotFoundException('Test introuvable');
    return this.present(teamId, test, reveal);
  }

  async submitBlindTest(user: AuthUser, id: string, dto: SubmitBlindTestDto) {
    const test = await this.prisma.blindTest.findFirst({
      where: { id, teamId: user.teamId },
    });
    if (!test) throw new NotFoundException('Test introuvable');
    if (test.completedAt)
      throw new BadRequestException('Ce test est déjà corrigé.');
    const answers = new Map(dto.answers.map((a) => [a.code, a]));
    const items = (test.items as BlindItem[]).map((i) => ({
      ...i,
      guessMaterialId: answers.get(i.code)?.guessMaterialId ?? null,
      guessFacet: answers.get(i.code)?.guessFacet ?? null,
    }));
    const names = await this.materialNames(
      user.teamId,
      items.map((i) => i.materialId),
    );
    const score =
      items.filter((i) => i.guessMaterialId === i.materialId).length /
      items.length;
    const facetScore =
      items.filter((i) => {
        const facet = dominantFacet(names.get(i.materialId)?.descriptors);
        return !!i.guessFacet && i.guessFacet === facet;
      }).length / items.length;
    const updated = await this.prisma.blindTest.update({
      where: { id },
      data: { items, score, facetScore, completedAt: new Date() },
    });
    return this.present(user.teamId, updated, true);
  }

  async listBlindTests(teamId: string) {
    const tests = await this.prisma.blindTest.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    // Average scores per person, over completed tests.
    const byUser = new Map<
      string,
      { tests: number; score: number; facetScore: number }
    >();
    for (const t of tests) {
      if (t.score === null) continue;
      const entry = byUser.get(t.userName) ?? {
        tests: 0,
        score: 0,
        facetScore: 0,
      };
      entry.tests++;
      entry.score += t.score;
      entry.facetScore += t.facetScore ?? 0;
      byUser.set(t.userName, entry);
    }
    return {
      tests: tests.map((t) => ({
        id: t.id,
        userName: t.userName,
        count: (t.items as BlindItem[]).length,
        score: t.score,
        facetScore: t.facetScore,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
      })),
      leaderboard: [...byUser.entries()]
        .map(([userName, v]) => ({
          userName,
          tests: v.tests,
          score: v.score / v.tests,
          facetScore: v.facetScore / v.tests,
        }))
        .sort((a, b) => b.score - a.score),
    };
  }

  async deleteBlindTest(teamId: string, id: string) {
    const test = await this.prisma.blindTest.findFirst({
      where: { id, teamId },
      select: { id: true },
    });
    if (!test) throw new NotFoundException('Test introuvable');
    await this.prisma.blindTest.delete({ where: { id } });
  }
}
