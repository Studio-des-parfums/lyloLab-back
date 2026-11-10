import { Module } from '@nestjs/common';
import { RegulationsModule } from '../regulations/regulations.module.js';
import { FormulasController } from './formulas.controller.js';
import { FormulasService } from './formulas.service.js';

@Module({
  imports: [RegulationsModule],
  controllers: [FormulasController],
  providers: [FormulasService],
})
export class FormulasModule {}
