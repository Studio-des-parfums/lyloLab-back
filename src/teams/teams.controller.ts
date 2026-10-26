import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/auth-user.js';
import { TeamsService } from './teams.service.js';
import { UpdateMemberRoleDto, UpdateTeamDto } from './dto/team.dto.js';

@Controller('teams/current')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  current(@CurrentUser() user: AuthUser) {
    return this.teamsService.current(user);
  }

  @Patch()
  rename(@CurrentUser() user: AuthUser, @Body() dto: UpdateTeamDto) {
    return this.teamsService.rename(user, dto);
  }

  @Post('invite-code')
  regenerateInviteCode(@CurrentUser() user: AuthUser) {
    return this.teamsService.regenerateInviteCode(user);
  }

  @Patch('members/:id')
  updateMemberRole(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.teamsService.updateMemberRole(user, id, dto);
  }

  @Delete('members/:id')
  removeMember(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.teamsService.removeMember(user, id);
  }
}
