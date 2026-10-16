import { Controller, Get, Param } from '@nestjs/common';
import { FormulasService } from './formulas.service.js';

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
}
