import { Module } from '@nestjs/common';
import { ApiKeysController, ApiV1PingController } from './api-keys.controller.js';
import { ApiKeysService } from './api-keys.service.js';
import { ApiKeyGuard } from './api-key.guard.js';
import { WebhooksService } from './webhooks.service.js';

@Module({
  controllers: [ApiKeysController, ApiV1PingController],
  providers: [ApiKeysService, ApiKeyGuard, WebhooksService],
  exports: [ApiKeyGuard, WebhooksService],
})
export class ApiKeysModule {}
