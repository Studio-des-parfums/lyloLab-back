import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { MaterialsModule } from './materials/materials.module.js';
import { FormulasModule } from './formulas/formulas.module.js';

@Module({
  imports: [PrismaModule, MaterialsModule, FormulasModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
