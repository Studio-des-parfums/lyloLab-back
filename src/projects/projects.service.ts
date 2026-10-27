import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateProjectDto } from './dto/create-project.dto.js';
import type { UpdateProjectDto } from './dto/update-project.dto.js';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(teamId: string, clientId?: string) {
    return this.prisma.project.findMany({
      where: { teamId, ...(clientId ? { clientId } : {}) },
      orderBy: { name: 'asc' },
      include: { client: true },
    });
  }

  async findOne(teamId: string, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, teamId },
      include: {
        client: true,
        formulas: {
          orderBy: { createdAt: 'desc' },
          include: {
            materializedAs: { select: { id: true } },
            createdBy: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!project) {
      throw new NotFoundException(`Project "${id}" not found`);
    }
    return project;
  }

  async create(teamId: string, dto: CreateProjectDto) {
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, teamId },
      select: { id: true },
    });
    if (!client) {
      throw new NotFoundException(`Client "${dto.clientId}" not found`);
    }
    try {
      return await this.prisma.project.create({
        data: {
          teamId,
          name: dto.name,
          clientId: dto.clientId,
          description: dto.description,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        },
        include: { client: true },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          `Un projet nommé "${dto.name}" existe déjà pour ce client.`,
        );
      }
      throw err;
    }
  }

  async update(teamId: string, id: string, dto: UpdateProjectDto) {
    await this.findOne(teamId, id);
    try {
      return await this.prisma.project.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.startDate !== undefined
            ? { startDate: dto.startDate ? new Date(dto.startDate) : null }
            : {}),
          ...(dto.endDate !== undefined
            ? { endDate: dto.endDate ? new Date(dto.endDate) : null }
            : {}),
        },
        include: { client: true },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          `Un projet nommé "${dto.name}" existe déjà pour ce client.`,
        );
      }
      throw err;
    }
  }
}
