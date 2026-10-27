import { Module } from '@nestjs/common';
import { MaterialsController } from './materials.controller.js';
import { MaterialsService } from './materials.service.js';
import { MaterialsImportService } from './import/materials-import.service.js';

@Module({
  controllers: [MaterialsController],
  providers: [MaterialsService, MaterialsImportService],
})
export class MaterialsModule {}
