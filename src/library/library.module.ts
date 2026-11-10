import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { LibraryController } from './library.controller.js';
import { LibraryService } from './library.service.js';

@Module({
  imports: [AiModule],
  controllers: [LibraryController],
  providers: [LibraryService],
})
export class LibraryModule {}
