import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { FACETS } from '../../ai/formula-changes.js';

export class FacetDefinitionDto {
  @IsString()
  @MinLength(1)
  description!: string;

  @IsOptional()
  @IsString()
  examples?: string;
}

export class AnalyzeReferenceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  query!: string;
}

export class SourceDto {
  @IsString()
  title!: string;

  @IsString()
  url!: string;
}

export class InterpretationDto {
  @IsUUID()
  materialId!: string;

  @IsString()
  material!: string;

  @IsString()
  role!: string;

  @IsOptional()
  @IsString()
  evokes?: string;
}

export class ReferenceDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  brand?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1700)
  @Max(2100)
  year?: number | null;

  @IsOptional()
  @IsString()
  perfumer?: string | null;

  @IsOptional()
  @IsString()
  familyCode?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsArray()
  @IsString({ each: true })
  topNotes!: string[];

  @IsArray()
  @IsString({ each: true })
  heartNotes!: string[];

  @IsArray()
  @IsString({ each: true })
  baseNotes!: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SourceDto)
  sources!: SourceDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InterpretationDto)
  interpretation!: InterpretationDto[];

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  formulaIds?: string[];
}

export class MaterialNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number | null;
}

export class CreateBlindTestDto {
  @IsInt()
  @Min(3)
  @Max(20)
  count!: number;

  @IsOptional()
  @IsBoolean()
  onlyInStock?: boolean;

  /** Restrict to materials whose dominant facet is one of these. */
  @IsOptional()
  @IsArray()
  @IsIn([...FACETS], { each: true })
  facets?: string[];
}

export class BlindAnswerDto {
  @IsString()
  code!: string;

  @IsOptional()
  @IsUUID()
  guessMaterialId?: string | null;

  @IsOptional()
  @IsIn([...FACETS])
  guessFacet?: string | null;
}

export class SubmitBlindTestDto {
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => BlindAnswerDto)
  answers!: BlindAnswerDto[];
}
