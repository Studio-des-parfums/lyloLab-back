import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

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
}
