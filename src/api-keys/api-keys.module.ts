import { Module } from '@nestjs/common';
import { ApiKeysController, ApiV1PingController } from './api-keys.controller.js';
import { ApiKeysService } from './api-keys.service.js';
import { ApiKeyGuard } from './api-key.guard.js';

@Module({
  controllers: [ApiKeysController, ApiV1PingController],
  providers: [ApiKeysService, ApiKeyGuard],
  exports: [ApiKeyGuard],
})
export class ApiKeysModule {}
