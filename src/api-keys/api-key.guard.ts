import {
  Injectable,
  UnauthorizedException,
  createParamDecorator,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashApiKey } from './api-key.util.js';

/** La plateforme externe authentifiée par sa clé API. */
export interface ApiClient {
  apiKeyId: string;
  teamId: string;
  name: string;
}

/** Protège /api/v1 : à combiner avec @Public() pour court-circuiter l'AuthGuard utilisateur. */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined>; apiClient?: ApiClient }>();
    const key = request.headers['x-api-key'];
    if (!key) throw new UnauthorizedException('Clé API manquante (header X-Api-Key).');

    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyHash: hashApiKey(key) },
      select: { id: true, teamId: true, name: true, revokedAt: true },
    });
    if (!apiKey || apiKey.revokedAt) throw new UnauthorizedException('Clé API invalide ou révoquée.');

    request.apiClient = { apiKeyId: apiKey.id, teamId: apiKey.teamId, name: apiKey.name };
    return true;
  }
}

export const CurrentApiClient = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ApiClient =>
    context.switchToHttp().getRequest<{ apiClient: ApiClient }>().apiClient,
);
