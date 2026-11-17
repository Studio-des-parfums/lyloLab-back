import {
  HttpException,
  HttpStatus,
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

/** Limite par clé : fenêtre fixe en mémoire (suffisant tant qu'il n'y a qu'une instance). */
export const RATE_LIMIT = { max: 60, windowMs: 60_000 };

export class RateLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  /** Renvoie le nombre de secondes à attendre si la limite est atteinte, sinon null. */
  hit(id: string): number | null {
    const now = this.now();
    const w = this.windows.get(id);
    if (!w || now - w.start >= RATE_LIMIT.windowMs) {
      this.windows.set(id, { start: now, count: 1 });
      return null;
    }
    if (w.count >= RATE_LIMIT.max) return Math.ceil((w.start + RATE_LIMIT.windowMs - now) / 1000);
    w.count++;
    return null;
  }
}

/** Protège /api/v1 : à combiner avec @Public() pour court-circuiter l'AuthGuard utilisateur. */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  // Partagé : le guard est instancié dans chaque module qui l'utilise, la limite doit rester globale par clé.
  private static readonly limiter = new RateLimiter();
  private readonly limiter = ApiKeyGuard.limiter;

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

    const retryAfter = this.limiter.hit(apiKey.id);
    if (retryAfter !== null) {
      context.switchToHttp().getResponse<{ setHeader?: (k: string, v: string) => void }>()
        .setHeader?.('Retry-After', String(retryAfter));
      throw new HttpException(
        `Trop de requêtes : ${RATE_LIMIT.max} par minute maximum. Réessayez dans ${retryAfter} s.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    request.apiClient = { apiKeyId: apiKey.id, teamId: apiKey.teamId, name: apiKey.name };
    return true;
  }
}

export const CurrentApiClient = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ApiClient =>
    context.switchToHttp().getRequest<{ apiClient: ApiClient }>().apiClient,
);
