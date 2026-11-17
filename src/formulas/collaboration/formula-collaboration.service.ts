import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthUser } from '../../auth/auth-user.js';
import { WebhooksService } from '../../api-keys/webhooks.service.js';
import { toPublicRequest } from '../../formulation-requests/formulation-requests.service.js';

const PERSON = { select: { id: true, name: true, email: true } } as const;
const AUTHOR = { author: { select: { id: true, name: true } } } as const;

/** Description partagée, notes par version et discussion d'équipe d'une formule. */
@Injectable()
export class FormulaCollaborationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly webhooks: WebhooksService,
  ) {}

  private async lineageOf(teamId: string, id: string) {
    const formula = await this.prisma.formula.findFirst({
      where: { id, teamId },
      select: { id: true, rootFormulaId: true, name: true, version: true },
    });
    if (!formula) throw new NotFoundException(`Formula "${id}" not found`);
    return { ...formula, rootId: formula.rootFormulaId ?? formula.id };
  }

  /** Le résultat visé : commun à toutes les versions, modifiable même si une version est finalisée. */
  async updateDescription(user: AuthUser, id: string, description: string | null | undefined) {
    const { rootId } = await this.lineageOf(user.teamId, id);
    const value = description?.trim() || null;
    await this.prisma.formula.updateMany({
      where: { teamId: user.teamId, OR: [{ id: rootId }, { rootFormulaId: rootId }] },
      data: { description: value },
    });
    return { description: value };
  }

  /** Dates de début et de fin de la formule, communes à toutes ses versions. */
  async updateSchedule(user: AuthUser, id: string, dates: { startDate?: string | null; endDate?: string | null }) {
    const { rootId } = await this.lineageOf(user.teamId, id);
    const toDate = (v: string | null | undefined) => (v === undefined ? undefined : v ? new Date(v) : null);
    const data = { startDate: toDate(dates.startDate), endDate: toDate(dates.endDate) };
    const current = await this.prisma.formula.findUnique({ where: { id: rootId }, select: { startDate: true, endDate: true } });
    const start = data.startDate !== undefined ? data.startDate : current?.startDate;
    const end = data.endDate !== undefined ? data.endDate : current?.endDate;
    if (start && end && end < start) {
      throw new BadRequestException('La date de fin doit être après la date de début.');
    }
    await this.prisma.formula.updateMany({
      where: { teamId: user.teamId, OR: [{ id: rootId }, { rootFormulaId: rootId }] },
      data,
    });
    return { startDate: start ?? null, endDate: end ?? null };
  }

  /**
   * Désigne la version finale de la formule : elle est finalisée (verrouillée) au passage.
   * Si la formule vient d'une demande externe encore en cours, la demande est terminée
   * et la plateforme d'origine est prévenue par webhook.
   */
  async markFinal(user: AuthUser, id: string) {
    const { rootId } = await this.lineageOf(user.teamId, id);
    const completedRequestId = await this.prisma.$transaction(async (tx) => {
      await tx.formula.update({ where: { id }, data: { status: 'completed' } });
      await tx.formula.updateMany({
        where: { teamId: user.teamId, OR: [{ id: rootId }, { rootFormulaId: rootId }] },
        data: { finalVersionId: id },
      });
      // Conditionnel sur le statut : une demande annulée ou déjà terminée n'est pas touchée.
      const request = await tx.formulationRequest.findFirst({
        where: { teamId: user.teamId, formulaId: rootId, status: 'in_progress' },
        select: { id: true },
      });
      if (!request) return null;
      const { count } = await tx.formulationRequest.updateMany({
        where: { id: request.id, status: 'in_progress' },
        data: { status: 'completed', completedById: user.id, completedAt: new Date() },
      });
      return count ? request.id : null;
    });

    if (completedRequestId) {
      const request = await this.prisma.formulationRequest.findUnique({
        where: { id: completedRequestId },
        include: { assignedTo: PERSON, completedBy: PERSON },
      });
      if (request) this.webhooks.notify(request.apiKeyId, 'formulation_request.completed', toPublicRequest(request));
    }
    return { finalVersionId: id };
  }

  async unmarkFinal(user: AuthUser, id: string) {
    const { rootId } = await this.lineageOf(user.teamId, id);
    await this.prisma.formula.updateMany({
      where: { teamId: user.teamId, OR: [{ id: rootId }, { rootFormulaId: rootId }] },
      data: { finalVersionId: null },
    });
    return { finalVersionId: null };
  }

  /** Toutes les versions d'une formule, pour la page de suivi (graphique et liste). */
  async lineage(user: AuthUser, id: string) {
    const { rootId } = await this.lineageOf(user.teamId, id);
    const versions = await this.prisma.formula.findMany({
      where: { teamId: user.teamId, OR: [{ id: rootId }, { rootFormulaId: rootId }] },
      orderBy: { version: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        version: true,
        status: true,
        description: true,
        finalVersionId: true,
        startDate: true,
        endDate: true,
        totalVolumeMl: true,
        createdAt: true,
        createdByName: true,
        createdBy: { select: { id: true, name: true } },
        project: { select: { id: true, name: true, client: { select: { id: true, company: true, contactFirstName: true, contactLastName: true } } } },
        _count: { select: { notes: true, lines: true } },
      },
    });
    const root = versions.find((v) => v.id === rootId) ?? versions[0];
    return {
      rootId,
      name: versions[versions.length - 1]?.name ?? root.name,
      description: root.description,
      startDate: root.startDate,
      endDate: root.endDate,
      finalVersionId: root.finalVersionId,
      project: root.project,
      versions,
    };
  }

  // ---------- Notes (par version) ----------

  async listNotes(user: AuthUser, id: string) {
    await this.lineageOf(user.teamId, id);
    return this.prisma.formulaNote.findMany({
      where: { formulaId: id },
      orderBy: { createdAt: 'desc' },
      include: AUTHOR,
    });
  }

  async addNote(user: AuthUser, id: string, body: string) {
    await this.lineageOf(user.teamId, id);
    return this.prisma.formulaNote.create({
      data: { formulaId: id, body: body.trim(), authorId: user.id, authorName: user.name },
      include: AUTHOR,
    });
  }

  async deleteNote(user: AuthUser, id: string, noteId: string) {
    await this.lineageOf(user.teamId, id);
    const note = await this.prisma.formulaNote.findFirst({ where: { id: noteId, formulaId: id } });
    if (!note) throw new NotFoundException('Note introuvable.');
    if (note.authorId !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('Seul son auteur ou un administrateur peut supprimer cette note.');
    }
    await this.prisma.formulaNote.delete({ where: { id: noteId } });
  }

  // ---------- Discussion d'équipe (par formule, toutes versions) ----------

  async listMessages(user: AuthUser, id: string) {
    const { rootId } = await this.lineageOf(user.teamId, id);
    return this.prisma.formulaMessage.findMany({
      where: { rootFormulaId: rootId },
      orderBy: { createdAt: 'asc' },
      take: 500,
      include: AUTHOR,
    });
  }

  async postMessage(user: AuthUser, id: string, body: string, mentionUserIds: string[] = []) {
    const lineage = await this.lineageOf(user.teamId, id);
    // On ne notifie que de vrais membres de l'équipe, jamais soi-même.
    const mentioned = await this.prisma.user.findMany({
      where: { teamId: user.teamId, id: { in: [...new Set(mentionUserIds)].filter((m) => m !== user.id) } },
      select: { id: true },
    });
    const mentionIds = mentioned.map((m) => m.id);
    const text = body.trim();

    return this.prisma.$transaction(async (tx) => {
      const message = await tx.formulaMessage.create({
        data: {
          rootFormulaId: lineage.rootId,
          teamId: user.teamId,
          body: text,
          mentions: mentionIds,
          authorId: user.id,
          authorName: user.name,
        },
        include: AUTHOR,
      });
      if (mentionIds.length > 0) {
        await tx.notification.createMany({
          data: mentionIds.map((userId) => ({
            userId,
            type: 'mention',
            actorName: user.name,
            excerpt: text.slice(0, 280),
            formulaId: lineage.id,
          })),
        });
      }
      return message;
    });
  }
}
