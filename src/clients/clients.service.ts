import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateClientDto } from './dto/create-client.dto.js';
import type { UpdateClientDto } from './dto/update-client.dto.js';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(teamId: string) {
    return this.prisma.client.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
      include: { projects: { orderBy: { name: 'asc' } } },
    });
  }

  async findOne(teamId: string, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, teamId },
      include: { projects: { orderBy: { name: 'asc' } } },
    });
    if (!client) {
      throw new NotFoundException(`Client "${id}" not found`);
    }
    return client;
  }

  create(teamId: string, dto: CreateClientDto) {
    return this.prisma.client.create({
      data: {
        teamId,
        company: dto.company,
        contactFirstName: dto.contactFirstName,
        contactLastName: dto.contactLastName,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
      },
    });
  }

  async update(teamId: string, id: string, dto: UpdateClientDto) {
    await this.findOne(teamId, id);
    return this.prisma.client.update({ where: { id }, data: dto });
  }
}
