import { IsNumber, IsOptional, IsString, IsUUID, Max, Min, MinLength, ValidateIf } from 'class-validator';

export class CreateRegulationDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
  @IsOptional()
  @IsString()
  continent?: string;

  @IsOptional()
  @IsString()
  country?: string;
}

export class UpdateRegulationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
  @IsOptional()
  @IsString()
  continent?: string;

  @IsOptional()
  @IsString()
  country?: string;
}

export class UpsertEntryDto {
  @IsUUID()
  materialId!: string;

  /** Maximum % in the formula; null bans the material. */
  @ValidateIf((_, value) => value !== null)
  @IsNumber()
  @Min(0)
  @Max(100)
  maxPercent!: number | null;

  @IsOptional()
  @IsString()
  note?: string;
}
