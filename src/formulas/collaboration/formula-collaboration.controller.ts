import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../../auth/auth-user.js';
import { FormulaCollaborationService } from './formula-collaboration.service.js';
import { CreateMessageDto, CreateNoteDto, UpdateDescriptionDto, UpdateScheduleDto } from './dto.js';

@Controller('formulas/:id')
export class FormulaCollaborationController {
  constructor(private readonly service: FormulaCollaborationService) {}

  @Get('lineage')
  lineage(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.lineage(user, id);
  }

  @Patch('description')
  updateDescription(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateDescriptionDto) {
    return this.service.updateDescription(user, id, dto.description);
  }

  @Patch('schedule')
  updateSchedule(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateScheduleDto) {
    return this.service.updateSchedule(user, id, dto);
  }

  @Post('final')
  @HttpCode(200)
  markFinal(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.markFinal(user, id);
  }

  @Delete('final')
  unmarkFinal(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.unmarkFinal(user, id);
  }

  @Get('notes')
  listNotes(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.listNotes(user, id);
  }

  @Post('notes')
  addNote(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateNoteDto) {
    return this.service.addNote(user, id, dto.body);
  }

  @Delete('notes/:noteId')
  @HttpCode(204)
  deleteNote(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('noteId') noteId: string) {
    return this.service.deleteNote(user, id, noteId);
  }

  @Get('messages')
  listMessages(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.listMessages(user, id);
  }

  @Post('messages')
  postMessage(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateMessageDto) {
    return this.service.postMessage(user, id, dto.body, dto.mentionUserIds);
  }
}
