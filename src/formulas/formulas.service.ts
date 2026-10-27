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
import type { AuthUser } from '../auth/auth-user.js';
import { parseIfraLimitPercent } from './ifra-limit.js';

interface MaterialRegulatory {
  ifraLimit?: string | number;
  rciiiRestriction?: string;
  isAllergen?: boolean;
  allergens?: string[];
  recombi?: string;
  recombiRisk?: boolean;
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
  'rciiiNote',
  'ghsClassification',
  'recombi',
  'physicoChemicalIssue',
  'triggeringConditions',
  'impactResult',
  'usaMocra',
  'usaMocraNote',
  'californiaProp65',
  'californiaNote',
  'chinaCsar',
  'chinaNote',
  'chinaMeaning',
  'menaGso',
  'menaNote',
];

const AUTHOR_SELECT = { createdBy: { select: { id: true, name: true } } } as const;

@Injectable()
export class FormulasService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(teamId: string, status?: 'draft' | 'completed', projectId?: string) {
    return this.prisma.formula.findMany({
      where: {
        teamId,
        ...(status ? { status } : {}),
        ...(projectId ? { projectId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        materializedAs: { select: { id: true } },
        project: { include: { client: true } },
        ...AUTHOR_SELECT,
      },
    });
  }

  async findOne(teamId: string, id: string) {
    const formula = await this.prisma.formula.findFirst({
      where: { id, teamId },
      include: {
        lines: { include: { material: true } },
        project: { include: { client: true } },
        ...AUTHOR_SELECT,
      },
    });
    if (!formula) {
      throw new NotFoundException(`Formula "${id}" not found`);
    }
    return formula;
  }

  /** Materials and project referenced by a formula must belong to the same team. */
  private async assertReferences(teamId: string, dto: CreateFormulaDto) {
    const materialIds = [...new Set(dto.lines.map((line) => line.materialId))];
    const owned = await this.prisma.material.count({
      where: { id: { in: materialIds }, teamId },
    });
    if (owned !== materialIds.length) {
      throw new BadRequestException("La formule contient une matière première qui n'existe pas dans votre équipe.");
    }
    if (dto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: dto.projectId, teamId },
        select: { id: true },
      });
      if (!project) throw new NotFoundException(`Project "${dto.projectId}" not found`);
    }
  }

  async create(user: AuthUser, dto: CreateFormulaDto) {
    const teamId = user.teamId;
    await this.assertReferences(teamId, dto);
    return this.prisma.formula.create({
      data: {
        teamId,
        createdById: user.id,
        createdByName: user.name,
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
      include: {
        lines: { include: { material: true } },
        project: { include: { client: true } },
        ...AUTHOR_SELECT,
      },
    });
  }

  async update(teamId: string, id: string, dto: CreateFormulaDto) {
    const existing = await this.findOne(teamId, id);
    if (existing.status === 'completed') {
      throw new ConflictException(
        'Cette formule est finalisée et ne peut plus être modifiée : dupliquez-la pour créer une nouvelle version.',
      );
    }
    await this.assertReferences(teamId, dto);
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
      include: {
        lines: { include: { material: true } },
        project: { include: { client: true } },
        ...AUTHOR_SELECT,
      },
    });
  }

  async updateStatus(teamId: string, id: string, dto: UpdateFormulaStatusDto) {
    await this.findOne(teamId, id);
    return this.prisma.formula.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  async remove(teamId: string, id: string) {
    await this.findOne(teamId, id);
    await this.prisma.formula.delete({ where: { id } });
  }

  async convertToMaterial(teamId: string, id: string) {
    const formula = await this.findOne(teamId, id);

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
          teamId,
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
    let recombiRisk = false;
    const allergens = new Set<string>();
    let mostRestrictiveLimit: number | null = null;
    const notes: Partial<Record<keyof MaterialRegulatory, string[]>> = {};

    for (const line of lines) {
      const reg = line.material.regulatory as MaterialRegulatory | null;
      if (!reg) continue;

      if (reg.isAllergen) isAllergen = true;
      if (reg.recombiRisk) recombiRisk = true;
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
    if (recombiRisk) regulatory.recombiRisk = true;
    if (mostRestrictiveLimit !== null) {
      regulatory.ifraLimit = `${mostRestrictiveLimit.toFixed(2)} %`;
    }
    for (const field of REGULATORY_NOTE_FIELDS) {
      if (notes[field]) regulatory[field] = notes[field]!.join(' ; ');
    }

    return Object.keys(regulatory).length > 0 ? regulatory : null;
  }
}
