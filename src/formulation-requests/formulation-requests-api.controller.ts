import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Public } from '../auth/auth-user.js';
import { ApiKeyGuard, CurrentApiClient, type ApiClient } from '../api-keys/api-key.guard.js';
import { FormulationRequestsService } from './formulation-requests.service.js';
import { CreateFormulationRequestDto } from './dto/create-formulation-request.dto.js';

/** API publique : appelée par les plateformes externes avec leur clé API. */
@Public()
@UseGuards(ApiKeyGuard)
@Controller('v1/formulation-requests')
export class FormulationRequestsApiController {
  constructor(private readonly service: FormulationRequestsService) {}

  @Post()
  create(@CurrentApiClient() client: ApiClient, @Body() dto: CreateFormulationRequestDto) {
    return this.service.createFromApi(client, dto);
  }

  @Get()
  findAll(@CurrentApiClient() client: ApiClient, @Query('status') status?: string) {
    return this.service.findAllForApi(client, status);
  }

  @Get(':id')
  findOne(@CurrentApiClient() client: ApiClient, @Param('id') id: string) {
    return this.service.findOneForApi(client, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@CurrentApiClient() client: ApiClient, @Param('id') id: string) {
    return this.service.cancelFromApi(client, id);
  }
}
