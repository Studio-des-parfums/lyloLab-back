import { Controller, Get } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/auth-user.js';
import { DashboardService } from './dashboard.service.js';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getOverview(@CurrentUser() user: AuthUser) {
    return this.dashboardService.getOverview(user.teamId);
  }
}
