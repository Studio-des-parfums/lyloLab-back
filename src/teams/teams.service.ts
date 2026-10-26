import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertAdmin, type AuthUser } from '../auth/auth-user.js';
import { generateInviteCode } from './invite-code.js';
import type { UpdateMemberRoleDto, UpdateTeamDto } from './dto/team.dto.js';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async current(user: AuthUser) {
    const team = await this.prisma.team.findUniqueOrThrow({
      where: { id: user.teamId },
      include: {
        users: {
          select: { id: true, name: true, email: true, role: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    return {
      id: team.id,
      name: team.name,
      // Only admins can hand out the code.
      inviteCode: user.role === 'admin' ? team.inviteCode : null,
      members: team.users,
    };
  }

  async rename(user: AuthUser, dto: UpdateTeamDto) {
    assertAdmin(user);
    await this.prisma.team.update({ where: { id: user.teamId }, data: { name: dto.name.trim() } });
    return this.current(user);
  }

  /** Issues a new code; the previous one stops working. */
  async regenerateInviteCode(user: AuthUser) {
    assertAdmin(user);
    await this.prisma.team.update({
      where: { id: user.teamId },
      data: { inviteCode: generateInviteCode() },
    });
    return this.current(user);
  }

  async updateMemberRole(user: AuthUser, memberId: string, dto: UpdateMemberRoleDto) {
    assertAdmin(user);
    const member = await this.findMember(user, memberId);
    if (member.role === 'admin' && dto.role !== 'admin') await this.assertNotLastAdmin(user);
    await this.prisma.user.update({ where: { id: member.id }, data: { role: dto.role } });
    return this.current(user);
  }

  async removeMember(user: AuthUser, memberId: string) {
    assertAdmin(user);
    if (memberId === user.id) {
      throw new BadRequestException("Vous ne pouvez pas vous retirer vous-même de l'équipe.");
    }
    const member = await this.findMember(user, memberId);
    await this.prisma.user.delete({ where: { id: member.id } });
    return this.current(user);
  }

  private async findMember(user: AuthUser, memberId: string) {
    const member = await this.prisma.user.findFirst({
      where: { id: memberId, teamId: user.teamId },
      select: { id: true, role: true },
    });
    if (!member) throw new NotFoundException('Membre introuvable dans votre équipe.');
    return member;
  }

  private async assertNotLastAdmin(user: AuthUser) {
    const admins = await this.prisma.user.count({ where: { teamId: user.teamId, role: 'admin' } });
    if (admins <= 1) {
      throw new BadRequestException("L'équipe doit garder au moins un administrateur.");
    }
  }
}
