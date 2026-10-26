import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { generateInviteCode, normalizeInviteCode } from '../teams/invite-code.js';
import type { AuthUser } from './auth-user.js';
import type { LoginDto, RegisterDto } from './dto/auth.dto.js';
import { hashPassword, verifyPassword } from './password.js';
import { signToken } from './token.js';

const INVALID_CREDENTIALS = 'E-mail ou mot de passe incorrect.';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const teamName = dto.teamName?.trim();
    const inviteCode = dto.inviteCode ? normalizeInviteCode(dto.inviteCode) : '';
    if (Boolean(teamName) === Boolean(inviteCode)) {
      throw new BadRequestException(
        "Indiquez soit le nom d'une nouvelle équipe, soit un code d'invitation.",
      );
    }

    const passwordHash = await hashPassword(dto.password);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        let teamId: string;
        let role: 'admin' | 'member' = 'admin';
        if (inviteCode) {
          const team = await tx.team.findUnique({
            where: { inviteCode },
            select: { id: true, _count: { select: { users: true } } },
          });
          if (!team) throw new NotFoundException("Code d'invitation inconnu.");
          teamId = team.id;
          // The first person to join a team created without members becomes its admin.
          if (team._count.users > 0) role = 'member';
        } else {
          const team = await tx.team.create({
            data: { name: teamName!, inviteCode: generateInviteCode() },
          });
          teamId = team.id;
        }
        return tx.user.create({
          data: { email, name: dto.name.trim(), passwordHash, role, teamId },
        });
      });
      return this.session(user.id);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Un compte existe déjà avec cette adresse e-mail.');
      }
      throw err;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    if (!user || !(await verifyPassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    return this.session(user.id);
  }

  async me(user: AuthUser) {
    return this.profile(user.id);
  }

  /** Lets the sign-up page show which team a code belongs to before joining. */
  async inviteInfo(code: string) {
    const team = await this.prisma.team.findUnique({
      where: { inviteCode: normalizeInviteCode(code) },
      select: { name: true },
    });
    if (!team) throw new NotFoundException("Code d'invitation inconnu.");
    return { teamName: team.name };
  }

  private async session(userId: string) {
    return { token: signToken(userId), user: await this.profile(userId) };
  }

  private async profile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        team: { select: { id: true, name: true } },
      },
    });
    if (!user) throw new UnauthorizedException('Session expirée, reconnectez-vous.');
    return user;
  }
}
