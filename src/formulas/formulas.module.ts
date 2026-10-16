import { Module } from '@nestjs/common';
import { FormulasController } from './formulas.controller.js';
import { FormulasService } from './formulas.service.js';

@Module({
  controllers: [FormulasController],
  providers: [FormulasService],
})
export class FormulasModule {}
