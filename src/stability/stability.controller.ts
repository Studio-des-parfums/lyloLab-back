import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser, type AuthUser } from '../auth/auth-user.js';
import {
  CreateCampaignDto,
  ObservationDto,
  RisksDto,
  UpdateTestDto,
} from './dto/stability.dto.js';
import { MAX_PHOTO_BYTES, StabilityService } from './stability.service.js';

interface UploadedPhoto {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

@Controller('stability')
export class StabilityController {
  constructor(private readonly stability: StabilityService) {}

  @Get('catalog')
  catalog() {
    return this.stability.catalog();
  }

  @Get('overview')
  overview(@CurrentUser() user: AuthUser) {
    return this.stability.overview(user.teamId);
  }

  @Get('tests')
  listTests(
    @CurrentUser() user: AuthUser,
    @Query('formulaId') formulaId?: string,
    @Query('status') status?: string,
  ) {
    return this.stability.listTests(user.teamId, { formulaId, status });
  }

  @Post('tests')
  createCampaign(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCampaignDto,
  ) {
    return this.stability.createCampaign(user, dto);
  }

  @Get('tests/:id')
  getTest(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.stability.getTest(user.teamId, id);
  }

  @Patch('tests/:id')
  updateTest(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTestDto,
  ) {
    return this.stability.updateTest(user.teamId, id, dto);
  }

  @Delete('tests/:id')
  @HttpCode(204)
  deleteTest(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.stability.deleteTest(user.teamId, id);
  }

  @Post('tests/:id/observations')
  addObservation(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ObservationDto,
  ) {
    return this.stability.addObservation(user, id, dto);
  }

  @Patch('observations/:id')
  updateObservation(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ObservationDto,
  ) {
    return this.stability.updateObservation(user.teamId, id, dto);
  }

  @Delete('observations/:id')
  deleteObservation(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.stability.deleteObservation(user.teamId, id);
  }

  @Post('observations/:id/photos')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_PHOTO_BYTES } }),
  )
  addPhoto(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFile() file: UploadedPhoto | undefined,
  ) {
    return this.stability.addPhoto(user.teamId, id, file);
  }

  @Get('photos/:id')
  async getPhoto(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const photo = await this.stability.getPhoto(user.teamId, id);
    res.setHeader('Content-Type', photo.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    return new StreamableFile(Buffer.from(photo.data));
  }

  @Delete('photos/:id')
  deletePhoto(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.stability.deletePhoto(user.teamId, id);
  }

  @Post('risks')
  risks(@CurrentUser() user: AuthUser, @Body() dto: RisksDto) {
    return this.stability.risks(user.teamId, dto);
  }

  @Get('formulas/:id/risks')
  formulaRisks(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.stability.formulaRisks(user.teamId, id);
  }

  @Get('materials')
  materialsOverview(@CurrentUser() user: AuthUser) {
    return this.stability.materialsOverview(user.teamId);
  }

  @Get('materials/:id')
  materialDetail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.stability.materialDetail(user.teamId, id);
  }
}
