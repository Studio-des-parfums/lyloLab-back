import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertAdmin, type AuthUser } from '../auth/auth-user.js';
import { generateApiKey, generateWebhookSecret } from './api-key.util.js';
import type { CreateApiKeyDto } from './dto/create-api-key.dto.js';
import type { UpdateApiKeyDto } from './dto/update-api-key.dto.js';

const PUBLIC_FIELDS = {
  id: true,
  name: true,
  prefix: true,
  webhookUrl: true,
  webhookSecret: true,
  createdAt: true,
  revokedAt: true,
} as const;

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(user: AuthUser) {
    assertAdmin(user);
    return this.prisma.apiKey.findMany({
      where: { teamId: user.teamId },
      select: PUBLIC_FIELDS,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** La clé en clair n'est renvoyée qu'ici : seul son hash est conservé. */
  async create(user: AuthUser, dto: CreateApiKeyDto) {
    assertAdmin(user);
    const { key, prefix, hash } = generateApiKey();
    const created = await this.prisma.apiKey.create({
      data: {
        teamId: user.teamId,
        name: dto.name,
        webhookUrl: dto.webhookUrl ?? null,
        keyHash: hash,
        prefix,
        webhookSecret: generateWebhookSecret(),
      },
      select: PUBLIC_FIELDS,
    });
    return { ...created, key };
  }

  async update(user: AuthUser, id: string, dto: UpdateApiKeyDto) {
    assertAdmin(user);
    await this.findOwned(user, id);
    return this.prisma.apiKey.update({
      where: { id },
      data: { name: dto.name, webhookUrl: dto.webhookUrl },
      select: PUBLIC_FIELDS,
    });
  }

  async revoke(user: AuthUser, id: string) {
    assertAdmin(user);
    await this.findOwned(user, id);
    return this.prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
      select: PUBLIC_FIELDS,
    });
  }

  private async findOwned(user: AuthUser, id: string) {
    const apiKey = await this.prisma.apiKey.findFirst({ where: { id, teamId: user.teamId } });
    if (!apiKey) throw new NotFoundException('Clé API introuvable.');
    return apiKey;
  }
}
