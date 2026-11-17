import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/auth-user.js';
import { FormulationRequestsService } from './formulation-requests.service.js';

/** Demandes reçues, vues par l'équipe dans Lylo-Lab. */
@Controller('formulation-requests')
export class FormulationRequestsController {
  constructor(private readonly service: FormulationRequestsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    return this.service.findAllForTeam(user.teamId, status);
  }

  @Get('count')
  count(@CurrentUser() user: AuthUser) {
    return this.service.countPending(user.teamId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOneForTeam(user.teamId, id);
  }

  @Post(':id/take')
  @HttpCode(200)
  take(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.take(user, id);
  }

  @Post(':id/start')
  @HttpCode(200)
  start(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.start(user, id);
  }
}
