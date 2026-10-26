import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/auth-user.js';
import { FormulasService } from './formulas.service.js';
import { CreateFormulaDto } from './dto/create-formula.dto.js';
import { UpdateFormulaStatusDto } from './dto/update-formula-status.dto.js';

@Controller('formulas')
export class FormulasController {
  constructor(private readonly formulasService: FormulasService) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: 'draft' | 'completed',
    @Query('projectId') projectId?: string,
  ) {
    return this.formulasService.findAll(user.teamId, status, projectId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.formulasService.findOne(user.teamId, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateFormulaDto) {
    return this.formulasService.create(user.teamId, dto);
  }

  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateFormulaDto,
  ) {
    return this.formulasService.update(user.teamId, id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateFormulaStatusDto,
  ) {
    return this.formulasService.updateStatus(user.teamId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.formulasService.remove(user.teamId, id);
  }

  @Post(':id/convert-to-material')
  convertToMaterial(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.formulasService.convertToMaterial(user.teamId, id);
  }
}
