import { Module } from '@nestjs/common';
import { RegulationsModule } from '../regulations/regulations.module.js';
import { MaterialsController } from './materials.controller.js';
import { MaterialsService } from './materials.service.js';
import { MaterialsImportService } from './import/materials-import.service.js';

@Module({
  imports: [RegulationsModule],
  controllers: [MaterialsController],
  providers: [MaterialsService, MaterialsImportService],
})
export class MaterialsModule {}
