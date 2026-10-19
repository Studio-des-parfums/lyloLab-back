import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateFormulaDto } from './dto/create-formula.dto.js';

@Injectable()
export class FormulasService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.formula.findMany({
      orderBy: { name: 'asc' },
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
}
