import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateFormulaDto } from './dto/create-formula.dto.js';
import type { UpdateFormulaStatusDto } from './dto/update-formula-status.dto.js';
import { parseIfraLimitPercent } from './ifra-limit.js';

interface MaterialRegulatory {
  ifraLimit?: string;
  rciiiRestriction?: string;
  isAllergen?: boolean;
  allergens?: string[];
  recombi?: string;
  physicoChemicalIssue?: string;
  triggeringConditions?: string;
  impactResult?: string;
  usaMocra?: string;
  californiaProp65?: string;
  chinaCsar?: string;
  chinaMeaning?: string;
  menaGso?: string;
  [key: string]: unknown;
}

const REGULATORY_NOTE_FIELDS: (keyof MaterialRegulatory)[] = [
  'rciiiRestriction',
  'recombi',
  'physicoChemicalIssue',
  'triggeringConditions',
  'impactResult',
  'usaMocra',
  'californiaProp65',
  'chinaCsar',
  'chinaMeaning',
  'menaGso',
];

@Injectable()
export class FormulasService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(status?: 'draft' | 'completed', projectId?: string) {
    return this.prisma.formula.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(projectId ? { projectId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        materializedAs: { select: { id: true } },
        project: { include: { client: true } },
      },
    });
  }

  async findOne(id: string) {
    const formula = await this.prisma.formula.findUnique({
      where: { id },
      include: {
        lines: { include: { material: true } },
        project: { include: { client: true } },
      },
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
        totalVolumeMl: dto.totalVolumeMl ?? null,
        source: 'user',
        status: dto.status ?? 'draft',
        projectId: dto.projectId ?? null,
        lines: {
          create: dto.lines.map((line) => ({
            materialId: line.materialId,
            quantity: line.quantity,
          })),
        },
      },
      include: { lines: { include: { material: true } }, project: { include: { client: true } } },
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
        ...(dto.totalVolumeMl !== undefined ? { totalVolumeMl: dto.totalVolumeMl } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.projectId !== undefined ? { projectId: dto.projectId } : {}),
        lines: {
          deleteMany: {},
          create: dto.lines.map((line) => ({
            materialId: line.materialId,
            quantity: line.quantity,
          })),
        },
      },
      include: { lines: { include: { material: true } }, project: { include: { client: true } } },
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

  async convertToMaterial(id: string) {
    const formula = await this.findOne(id);

    if (formula.lines.length === 0) {
      throw new BadRequestException(
        'La formule doit contenir au moins une matière première pour être convertie.',
      );
    }

    const totalQuantity = formula.lines.reduce((sum, line) => sum + line.quantity, 0);
    const descriptors: Record<string, number> = {};

    for (const line of formula.lines) {
      const materialDescriptors = line.material.descriptors as Record<string, number>;
      for (const [key, value] of Object.entries(materialDescriptors)) {
        descriptors[key] = (descriptors[key] ?? 0) + value * line.quantity;
      }
    }

    if (totalQuantity > 0) {
      for (const key of Object.keys(descriptors)) {
        descriptors[key] = Math.round((descriptors[key] / totalQuantity) * 100) / 100;
      }
    }

    const regulatory = this.aggregateRegulatory(formula.lines);

    try {
      return await this.prisma.material.create({
        data: {
          name: formula.name,
          descriptors,
          source: 'user',
          origin: 'synthetic',
          sourceFormulaId: formula.id,
          regulatory: (regulatory as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          `Une matière première nommée "${formula.name}" existe déjà. Renommez la formule avant de la convertir.`,
        );
      }
      throw err;
    }
  }

  /**
   * Builds the regulatory profile of a synthetic material from its ingredients:
   * allergens and the ifraLimit are unioned/combined into a single conservative
   * figure, while the free-text notes keep per-ingredient attribution so nothing
   * gets silently merged away.
   */
  private aggregateRegulatory(
    lines: { quantity: number; material: { name: string; regulatory: unknown } }[],
  ): MaterialRegulatory | null {
    let isAllergen = false;
    const allergens = new Set<string>();
    let mostRestrictiveLimit: number | null = null;
    const notes: Partial<Record<keyof MaterialRegulatory, string[]>> = {};

    for (const line of lines) {
      const reg = line.material.regulatory as MaterialRegulatory | null;
      if (!reg) continue;

      if (reg.isAllergen) isAllergen = true;
      for (const allergen of reg.allergens ?? []) allergens.add(allergen);

      const ingredientLimit = parseIfraLimitPercent(reg.ifraLimit);
      if (ingredientLimit !== null && line.quantity > 0) {
        // Scale the ingredient's own limit by how concentrated it is in this
        // blend: if it's capped at X% of the final fragrance and makes up
        // Y% of this material, the material itself can't exceed X/Y%.
        const scaledLimit = (ingredientLimit / line.quantity) * 100;
        if (mostRestrictiveLimit === null || scaledLimit < mostRestrictiveLimit) {
          mostRestrictiveLimit = scaledLimit;
        }
      }

      for (const field of REGULATORY_NOTE_FIELDS) {
        const value = reg[field];
        if (typeof value === 'string' && value.trim()) {
          const entry = `${line.material.name} : ${value}`;
          notes[field] = notes[field] ?? [];
          if (!notes[field]!.includes(entry)) notes[field]!.push(entry);
        }
      }
    }

    const regulatory: MaterialRegulatory = {};
    if (allergens.size > 0) {
      regulatory.isAllergen = true;
      regulatory.allergens = [...allergens];
    } else if (isAllergen) {
      regulatory.isAllergen = true;
    }
    if (mostRestrictiveLimit !== null) {
      regulatory.ifraLimit = `${mostRestrictiveLimit.toFixed(2)} %`;
    }
    for (const field of REGULATORY_NOTE_FIELDS) {
      if (notes[field]) regulatory[field] = notes[field]!.join(' ; ');
    }

    return Object.keys(regulatory).length > 0 ? regulatory : null;
  }
}
