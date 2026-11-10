import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/auth-user.js';
import { RegulationsService } from './regulations.service.js';
import {
  CreateRegulationDto,
  UpdateRegulationDto,
  UpsertEntryDto,
} from './dto/regulation.dto.js';

@Controller('regulations')
export class RegulationsController {
  constructor(private readonly regulations: RegulationsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.regulations.findAll(user.teamId);
  }

  /** Limits of the custom regulations, checked in every formula. */
  @Get('custom-limits')
  customLimits(@CurrentUser() user: AuthUser) {
    return this.regulations.customLimits(user.teamId);
  }

  /** Recomputes the material ↔ official regulation links of the team. */
  @Post('sync')
  async sync(@CurrentUser() user: AuthUser) {
    return { links: await this.regulations.sync(user.teamId) };
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.regulations.findOne(user.teamId, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRegulationDto) {
    return this.regulations.create(user.teamId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateRegulationDto,
  ) {
    return this.regulations.update(user.teamId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.regulations.remove(user.teamId, id);
  }

  @Put(':id/materials')
  upsertEntry(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpsertEntryDto,
  ) {
    return this.regulations.upsertEntry(user.teamId, id, dto);
  }

  @Delete(':id/materials/:materialId')
  removeEntry(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('materialId') materialId: string,
  ) {
    return this.regulations.removeEntry(user.teamId, id, materialId);
  }
}
