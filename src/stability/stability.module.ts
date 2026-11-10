import { Module } from '@nestjs/common';
import { StabilityController } from './stability.controller.js';
import { StabilityService } from './stability.service.js';

@Module({
  controllers: [StabilityController],
  providers: [StabilityService],
})
export class StabilityModule {}
