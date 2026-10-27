import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser, type AuthUser } from '../auth/auth-user.js';
import { MaterialsService } from './materials.service.js';
import { MaterialsImportService } from './import/materials-import.service.js';
import { MAX_IMPORT_BYTES, importFormat } from './import/import-format.js';

interface UploadedImportFile {
  originalname: string;
  buffer: Buffer;
}
import { UpdateMaterialDto } from './dto/update-material.dto.js';
import {
  CreateMaterialStockDto,
  UpdateMaterialStockDto,
} from './dto/material-stock.dto.js';

@Controller('materials')
export class MaterialsController {
  constructor(
    private readonly materialsService: MaterialsService,
    private readonly importService: MaterialsImportService,
  ) {}

  @Get('import/format')
  importFormat() {
    return importFormat();
  }

  /** Previews the file's materials; with ?apply=true, also creates or updates them. */
  @Post('import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMPORT_BYTES } }))
  importFile(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadedImportFile | undefined,
    @Query('apply') apply?: string,
  ) {
    if (!file) throw new BadRequestException('Aucun fichier reçu.');
    // Multer reads the file name as latin1; browsers send it as UTF-8.
    const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    return this.importService.import(user.teamId, fileName, file.buffer, apply === 'true');
  }

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
