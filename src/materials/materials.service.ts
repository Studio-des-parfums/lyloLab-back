import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UpdateMaterialDto } from './dto/update-material.dto.js';
import type {
  CreateMaterialStockDto,
  UpdateMaterialStockDto,
} from './dto/material-stock.dto.js';

const MANUAL_STOCK_SOURCE = 'manual';

function cleanText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const text = value?.trim();
  return text ? text : null;
}

function cleanDescriptors(
  descriptors: Record<string, number>,
): Record<string, number> {
  const cleaned: Record<string, number> = {};
  for (const [key, value] of Object.entries(descriptors)) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) cleaned[key] = number;
  }
  return cleaned;
}

@Injectable()
export class MaterialsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(search?: string) {
    return this.prisma.material.findMany({
      where: search
        ? { name: { contains: search } }
        : undefined,
      include: { stocks: { orderBy: { id: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const material = await this.prisma.material.findUnique({
      where: { id },
      include: {
        stocks: { orderBy: { id: 'asc' } },
        sourceFormula: {
          include: { lines: { include: { material: true } } },
        },
      },
    });
    if (!material) {
      throw new NotFoundException(`Material "${id}" not found`);
    }
    return material;
  }

  async update(id: string, dto: UpdateMaterialDto) {
    await this.ensureMaterial(id);

    try {
      return await this.prisma.material.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.casNumber !== undefined
            ? { casNumber: cleanText(dto.casNumber) ?? null }
            : {}),
          ...(dto.family !== undefined
            ? { family: cleanText(dto.family) ?? null }
            : {}),
          ...(dto.sensation !== undefined
            ? { sensation: cleanText(dto.sensation) ?? null }
            : {}),
          ...(dto.weight !== undefined ? { weight: dto.weight } : {}),
          ...(dto.subjectivePower !== undefined
            ? { subjectivePower: dto.subjectivePower }
            : {}),
          ...(dto.descriptors !== undefined
            ? { descriptors: cleanDescriptors(dto.descriptors) }
            : {}),
          ...(dto.origin !== undefined ? { origin: dto.origin } : {}),
          ...(dto.nature !== undefined ? { nature: dto.nature } : {}),
          ...(dto.ifraCat4 !== undefined
            ? { ifraCat4: cleanText(dto.ifraCat4) ?? null }
            : {}),
          ...(dto.cosmeticRegulation !== undefined
            ? { cosmeticRegulation: cleanText(dto.cosmeticRegulation) ?? null }
            : {}),
          ...(dto.allergens !== undefined
            ? { allergens: cleanText(dto.allergens) ?? null }
            : {}),
          ...(dto.flavor !== undefined
            ? { flavor: cleanText(dto.flavor) ?? null }
            : {}),
          ...(dto.flavorRestriction !== undefined
            ? { flavorRestriction: cleanText(dto.flavorRestriction) ?? null }
            : {}),
          ...(dto.adjacentNote !== undefined
            ? { adjacentNote: cleanText(dto.adjacentNote) ?? null }
            : {}),
          ...(dto.regulation !== undefined
            ? { regulation: cleanText(dto.regulation) ?? null }
            : {}),
          ...(dto.freeNote !== undefined
            ? { freeNote: cleanText(dto.freeNote) ?? null }
            : {}),
          ...(dto.visualAspect !== undefined
            ? { visualAspect: cleanText(dto.visualAspect) ?? null }
            : {}),
          ...(dto.flashPoint !== undefined
            ? { flashPoint: cleanText(dto.flashPoint) ?? null }
            : {}),
          ...(dto.physicochemicalState !== undefined
            ? { physicochemicalState: cleanText(dto.physicochemicalState) ?? null }
            : {}),
          ...(dto.waterBase !== undefined ? { waterBase: dto.waterBase } : {}),
          ...(dto.regulatory !== undefined
            ? {
                regulatory:
                  dto.regulatory === null
                    ? Prisma.JsonNull
                    : (dto.regulatory as Prisma.InputJsonValue),
              }
            : {}),
        },
        include: { stocks: { orderBy: { id: 'asc' } } },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          `Une matière première nommée "${dto.name}" existe déjà.`,
        );
      }
      throw err;
    }
  }

  async createStock(materialId: string, dto: CreateMaterialStockDto) {
    await this.ensureMaterial(materialId);

    await this.prisma.materialStock.create({
      data: {
        materialId,
        label: dto.label.trim(),
        supplier: cleanText(dto.supplier) ?? null,
        producer: cleanText(dto.producer) ?? null,
        location: cleanText(dto.location) ?? null,
        stockGrams: dto.stockGrams ?? null,
        stockNote: cleanText(dto.stockNote) ?? null,
        source: MANUAL_STOCK_SOURCE,
      },
    });

    return this.findMaterialWithStocks(materialId);
  }

  async updateStock(
    materialId: string,
    stockId: number,
    dto: UpdateMaterialStockDto,
  ) {
    await this.ensureStock(materialId, stockId);

    await this.prisma.materialStock.update({
      where: { id: stockId },
      data: {
        ...(dto.label !== undefined ? { label: dto.label.trim() } : {}),
        ...(dto.supplier !== undefined
          ? { supplier: cleanText(dto.supplier) ?? null }
          : {}),
        ...(dto.producer !== undefined
          ? { producer: cleanText(dto.producer) ?? null }
          : {}),
        ...(dto.location !== undefined
          ? { location: cleanText(dto.location) ?? null }
          : {}),
        ...(dto.stockGrams !== undefined ? { stockGrams: dto.stockGrams } : {}),
        ...(dto.stockNote !== undefined
          ? { stockNote: cleanText(dto.stockNote) ?? null }
          : {}),
      },
    });

    return this.findMaterialWithStocks(materialId);
  }

  async deleteStock(materialId: string, stockId: number) {
    await this.ensureStock(materialId, stockId);
    await this.prisma.materialStock.delete({ where: { id: stockId } });
    return this.findMaterialWithStocks(materialId);
  }

  private async ensureMaterial(id: string) {
    const material = await this.prisma.material.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!material) {
      throw new NotFoundException(`Material "${id}" not found`);
    }
    return material;
  }

  private async ensureStock(materialId: string, stockId: number) {
    const stock = await this.prisma.materialStock.findUnique({
      where: { id: stockId },
      select: { id: true, materialId: true },
    });
    if (!stock || stock.materialId !== materialId) {
      throw new NotFoundException(
        `Stock "${stockId}" not found for material "${materialId}"`,
      );
    }
    return stock;
  }

  private async findMaterialWithStocks(id: string) {
    const material = await this.prisma.material.findUnique({
      where: { id },
      include: { stocks: { orderBy: { id: 'asc' } } },
    });
    if (!material) {
      throw new NotFoundException(`Material "${id}" not found`);
    }
    return material;
  }
}
