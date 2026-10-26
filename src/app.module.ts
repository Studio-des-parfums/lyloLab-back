import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { MaterialsModule } from './materials/materials.module.js';
import { FormulasModule } from './formulas/formulas.module.js';
import { ClientsModule } from './clients/clients.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { AiModule } from './ai/ai.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';

@Module({
  imports: [PrismaModule, MaterialsModule, FormulasModule, ClientsModule, ProjectsModule, AiModule, DashboardModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
