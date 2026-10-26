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
import { FormulasService } from './formulas.service.js';
import { CreateFormulaDto } from './dto/create-formula.dto.js';
import { UpdateFormulaStatusDto } from './dto/update-formula-status.dto.js';

@Controller('formulas')
export class FormulasController {
  constructor(private readonly formulasService: FormulasService) {}

  @Get()
  findAll(
    @Query('status') status?: 'draft' | 'completed',
    @Query('projectId') projectId?: string,
  ) {
    return this.formulasService.findAll(status, projectId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.formulasService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateFormulaDto) {
    return this.formulasService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: CreateFormulaDto) {
    return this.formulasService.update(id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateFormulaStatusDto,
  ) {
    return this.formulasService.updateStatus(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.formulasService.remove(id);
  }

  @Post(':id/convert-to-material')
  convertToMaterial(@Param('id') id: string) {
    return this.formulasService.convertToMaterial(id);
  }
}
