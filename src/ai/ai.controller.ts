import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/auth-user.js';
import { AiService } from './ai.service.js';
import { ChatDto } from './dto/chat.dto.js';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  chat(@CurrentUser() user: AuthUser, @Body() dto: ChatDto) {
    return this.aiService.chat(user.teamId, dto);
  }
}
