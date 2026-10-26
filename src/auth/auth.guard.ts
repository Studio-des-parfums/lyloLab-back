import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service.js';
import { IS_PUBLIC_KEY, type AuthUser } from './auth-user.js';
import { verifyToken } from './token.js';

/** Global guard: every route needs a valid session unless marked @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined>; user?: AuthUser }>();
    const header = request.headers.authorization;
    const userId = header?.startsWith('Bearer ') ? verifyToken(header.slice(7)) : null;
    if (!userId) throw new UnauthorizedException('Connexion requise.');

    // Read from the database on every request so a removed member loses access at once.
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, teamId: true },
    });
    if (!user) throw new UnauthorizedException('Session expirée, reconnectez-vous.');

    request.user = user as AuthUser;
    return true;
  }
}
