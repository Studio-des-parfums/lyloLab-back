import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ApiClient } from '../api-keys/api-key.guard.js';
import type { CreateFormulationRequestDto } from './dto/create-formulation-request.dto.js';

export const REQUEST_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

const PERSON = { select: { id: true, name: true, email: true } } as const;

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

  private async findOwnedByKey(client: ApiClient, id: string) {
    const request = await this.prisma.formulationRequest.findFirst({
      where: { id, apiKeyId: client.apiKeyId },
      include: { assignedTo: PERSON, completedBy: PERSON },
    });
    if (!request) throw new NotFoundException('Demande introuvable.');
    return request;
  }
}
