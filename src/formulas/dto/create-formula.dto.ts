import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNumber, IsObject, IsOptional, IsString, Min, MinLength, ValidateNested, MaxLength } from 'class-validator';

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

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

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

  /** Crée une nouvelle version de cette formule (ignoré à la mise à jour). */
  @IsOptional()
  @IsString()
  versionOfId?: string;
}
