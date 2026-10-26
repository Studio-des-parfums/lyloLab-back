import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateFormulaLineDto {
  @IsString()
  materialId!: string;

  @IsNumber()
  @Min(0)
  quantity!: number;
}

export class CreateFormulaDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsObject()
  facets!: Record<string, number>;

  @IsObject()
  adjustments!: Record<string, number>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFormulaLineDto)
  lines!: CreateFormulaLineDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalVolumeMl?: number | null;

  @IsOptional()
  @IsIn(['draft', 'completed'])
  status?: 'draft' | 'completed';

  @IsOptional()
  @IsString()
  projectId?: string | null;
}
