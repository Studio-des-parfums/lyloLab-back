import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateMaterialStockDto {
  @IsString()
  @MinLength(1)
  label!: string;

  @IsOptional()
  @IsString()
  supplier?: string | null;

  @IsOptional()
  @IsString()
  producer?: string | null;

  @IsOptional()
  @IsString()
  location?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stockGrams?: number | null;

  @IsOptional()
  @IsString()
  stockNote?: string | null;
}

export class UpdateMaterialStockDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  label?: string;

  @IsOptional()
  @IsString()
  supplier?: string | null;

  @IsOptional()
  @IsString()
  producer?: string | null;

  @IsOptional()
  @IsString()
  location?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stockGrams?: number | null;

  @IsOptional()
  @IsString()
  stockNote?: string | null;
}
