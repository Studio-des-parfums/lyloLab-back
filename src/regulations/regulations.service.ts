import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { syncOfficialRegulations } from './regulation-sync.js';
import type {
  CreateRegulationDto,
  UpdateRegulationDto,
  UpsertEntryDto,
} from './dto/regulation.dto.js';

export interface RegulationSummary {
  id: string;
  name: string;
  description: string | null;
  custom: boolean;
  continent: string | null;
  country: string | null;
  effectiveFrom: Date | null;
  status: string;
  materialCount: number;
}

export interface RegulationDetail extends RegulationSummary {
  materials: {
    materialId: string;
    material: string;
    status: string;
    maxPercent: number | null;
    detail: string | null;
    note: string | null;
  }[];
  substances: { name: string; casNumber: string | null }[];
  sources: {
    ref: number;
    jurisdiction: string;
    organisation: string;
    title: string;
    date: string;
    url: string;
    usage: string | null;
  }[];
}

/** Regulations visible to a team: the official ones and its own. */
const visibleTo = (teamId: string) => ({ OR: [{ teamId: null }, { teamId }] });

@Injectable()
export class RegulationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(teamId: string): Promise<RegulationSummary[]> {
    const regulations = await this.prisma.regulation.findMany({
      where: visibleTo(teamId),
      orderBy: [{ createdAt: 'asc' }],
      include: {
        // Entries are counted for this team's materials only.
        _count: { select: { entries: { where: { material: { teamId } } } } },
      },
    });
    return regulations.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      custom: r.teamId !== null,
      continent: r.continent,
      country: r.country,
      effectiveFrom: r.effectiveFrom,
      status: r.status,
      materialCount: r._count.entries,
    }));
  }

  async findOne(teamId: string, id: string): Promise<RegulationDetail> {
    const r = await this.prisma.regulation.findFirst({
      where: { id, ...visibleTo(teamId) },
      include: {
        entries: {
          where: { material: { teamId } },
          include: { material: { select: { name: true } } },
          orderBy: { material: { name: 'asc' } },
        },
        substances: {
          select: { name: true, casNumber: true },
          orderBy: { name: 'asc' },
        },
        sources: {
          include: { source: true },
          orderBy: { source: { ref: 'asc' } },
        },
      },
    });
    if (!r) throw new NotFoundException(`Réglementation "${id}" introuvable`);
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      custom: r.teamId !== null,
      continent: r.continent,
      country: r.country,
      effectiveFrom: r.effectiveFrom,
      status: r.status,
      materialCount: r.entries.length,
      materials: r.entries.map((e) => ({
        materialId: e.materialId,
        material: e.material.name,
        status: e.status,
        maxPercent: e.maxPercent,
        detail: e.detail,
        note: e.note,
      })),
      substances: r.substances,
      sources: r.sources.map(({ source: { id: _id, ...source } }) => source),
    };
  }

  /** Limits of every custom regulation, used to check formulas. */
  async customLimits(teamId: string) {
    const entries = await this.prisma.regulationEntry.findMany({
      where: { regulation: { teamId }, maxPercent: { not: null } },
      select: {
        materialId: true,
        maxPercent: true,
        regulation: { select: { id: true, name: true } },
      },
    });
    return entries.map((e) => ({
      regulationId: e.regulation.id,
      regulation: e.regulation.name,
      materialId: e.materialId,
      maxPercent: e.maxPercent!,
    }));
  }

  /** Recomputes the official regulations of the team's materials. */
  sync(teamId: string, materialIds?: string[]) {
    return syncOfficialRegulations(this.prisma, teamId, materialIds);
  }

  private async findCustom(teamId: string, id: string) {
    const regulation = await this.prisma.regulation.findFirst({
      where: { id, ...visibleTo(teamId) },
    });
    if (!regulation)
      throw new NotFoundException(`Réglementation "${id}" introuvable`);
    if (regulation.teamId === null) {
      throw new ForbiddenException(
        'Les réglementations officielles se mettent à jour depuis les fiches des matières.',
      );
    }
    return regulation;
  }

  async create(teamId: string, dto: CreateRegulationDto) {
    const r = await this.prisma.regulation.create({
      data: {
        teamId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        continent: dto.continent?.trim() || null,
        country: dto.country?.trim() || null,
      },
    });
    return this.findOne(teamId, r.id);
  }

  async update(teamId: string, id: string, dto: UpdateRegulationDto) {
    await this.findCustom(teamId, id);
    await this.prisma.regulation.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() || null }
          : {}),
        ...(dto.continent !== undefined
          ? { continent: dto.continent.trim() || null }
          : {}),
        ...(dto.country !== undefined
          ? { country: dto.country.trim() || null }
          : {}),
      },
    });
    return this.findOne(teamId, id);
  }

  async remove(teamId: string, id: string) {
    await this.findCustom(teamId, id);
    await this.prisma.regulation.delete({ where: { id } });
  }

  async upsertEntry(teamId: string, id: string, dto: UpsertEntryDto) {
    await this.findCustom(teamId, id);
    const material = await this.prisma.material.findFirst({
      where: { id: dto.materialId, teamId },
    });
    if (!material) throw new NotFoundException('Matière introuvable');
    // null in the request bans the material.
    const maxPercent = dto.maxPercent ?? 0;
    const data = {
      maxPercent,
      status: maxPercent === 0 ? 'Interdite' : `Max ${maxPercent} %`,
      note: dto.note?.trim() || null,
      origin: 'manual',
    };
    await this.prisma.regulationEntry.upsert({
      where: {
        regulationId_materialId: {
          regulationId: id,
          materialId: dto.materialId,
        },
      },
      create: { regulationId: id, materialId: dto.materialId, ...data },
      update: data,
    });
    return this.findOne(teamId, id);
  }

  async removeEntry(teamId: string, id: string, materialId: string) {
    await this.findCustom(teamId, id);
    await this.prisma.regulationEntry.deleteMany({
      where: { regulationId: id, materialId },
    });
    return this.findOne(teamId, id);
  }
}
