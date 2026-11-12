import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AuthUser } from '../auth/auth-user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import type {
  CreateCampaignDto,
  DailyNoteDto,
  WatchersDto,
  ObservationDto,
  RisksDto,
  UpdateTestDto,
} from './dto/stability.dto.js';
import {
  RISK_LABELS,
  STABILITY_BASES,
  STABILITY_CONDITIONS,
  checkpointsOf,
  formulaRisks,
  materialStability,
  observationGrade,
} from './stability-knowledge.js';

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const PHOTO_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/gif',
];

const DAY = 24 * 60 * 60 * 1000;
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const testInclude = {
  formula: { select: { id: true, name: true, status: true } },
  observations: {
    orderBy: [{ observedAt: 'asc' as const }],
    include: {
      photos: { select: { id: true, mimeType: true, fileName: true } },
    },
  },
  dailyNotes: { orderBy: [{ date: 'desc' as const }] },
  createdBy: { select: { id: true, name: true } },
  watchers: { select: { user: { select: { id: true, name: true } } } },
};

@Injectable()
export class StabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Reference lists for the frontend. */
  catalog() {
    return {
      conditions: STABILITY_CONDITIONS,
      bases: STABILITY_BASES,
      risks: RISK_LABELS,
    };
  }

  private specs() {
    return this.prisma.stabilitySpec.findMany();
  }

  // ── Tests ─────────────────────────────────────────────────────────────

  private present<
    T extends {
      startDate: Date;
      checkpoints: unknown;
      status: string;
      observations: {
        day: number | null;
        odor: string;
        color: string;
        appearance: string;
      }[];
    },
  >(test: T) {
    const checkpoints = checkpointsOf(
      test.startDate,
      test.checkpoints,
      test.observations.map((o) => o.day),
    );
    const today = startOfToday().getTime();
    const pending =
      test.status === 'in_progress' ? checkpoints.filter((c) => !c.done) : [];
    const grades = test.observations.map(observationGrade);
    return {
      ...test,
      checkpointList: checkpoints,
      nextCheckpoint: pending[0] ?? null,
      overdueCount: pending.filter((c) => c.dueDate.getTime() < today).length,
      dueTodayCount: pending.filter(
        (c) =>
          c.dueDate.getTime() >= today && c.dueDate.getTime() < today + DAY,
      ).length,
      progress: checkpoints.length
        ? checkpoints.filter((c) => c.done).length / checkpoints.length
        : 0,
      worstGrade: grades.includes('altered')
        ? 'altered'
        : grades.includes('slight')
          ? 'slight'
          : grades.length
            ? 'conform'
            : null,
      observations: test.observations.map((o) => ({
        ...o,
        grade: observationGrade(o),
      })),
    };
  }

  async listTests(
    teamId: string,
    filters: { formulaId?: string; status?: string },
  ) {
    const tests = await this.prisma.stabilityTest.findMany({
      where: {
        teamId,
        ...(filters.formulaId ? { formulaId: filters.formulaId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      include: testInclude,
      orderBy: [{ startDate: 'desc' }, { condition: 'asc' }],
    });
    return tests.map((t) => this.present(t));
  }

  async getTest(teamId: string, id: string) {
    const test = await this.prisma.stabilityTest.findFirst({
      where: { id, teamId },
      include: testInclude,
    });
    if (!test) throw new NotFoundException('Test introuvable');
    const siblings = await this.prisma.stabilityTest.findMany({
      where: { teamId, campaignId: test.campaignId, id: { not: id } },
      select: { id: true, condition: true, conditionLabel: true, status: true },
    });
    return { ...this.present(test), campaign: siblings };
  }

  /** Checkpoints to do: overdue, today and in the next 7 days. */
  async overview(teamId: string) {
    const tests = await this.listTests(teamId, { status: 'in_progress' });
    const today = startOfToday().getTime();
    const horizon = today + 8 * DAY;
    const due = tests
      .flatMap((t) =>
        t.checkpointList
          .filter((c) => !c.done && c.dueDate.getTime() < horizon)
          .map((c) => ({
            testId: t.id,
            formula: t.formula,
            condition: t.condition,
            conditionLabel: t.conditionLabel,
            base: t.base,
            day: c.day,
            dueDate: c.dueDate,
            state:
              c.dueDate.getTime() < today
                ? 'overdue'
                : c.dueDate.getTime() < today + DAY
                  ? 'today'
                  : 'upcoming',
          })),
      )
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    const counts = await this.prisma.stabilityTest.groupBy({
      by: ['status'],
      where: { teamId },
      _count: { _all: true },
    });
    const nonConform = await this.prisma.stabilityTest.count({
      where: { teamId, conclusion: 'non_conform' },
    });
    return {
      due,
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
      nonConform,
    };
  }

  async createCampaign(user: AuthUser, dto: CreateCampaignDto) {
    const formula = await this.prisma.formula.findFirst({
      where: { id: dto.formulaId, teamId: user.teamId },
      select: { id: true },
    });
    if (!formula) throw new NotFoundException('Formule introuvable');
    const campaignId = randomUUID();
    const watcherIds = await this.teamUserIds(
      user.teamId,
      (dto.watcherIds ?? []).filter((id) => id !== user.id),
    );
    await this.prisma.stabilityTest.createMany({
      data: dto.conditions.map((c) => ({
        campaignId,
        teamId: user.teamId,
        formulaId: dto.formulaId,
        condition: c.condition,
        conditionLabel: c.conditionLabel?.trim() || null,
        base: dto.base ?? 'alcohol',
        container: dto.container?.trim() || null,
        startDate: new Date(dto.startDate),
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        checkpoints: [...new Set(c.checkpoints)].sort((a, b) => a - b),
        notes: dto.notes?.trim() || null,
        createdByName: user.name,
        createdById: user.id,
      })),
    });
    if (watcherIds.length) {
      const tests = await this.prisma.stabilityTest.findMany({
        where: { campaignId },
        select: { id: true },
      });
      await this.prisma.stabilityWatcher.createMany({
        data: tests.flatMap((t) => watcherIds.map((userId) => ({ testId: t.id, userId }))),
      });
    }
    return this.listTests(user.teamId, { formulaId: dto.formulaId });
  }

  private async ensureTest(teamId: string, id: string) {
    const test = await this.prisma.stabilityTest.findFirst({
      where: { id, teamId },
      select: { id: true },
    });
    if (!test) throw new NotFoundException('Test introuvable');
  }

  async updateTest(teamId: string, id: string, dto: UpdateTestDto) {
    await this.ensureTest(teamId, id);
    await this.prisma.stabilityTest.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.conclusion !== undefined ? { conclusion: dto.conclusion } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
        ...(dto.container !== undefined
          ? { container: dto.container.trim() || null }
          : {}),
        ...(dto.checkpoints !== undefined
          ? { checkpoints: [...new Set(dto.checkpoints)].sort((a, b) => a - b) }
          : {}),
        ...(dto.deadline !== undefined
          ? { deadline: dto.deadline ? new Date(dto.deadline) : null }
          : {}),
      },
    });
    return this.getTest(teamId, id);
  }

  // ── Daily notes ───────────────────────────────────────────────────────

  async saveDailyNote(user: AuthUser, testId: string, dto: DailyNoteDto) {
    await this.ensureTest(user.teamId, testId);
    const date = new Date(dto.date.slice(0, 10));
    const content = dto.content.trim();
    if (!content) throw new BadRequestException('La note est vide.');
    await this.prisma.stabilityDailyNote.upsert({
      where: { testId_date: { testId, date } },
      create: { testId, date, content, authorName: user.name },
      update: { content, authorName: user.name },
    });
    return this.getTest(user.teamId, testId);
  }

  async deleteDailyNote(teamId: string, id: string) {
    const note = await this.prisma.stabilityDailyNote.findFirst({
      where: { id, test: { teamId } },
      select: { testId: true },
    });
    if (!note) throw new NotFoundException('Note introuvable');
    await this.prisma.stabilityDailyNote.delete({ where: { id } });
    return this.getTest(teamId, note.testId);
  }

  /** Keeps only ids of members of the team (dedup). */
  private async teamUserIds(teamId: string, ids: string[]) {
    if (!ids.length) return [];
    const users = await this.prisma.user.findMany({
      where: { teamId, id: { in: [...new Set(ids)] } },
      select: { id: true },
    });
    if (users.length !== new Set(ids).size) {
      throw new BadRequestException("Certaines personnes ne font pas partie de l'équipe.");
    }
    return users.map((u) => u.id);
  }

  /** Same recipients on every test of the campaign. */
  async setWatchers(teamId: string, id: string, dto: WatchersDto) {
    const test = await this.prisma.stabilityTest.findFirst({
      where: { id, teamId },
      select: { campaignId: true, createdById: true },
    });
    if (!test) throw new NotFoundException('Test introuvable');
    const userIds = await this.teamUserIds(
      teamId,
      dto.userIds.filter((u) => u !== test.createdById),
    );
    const tests = await this.prisma.stabilityTest.findMany({
      where: { teamId, campaignId: test.campaignId },
      select: { id: true },
    });
    const testIds = tests.map((t) => t.id);
    await this.prisma.$transaction([
      this.prisma.stabilityWatcher.deleteMany({ where: { testId: { in: testIds } } }),
      this.prisma.stabilityWatcher.createMany({
        data: testIds.flatMap((testId) => userIds.map((userId) => ({ testId, userId }))),
      }),
    ]);
    return this.getTest(teamId, id);
  }

  async deleteTest(teamId: string, id: string) {
    await this.ensureTest(teamId, id);
    const keys = await this.photoKeys({ observation: { testId: id } });
    await this.prisma.stabilityTest.delete({ where: { id } });
    await this.storage.remove(keys);
  }

  private async photoKeys(where: object) {
    const photos = await this.prisma.stabilityPhoto.findMany({
      where,
      select: { storageKey: true },
    });
    return photos.map((p) => p.storageKey);
  }

  // ── Observations ──────────────────────────────────────────────────────

  private observationData(dto: ObservationDto) {
    return {
      day: dto.day ?? null,
      observedAt: new Date(dto.observedAt),
      odor: dto.odor,
      color: dto.color,
      appearance: dto.appearance,
      ph: dto.ph ?? null,
      viscosity: dto.viscosity ?? null,
      peroxideValue: dto.peroxideValue ?? null,
      comment: dto.comment?.trim() || null,
    };
  }

  async addObservation(user: AuthUser, testId: string, dto: ObservationDto) {
    await this.ensureTest(user.teamId, testId);
    const observation = await this.prisma.stabilityObservation.create({
      data: { testId, observerName: user.name, ...this.observationData(dto) },
    });
    // Completes the test once every checkpoint has an observation.
    const test = await this.getTest(user.teamId, testId);
    if (
      test.status === 'in_progress' &&
      test.checkpointList.every((c) => c.done)
    ) {
      await this.prisma.stabilityTest.update({
        where: { id: testId },
        data: { status: 'completed' },
      });
    }
    return {
      observationId: observation.id,
      test: await this.getTest(user.teamId, testId),
    };
  }

  private async ensureObservation(teamId: string, id: string) {
    const observation = await this.prisma.stabilityObservation.findFirst({
      where: { id, test: { teamId } },
      select: { id: true, testId: true },
    });
    if (!observation) throw new NotFoundException('Observation introuvable');
    return observation;
  }

  async updateObservation(teamId: string, id: string, dto: ObservationDto) {
    const { testId } = await this.ensureObservation(teamId, id);
    await this.prisma.stabilityObservation.update({
      where: { id },
      data: this.observationData(dto),
    });
    return this.getTest(teamId, testId);
  }

  async deleteObservation(teamId: string, id: string) {
    const { testId } = await this.ensureObservation(teamId, id);
    const keys = await this.photoKeys({ observationId: id });
    await this.prisma.stabilityObservation.delete({ where: { id } });
    await this.storage.remove(keys);
    return this.getTest(teamId, testId);
  }

  // ── Photos ────────────────────────────────────────────────────────────

  async addPhoto(
    teamId: string,
    observationId: string,
    file:
      { buffer: Buffer; mimetype: string; originalname: string } | undefined,
  ) {
    if (!file) throw new BadRequestException('Aucune photo reçue.');
    if (!PHOTO_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Format non pris en charge (JPEG, PNG, WebP, HEIC ou GIF).',
      );
    }
    const { testId } = await this.ensureObservation(teamId, observationId);
    const id = randomUUID();
    const ext = file.mimetype.split('/')[1] ?? 'bin';
    const storageKey = `teams/${teamId}/stability/${testId}/${id}.${ext}`;
    await this.storage.put(storageKey, new Uint8Array(file.buffer), file.mimetype);
    await this.prisma.stabilityPhoto.create({
      data: {
        id,
        observationId,
        mimeType: file.mimetype,
        fileName: file.originalname,
        storageKey,
      },
    });
    return this.getTest(teamId, testId);
  }

  async getPhoto(teamId: string, id: string) {
    const photo = await this.prisma.stabilityPhoto.findFirst({
      where: { id, observation: { test: { teamId } } },
    });
    if (!photo) throw new NotFoundException('Photo introuvable');
    return photo;
  }

  /** Signed R2 URL, or null for a legacy photo still stored in the DB. */
  async getPhotoUrl(teamId: string, id: string) {
    const photo = await this.prisma.stabilityPhoto.findFirst({
      where: { id, observation: { test: { teamId } } },
      select: { storageKey: true },
    });
    if (!photo) throw new NotFoundException('Photo introuvable');
    return {
      url: photo.storageKey ? await this.storage.signedUrl(photo.storageKey) : null,
    };
  }

  async deletePhoto(teamId: string, id: string) {
    const photo = await this.prisma.stabilityPhoto.findFirst({
      where: { id, observation: { test: { teamId } } },
      select: {
        id: true,
        storageKey: true,
        observation: { select: { testId: true } },
      },
    });
    if (!photo) throw new NotFoundException('Photo introuvable');
    await this.prisma.stabilityPhoto.delete({ where: { id } });
    await this.storage.remove([photo.storageKey]);
    return this.getTest(teamId, photo.observation.testId);
  }

  // ── Known data ────────────────────────────────────────────────────────

  /** Stability risks of a list of materials (unsaved formula in the builder). */
  async risks(teamId: string, dto: RisksDto) {
    const ids = dto.lines.map((l) => l.materialId);
    const [materials, specs] = await Promise.all([
      this.prisma.material.findMany({
        where: { teamId, id: { in: ids } },
        select: { id: true, name: true, casNumber: true, regulatory: true },
      }),
      this.specs(),
    ]);
    const byId = new Map(materials.map((m) => [m.id, m]));
    return formulaRisks(
      dto.lines.flatMap((l) => {
        const material = byId.get(l.materialId);
        return material ? [{ material, percent: l.percent ?? null }] : [];
      }),
      specs,
    );
  }

  /** Stability risks of a saved formula. */
  async formulaRisks(teamId: string, formulaId: string) {
    const formula = await this.prisma.formula.findFirst({
      where: { id: formulaId, teamId },
      include: {
        lines: {
          include: {
            material: {
              select: {
                id: true,
                name: true,
                casNumber: true,
                regulatory: true,
              },
            },
          },
        },
      },
    });
    if (!formula) throw new NotFoundException('Formule introuvable');
    const total = formula.lines.reduce((sum, l) => sum + l.quantity, 0);
    return formulaRisks(
      formula.lines.map((l) => ({
        material: l.material,
        percent:
          total > 0 ? Math.round((l.quantity / total) * 10000) / 100 : null,
      })),
      await this.specs(),
    );
  }

  /** Catalog view: every material with known stability data. */
  async materialsOverview(teamId: string) {
    const [materials, specs] = await Promise.all([
      this.prisma.material.findMany({
        where: { teamId },
        select: { id: true, name: true, casNumber: true, regulatory: true },
        orderBy: { name: 'asc' },
      }),
      this.specs(),
    ]);
    return materials
      .map((m) => materialStability(m, specs))
      .filter((m) => m.issue || m.triggers || m.impact || m.specs.length > 0);
  }

  /** One material: known data and what the lab saw on formulas containing it. */
  async materialDetail(teamId: string, materialId: string) {
    const material = await this.prisma.material.findFirst({
      where: { id: materialId, teamId },
      select: { id: true, name: true, casNumber: true, regulatory: true },
    });
    if (!material) throw new NotFoundException('Matière introuvable');
    const known = materialStability(material, await this.specs());

    const tests = await this.prisma.stabilityTest.findMany({
      where: { teamId, formula: { lines: { some: { materialId } } } },
      include: {
        formula: { select: { id: true, name: true } },
        observations: {
          select: { day: true, odor: true, color: true, appearance: true },
        },
      },
      orderBy: { startDate: 'desc' },
    });
    const history = tests.map((t) => {
      const grades = t.observations.map(observationGrade);
      return {
        testId: t.id,
        formula: t.formula,
        condition: t.condition,
        conditionLabel: t.conditionLabel,
        status: t.status,
        conclusion: t.conclusion,
        startDate: t.startDate,
        worstGrade: grades.includes('altered')
          ? 'altered'
          : grades.includes('slight')
            ? 'slight'
            : grades.length
              ? 'conform'
              : null,
      };
    });

    // Lab trend by condition: how often formulas containing it degraded.
    const byCondition = new Map<string, { tests: number; degraded: number }>();
    for (const h of history) {
      if (!h.worstGrade) continue;
      const entry = byCondition.get(h.condition) ?? { tests: 0, degraded: 0 };
      entry.tests++;
      if (h.worstGrade === 'altered' || h.conclusion === 'non_conform')
        entry.degraded++;
      byCondition.set(h.condition, entry);
    }
    return {
      known,
      history,
      trends: [...byCondition.entries()].map(([condition, v]) => ({
        condition,
        ...v,
      })),
    };
  }
}
