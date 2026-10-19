import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { FormulasService } from './formulas.service.js';
import { CreateFormulaDto } from './dto/create-formula.dto.js';

@Controller('formulas')
export class FormulasController {
  constructor(private readonly formulasService: FormulasService) {}

  @Get()
  findAll() {
    return this.formulasService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.formulasService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateFormulaDto) {
    return this.formulasService.create(dto);
  }
}
