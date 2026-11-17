import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module.js';
import { FormulationRequestsModule } from '../formulation-requests/formulation-requests.module.js';
import { RegulationsModule } from '../regulations/regulations.module.js';
import { FormulasController } from './formulas.controller.js';
import { FormulasService } from './formulas.service.js';
import { FormulaCollaborationController } from './collaboration/formula-collaboration.controller.js';
import { FormulaCollaborationService } from './collaboration/formula-collaboration.service.js';

@Module({
  imports: [RegulationsModule, ApiKeysModule, FormulationRequestsModule],
  controllers: [FormulasController, FormulaCollaborationController],
  providers: [FormulasService, FormulaCollaborationService],
})
export class FormulasModule {}
