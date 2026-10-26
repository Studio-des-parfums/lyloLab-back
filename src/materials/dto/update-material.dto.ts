import {
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateMaterialDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  casNumber?: string | null;

  @IsOptional()
  @IsString()
  family?: string | null;

  @IsOptional()
  @IsString()
  sensation?: string | null;

  @IsOptional()
  @IsNumber()
  weight?: number | null;

  @IsOptional()
  @IsNumber()
  subjectivePower?: number | null;

  @IsOptional()
  @IsObject()
  descriptors?: Record<string, number>;

  @IsOptional()
  @IsIn(['natural', 'synthetic'])
  origin?: 'natural' | 'synthetic';

  @IsOptional()
  @IsIn(['natural', 'synthetic'])
  nature?: 'natural' | 'synthetic' | null;

  @IsOptional()
  @IsString()
  ifraCat4?: string | null;

  @IsOptional()
  @IsString()
  cosmeticRegulation?: string | null;

  @IsOptional()
  @IsString()
  allergens?: string | null;

  @IsOptional()
  @IsString()
  flavor?: string | null;

  @IsOptional()
  @IsString()
  flavorRestriction?: string | null;

  @IsOptional()
  @IsObject()
  regulatory?: Record<string, unknown> | null;
}
