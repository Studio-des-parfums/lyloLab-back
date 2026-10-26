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
  findAll(@Query('search') search?: string) {
    return this.materialsService.findAll(search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.materialsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMaterialDto) {
    return this.materialsService.update(id, dto);
  }

  @Post(':id/stocks')
  createStock(
    @Param('id') id: string,
    @Body() dto: CreateMaterialStockDto,
  ) {
    return this.materialsService.createStock(id, dto);
  }

  @Patch(':id/stocks/:stockId')
  updateStock(
    @Param('id') id: string,
    @Param('stockId', ParseIntPipe) stockId: number,
    @Body() dto: UpdateMaterialStockDto,
  ) {
    return this.materialsService.updateStock(id, stockId, dto);
  }

  @Delete(':id/stocks/:stockId')
  deleteStock(
    @Param('id') id: string,
    @Param('stockId', ParseIntPipe) stockId: number,
  ) {
    return this.materialsService.deleteStock(id, stockId);
  }
}
