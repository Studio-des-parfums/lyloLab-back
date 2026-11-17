import { Module } from '@nestjs/common';
import { RegulationsModule } from '../regulations/regulations.module.js';
import { FormulasController } from './formulas.controller.js';
import { FormulasService } from './formulas.service.js';
import { FormulaCollaborationController } from './collaboration/formula-collaboration.controller.js';
import { FormulaCollaborationService } from './collaboration/formula-collaboration.service.js';

@Module({
  imports: [RegulationsModule],
  controllers: [FormulasController, FormulaCollaborationController],
  providers: [FormulasService, FormulaCollaborationService],
})
export class FormulasModule {}
