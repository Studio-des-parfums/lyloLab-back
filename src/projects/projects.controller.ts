import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/auth-user.js';
import { ProjectsService } from './projects.service.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query('clientId') clientId?: string) {
    return this.projectsService.findAll(user.teamId, clientId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.projectsService.findOne(user.teamId, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(user.teamId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(user.teamId, id, dto);
  }
}
