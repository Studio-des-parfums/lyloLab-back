import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/auth-user.js';
import { MaterialsService } from './materials.service.js';
import { UpdateMaterialDto } from './dto/update-material.dto.js';
import {
  CreateMaterialStockDto,
  UpdateMaterialStockDto,
} from './dto/material-stock.dto.js';

@Controller('materials')
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query('search') search?: string) {
    return this.materialsService.findAll(user.teamId, search);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.materialsService.findOne(user.teamId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateMaterialDto,
  ) {
    return this.materialsService.update(user.teamId, id, dto);
  }

  @Post(':id/stocks')
  createStock(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateMaterialStockDto,
  ) {
    return this.materialsService.createStock(user.teamId, id, dto);
  }

  @Patch(':id/stocks/:stockId')
  updateStock(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('stockId', ParseIntPipe) stockId: number,
    @Body() dto: UpdateMaterialStockDto,
  ) {
    return this.materialsService.updateStock(user.teamId, id, stockId, dto);
  }

  @Delete(':id/stocks/:stockId')
  deleteStock(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('stockId', ParseIntPipe) stockId: number,
  ) {
    return this.materialsService.deleteStock(user.teamId, id, stockId);
  }
}
