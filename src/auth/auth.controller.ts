import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { CurrentUser, Public, type AuthUser } from './auth-user.js';
import { LoginDto, RegisterDto } from './dto/auth.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Get('invite/:code')
  inviteInfo(@Param('code') code: string) {
    return this.authService.inviteInfo(code);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user);
  }
}
