import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from '../auth/auth-user.js';
import type { ApiClient } from '../api-keys/api-key.guard.js';
import type { CreateFormulationRequestDto } from './dto/create-formulation-request.dto.js';

export const REQUEST_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

const PERSON = { select: { id: true, name: true, email: true } } as const;
const INTERNAL_INCLUDE = {
  assignedTo: PERSON,
  completedBy: PERSON,
  apiKey: { select: { id: true, name: true } },
} as const;

/** Vue renvoyée à la plateforme externe (pas de données internes à l'équipe). */
export function toPublicRequest(r: {
  id: string;
  externalRef: string | null;
  status: string;
  perfumeName: string | null;
  description: string;
  requesterName: string;
  requesterEmail: string;
  forClient: boolean;
  clientCompany: string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
  projectName: string | null;
  createdAt: Date;
  updatedAt: Date;
  assignedAt: Date | null;
  completedAt: Date | null;
  assignedTo?: { name: string; email: string } | null;
  completedBy?: { name: string; email: string } | null;
}) {
  return {
    id: r.id,
    externalRef: r.externalRef,
    status: r.status,
    perfumeName: r.perfumeName,
    description: r.description,
    requester: { name: r.requesterName, email: r.requesterEmail },
    forClient: r.forClient,
    client: r.forClient
      ? { company: r.clientCompany, firstName: r.clientFirstName, lastName: r.clientLastName }
      : null,
    projectName: r.projectName,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    assignedTo: r.assignedTo ? { name: r.assignedTo.name, email: r.assignedTo.email } : null,
    assignedAt: r.assignedAt,
    completedBy: r.completedBy ? { name: r.completedBy.name, email: r.completedBy.email } : null,
    completedAt: r.completedAt,
  };
}

@Injectable()
export class FormulationRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async createFromApi(client: ApiClient, dto: CreateFormulationRequestDto) {
    const forClient = dto.forClient ?? false;
    const created = await this.prisma.formulationRequest.create({
      data: {
        teamId: client.teamId,
        apiKeyId: client.apiKeyId,
        externalRef: dto.externalRef,
        requesterName: dto.requesterName,
        requesterEmail: dto.requesterEmail,
        perfumeName: dto.perfumeName,
        description: dto.description,
        forClient,
        // Les infos client ne sont gardées que si la demande concerne un client.
        clientCompany: forClient ? dto.clientCompany : null,
        clientFirstName: forClient ? dto.clientFirstName : null,
        clientLastName: forClient ? dto.clientLastName : null,
        clientEmail: forClient ? dto.clientEmail : null,
        clientPhone: forClient ? dto.clientPhone : null,
        projectName: dto.projectName,
      },
      include: { assignedTo: PERSON, completedBy: PERSON },
    });
    return toPublicRequest(created);
  }

  async findAllForApi(client: ApiClient, status?: string) {
    if (status && !REQUEST_STATUSES.includes(status as RequestStatus)) {
      throw new BadRequestException(`status doit être l'un de : ${REQUEST_STATUSES.join(', ')}`);
    }
    const rows = await this.prisma.formulationRequest.findMany({
      where: { apiKeyId: client.apiKeyId, ...(status ? { status } : {}) },
      include: { assignedTo: PERSON, completedBy: PERSON },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map(toPublicRequest);
  }

  async findOneForApi(client: ApiClient, id: string) {
    return toPublicRequest(await this.findOwnedByKey(client, id));
  }

  async cancelFromApi(client: ApiClient, id: string) {
    await this.findOwnedByKey(client, id);
    // Mise à jour conditionnelle : évite d'annuler une demande prise en charge entre-temps.
    const { count } = await this.prisma.formulationRequest.updateMany({
      where: { id, apiKeyId: client.apiKeyId, status: 'pending' },
      data: { status: 'cancelled' },
    });
    if (count === 0) {
      throw new ConflictException('Seule une demande en attente peut être annulée.');
    }
    return this.findOneForApi(client, id);
  }

  // ---------- Côté équipe Lylo-Lab (session utilisateur) ----------

  findAllForTeam(teamId: string, status?: string) {
    if (status && !REQUEST_STATUSES.includes(status as RequestStatus)) {
      throw new BadRequestException(`status doit être l'un de : ${REQUEST_STATUSES.join(', ')}`);
    }
    return this.prisma.formulationRequest.findMany({
      where: { teamId, ...(status ? { status } : {}) },
      include: INTERNAL_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async countPending(teamId: string) {
    return { pending: await this.prisma.formulationRequest.count({ where: { teamId, status: 'pending' } }) };
  }

  async findOneForTeam(teamId: string, id: string) {
    const request = await this.prisma.formulationRequest.findFirst({
      where: { id, teamId },
      include: INTERNAL_INCLUDE,
    });
    if (!request) throw new NotFoundException('Demande introuvable.');
    return request;
  }

  /**
   * « Je m'en occupe » : réserve la demande pour l'utilisateur, puis crée (ou retrouve)
   * le client et le projet, et une formule brouillon liée. Tout ou rien.
   */
  async take(user: AuthUser, id: string) {
    const request = await this.findOneForTeam(user.teamId, id);
    if (request.status !== 'pending') {
      const who = request.assignedTo?.name;
      throw new ConflictException(
        request.status === 'in_progress' && who
          ? `Cette demande est déjà prise en charge par ${who}.`
          : "Cette demande n'est plus en attente.",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Réservation atomique : si deux parfumeurs cliquent en même temps, un seul gagne.
      const now = new Date();
      const { count } = await tx.formulationRequest.updateMany({
        where: { id, teamId: user.teamId, status: 'pending' },
        data: { status: 'in_progress', assignedToId: user.id, assignedAt: now },
      });
      if (count === 0) throw new ConflictException('Cette demande vient d\'être prise par quelqu\'un d\'autre.');

      let clientId: string | null = null;
      let projectId: string | null = null;

      if (request.forClient) {
        const existingClient = await tx.client.findFirst({
          where: {
            teamId: user.teamId,
            OR: [
              ...(request.clientEmail ? [{ contactEmail: request.clientEmail }] : []),
              ...(request.clientCompany ? [{ company: request.clientCompany }] : []),
            ],
          },
          select: { id: true },
        });
        clientId =
          existingClient?.id ??
          (
            await tx.client.create({
              data: {
                teamId: user.teamId,
                company: request.clientCompany,
                contactFirstName: request.clientFirstName,
                contactLastName: request.clientLastName,
                contactEmail: request.clientEmail,
                contactPhone: request.clientPhone,
              },
              select: { id: true },
            })
          ).id;

        const projectName =
          request.projectName || request.perfumeName || `Demande du ${now.toLocaleDateString('fr-FR')}`;
        // (clientId, name) est unique : on réutilise le projet s'il existe déjà.
        const project = await tx.project.upsert({
          where: { clientId_name: { clientId, name: projectName } },
          update: {},
          create: {
            teamId: user.teamId,
            clientId,
            name: projectName,
            description: request.description,
          // La formule démarre le jour de la prise en charge.
          startDate: now,
          },
          select: { id: true },
        });
        projectId = project.id;
      }

      const formula = await tx.formula.create({
        data: {
          teamId: user.teamId,
          name: request.perfumeName || request.projectName || 'Formule sur demande',
          description: request.description,
          status: 'draft',
          source: 'request',
          projectId,
          createdById: user.id,
          createdByName: user.name,
        },
        select: { id: true },
      });

      await tx.formulationRequest.update({
        where: { id },
        data: { clientId, projectId, formulaId: formula.id },
      });
    });

    return this.findOneForTeam(user.teamId, id);
  }

  /** « Commencer » : seule la personne qui a pris la demande peut la démarrer. */
  async start(user: AuthUser, id: string) {
    const request = await this.findOneForTeam(user.teamId, id);
    if (request.assignedToId !== user.id) {
      throw new ForbiddenException("Seule la personne qui s'occupe de cette demande peut la commencer.");
    }
    if (request.status !== 'in_progress') {
      throw new ConflictException("Cette demande n'est pas en cours.");
    }
    if (!request.startedAt) {
      await this.prisma.formulationRequest.update({ where: { id }, data: { startedAt: new Date() } });
    }
    return this.findOneForTeam(user.teamId, id);
  }

  private async findOwnedByKey(client: ApiClient, id: string) {
    const request = await this.prisma.formulationRequest.findFirst({
      where: { id, apiKeyId: client.apiKeyId },
      include: { assignedTo: PERSON, completedBy: PERSON },
    });
    if (!request) throw new NotFoundException('Demande introuvable.');
    return request;
  }
}
