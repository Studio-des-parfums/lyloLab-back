import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/auth-user.js';
import { ClientsService } from './clients.service.js';
import { CreateClientDto } from './dto/create-client.dto.js';
import { UpdateClientDto } from './dto/update-client.dto.js';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.clientsService.findAll(user.teamId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.clientsService.findOne(user.teamId, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateClientDto) {
    return this.clientsService.create(user.teamId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(user.teamId, id, dto);
  }
}
