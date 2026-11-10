import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/auth-user.js';
import {
  AnalyzeReferenceDto,
  CreateBlindTestDto,
  FacetDefinitionDto,
  MaterialNoteDto,
  ReferenceDto,
  SubmitBlindTestDto,
} from './dto/library.dto.js';
import { LibraryService } from './library.service.js';

@Controller('library')
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get('facets')
  facets(@CurrentUser() user: AuthUser) {
    return this.library.facets(user.teamId);
  }

  @Put('facets/:facet')
  updateFacet(
    @CurrentUser() user: AuthUser,
    @Param('facet') facet: string,
    @Body() dto: FacetDefinitionDto,
  ) {
    return this.library.updateFacet(user.teamId, facet, dto);
  }

  @Delete('facets/:facet')
  resetFacet(@CurrentUser() user: AuthUser, @Param('facet') facet: string) {
    return this.library.resetFacet(user.teamId, facet);
  }

  @Get('countries')
  countries() {
    return this.library.countries();
  }

  @Get('families')
  families() {
    return this.library.families();
  }

  @Get('references')
  listReferences(@CurrentUser() user: AuthUser) {
    return this.library.listReferences(user.teamId);
  }

  @Post('references/analyze')
  analyzeReference(
    @CurrentUser() user: AuthUser,
    @Body() dto: AnalyzeReferenceDto,
  ) {
    return this.library.analyzeReference(user.teamId, dto.query);
  }

  @Post('references')
  createReference(@CurrentUser() user: AuthUser, @Body() dto: ReferenceDto) {
    return this.library.createReference(user, dto);
  }

  @Get('references/:id')
  getReference(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.library.getReference(user.teamId, id);
  }

  @Patch('references/:id')
  updateReference(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReferenceDto,
  ) {
    return this.library.updateReference(user.teamId, id, dto);
  }

  @Delete('references/:id')
  @HttpCode(204)
  deleteReference(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.library.deleteReference(user.teamId, id);
  }

  @Get('notes')
  recentNotes(@CurrentUser() user: AuthUser) {
    return this.library.recentNotes(user.teamId);
  }

  @Get('materials/:id/notes')
  materialNotes(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.library.materialNotes(user.teamId, id);
  }

  @Post('materials/:id/notes')
  addNote(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: MaterialNoteDto,
  ) {
    return this.library.addNote(user, id, dto);
  }

  @Delete('notes/:id')
  deleteNote(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.library.deleteNote(user, id);
  }

  @Get('blind-tests')
  listBlindTests(@CurrentUser() user: AuthUser) {
    return this.library.listBlindTests(user.teamId);
  }

  @Post('blind-tests')
  createBlindTest(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateBlindTestDto,
  ) {
    return this.library.createBlindTest(user, dto);
  }

  @Get('blind-tests/:id')
  getBlindTest(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('reveal') reveal?: string,
  ) {
    return this.library.getBlindTest(user.teamId, id, reveal === 'true');
  }

  @Post('blind-tests/:id/submit')
  submitBlindTest(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SubmitBlindTestDto,
  ) {
    return this.library.submitBlindTest(user, id, dto);
  }

  @Delete('blind-tests/:id')
  @HttpCode(204)
  deleteBlindTest(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.library.deleteBlindTest(user.teamId, id);
  }
}
