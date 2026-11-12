import { Module } from '@nestjs/common';
import { StabilityController } from './stability.controller.js';
import { StabilityService } from './stability.service.js';
import { StorageService } from '../storage/storage.service.js';
import { StabilityRemindersService } from './stability-reminders.service.js';

@Module({
  controllers: [StabilityController],
  providers: [StabilityService, StorageService, StabilityRemindersService],
})
export class StabilityModule {}
