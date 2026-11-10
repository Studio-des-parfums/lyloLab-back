import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
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

  /** Server-Sent Events: "delta" chunks of the message, then "done" (or "error"). */
  @Post('chat/stream')
  async chatStream(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChatDto,
    @Res() res: Response,
  ) {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const abort = new AbortController();
    res.on('close', () => abort.abort());

    for await (const event of this.aiService.chatStream(user.teamId, dto, abort.signal)) {
      if (abort.signal.aborted) break;
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    res.end();
  }
}
