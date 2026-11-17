import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module.js';
import { FormulationRequestsApiController } from './formulation-requests-api.controller.js';
import { FormulationRequestsController } from './formulation-requests.controller.js';
import { FormulationRequestsService } from './formulation-requests.service.js';
import { RequesterMailService } from './requester-mail.service.js';

@Module({
  imports: [ApiKeysModule],
  controllers: [FormulationRequestsApiController, FormulationRequestsController],
  providers: [FormulationRequestsService, RequesterMailService],
  exports: [FormulationRequestsService, RequesterMailService],
})
export class FormulationRequestsModule {}
