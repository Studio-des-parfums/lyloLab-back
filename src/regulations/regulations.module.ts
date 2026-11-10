import { Module } from '@nestjs/common';
import { RegulationsController } from './regulations.controller.js';
import { RegulationsService } from './regulations.service.js';

@Module({
  controllers: [RegulationsController],
  providers: [RegulationsService],
  exports: [RegulationsService],
})
export class RegulationsModule {}
