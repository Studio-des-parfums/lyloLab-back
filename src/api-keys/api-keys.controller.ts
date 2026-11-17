import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, Public, type AuthUser } from '../auth/auth-user.js';
import { ApiKeysService } from './api-keys.service.js';
import { ApiKeyGuard, CurrentApiClient, type ApiClient } from './api-key.guard.js';
import { CreateApiKeyDto } from './dto/create-api-key.dto.js';
import { UpdateApiKeyDto } from './dto/update-api-key.dto.js';

@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.apiKeysService.findAll(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateApiKeyDto) {
    return this.apiKeysService.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateApiKeyDto) {
    return this.apiKeysService.update(user, id, dto);
  }

  @Delete(':id')
  revoke(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.apiKeysService.revoke(user, id);
  }
}

/** Permet à une plateforme externe de vérifier que sa clé fonctionne. */
@Public()
@UseGuards(ApiKeyGuard)
@Controller('v1')
export class ApiV1PingController {
  @Get('ping')
  ping(@CurrentApiClient() client: ApiClient) {
    return { ok: true, apiKey: client.name };
  }
}
