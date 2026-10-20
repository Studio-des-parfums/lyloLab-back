import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateFormulaDto } from './dto/create-formula.dto.js';
import type { UpdateFormulaStatusDto } from './dto/update-formula-status.dto.js';

@Injectable()
export class FormulasService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(status?: 'draft' | 'completed') {
    return this.prisma.formula.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const formula = await this.prisma.formula.findUnique({
      where: { id },
      include: { lines: { include: { material: true } } },
    });
    if (!formula) {
      throw new NotFoundException(`Formula "${id}" not found`);
    }
    return formula;
  }

  create(dto: CreateFormulaDto) {
    return this.prisma.formula.create({
      data: {
        name: dto.name,
        facets: dto.facets,
        adjustments: dto.adjustments,
        source: 'user',
        status: dto.status ?? 'draft',
        lines: {
          create: dto.lines.map((line) => ({
            materialId: line.materialId,
            quantity: line.quantity,
          })),
        },
      },
      include: { lines: { include: { material: true } } },
    });
  }

  async update(id: string, dto: CreateFormulaDto) {
    await this.findOne(id);
    return this.prisma.formula.update({
      where: { id },
      data: {
        name: dto.name,
        facets: dto.facets,
        adjustments: dto.adjustments,
        ...(dto.status ? { status: dto.status } : {}),
        lines: {
          deleteMany: {},
          create: dto.lines.map((line) => ({
            materialId: line.materialId,
            quantity: line.quantity,
          })),
        },
      },
      include: { lines: { include: { material: true } } },
    });
  }

  async updateStatus(id: string, dto: UpdateFormulaStatusDto) {
    await this.findOne(id);
    return this.prisma.formula.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.formula.delete({ where: { id } });
  }
}
